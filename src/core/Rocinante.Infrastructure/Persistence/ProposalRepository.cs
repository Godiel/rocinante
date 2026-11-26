using Microsoft.Data.Sqlite;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Squire;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores the squire's proposals in <c>proposal</c> and the paragraphs it read in <c>squire_paragraph</c>.</summary>
public sealed class ProposalRepository(ProjectDatabase database) : IProposalRepository
{
    private const string Fields =
        "id, document_id, paragraph, passage, created_at, state, element_name, element_kind, element_other, relation_from, relation_to, relation_forward, relation_inverse, detail_element, detail_name, detail_value, milestone_element, milestone_text";

    public void Save(Proposal proposal)
    {
        ArgumentNullException.ThrowIfNull(proposal);

        database.InTransaction(() => database.Execute(
            $"""
            INSERT INTO proposal ({Fields}, kind, proposal_key)
            VALUES ($id, $document, $paragraph, $passage, $created, $state, $elementName, $elementKind, $elementOther,
                    $from, $to, $forward, $inverse, $detailElement, $detailName, $detailValue, $milestoneElement, $milestoneText,
                    $kind, $key)
            ON CONFLICT (id) DO UPDATE SET state = excluded.state;
            """,
            ("$id", Columns.Id(proposal.Id.Value)),
            ("$document", Columns.Id(proposal.DocumentId.Value)),
            ("$paragraph", proposal.Paragraph),
            ("$passage", proposal.Passage),
            ("$created", Columns.Time(proposal.CreatedAt)),
            ("$state", State(proposal.State)),
            ("$elementName", proposal.Element?.Name),
            ("$elementKind", proposal.Element is { } element ? Columns.Kind(element.Kind) : null),
            ("$elementOther", proposal.Element?.OtherKind),
            ("$from", proposal.Relationship?.From),
            ("$to", proposal.Relationship?.To),
            ("$forward", proposal.Relationship?.Forward),
            ("$inverse", proposal.Relationship?.Inverse),
            ("$detailElement", proposal.Attribute?.Element),
            ("$detailName", proposal.Attribute?.Name),
            ("$detailValue", proposal.Attribute?.Value),
            ("$milestoneElement", proposal.Milestone?.Element),
            ("$milestoneText", proposal.Milestone?.Text),
            ("$kind", proposal.Kind switch
            {
                ProposalKind.Element => "element",
                ProposalKind.Relationship => "relationship",
                ProposalKind.Attribute => "attribute",
                _ => "milestone",
            }),
            ("$key", proposal.Key)));
    }

    public Proposal Load(ProposalId id)
    {
        var found = Query($"SELECT {Fields} FROM proposal WHERE id = $id;", ("$id", Columns.Id(id.Value)));
        return found.Count == 1
            ? found[0]
            : throw new DomainException(DomainError.ProposalNotFound, $"Proposal {id} does not exist.");
    }

    public IReadOnlyList<Proposal> Pending() =>
        Query(
            $"""
            SELECT {Fields} FROM proposal
            WHERE state = 'pending' AND document_id IN (SELECT id FROM document WHERE deleted_at IS NULL)
            ORDER BY created_at DESC, id DESC;
            """);

    public IReadOnlySet<string> KeysOf(DocumentId documentId, string paragraph)
    {
        using var command = database.Command(
            "SELECT proposal_key FROM proposal WHERE document_id = $document AND paragraph = $paragraph;",
            ("$document", Columns.Id(documentId.Value)),
            ("$paragraph", paragraph));
        using var reader = command.ExecuteReader();
        var keys = new HashSet<string>(StringComparer.Ordinal);
        while (reader.Read())
        {
            keys.Add(reader.GetString(0));
        }

        return keys;
    }

    public bool WasRead(DocumentId documentId, string paragraph)
    {
        using var command = database.Command(
            "SELECT 1 FROM squire_paragraph WHERE document_id = $document AND paragraph = $paragraph;",
            ("$document", Columns.Id(documentId.Value)),
            ("$paragraph", paragraph));
        return command.ExecuteScalar() is not null;
    }

    public void MarkRead(DocumentId documentId, string paragraph, DateTimeOffset now) =>
        database.InTransaction(() => database.Execute(
            "INSERT INTO squire_paragraph (document_id, paragraph, read_at) VALUES ($document, $paragraph, $now) ON CONFLICT DO NOTHING;",
            ("$document", Columns.Id(documentId.Value)),
            ("$paragraph", paragraph),
            ("$now", Columns.Time(now))));

    public bool SquireEnabled()
    {
        using var command = database.Command("SELECT squire_enabled FROM project LIMIT 1;");
        return command.ExecuteScalar() is long enabled && enabled != 0;
    }

    public void SetSquireEnabled(bool enabled) =>
        database.InTransaction(() => database.Execute(
            "UPDATE project SET squire_enabled = $enabled;", ("$enabled", Columns.Flag(enabled))));

    private List<Proposal> Query(string sql, params (string Name, object? Value)[] parameters)
    {
        using var command = database.Command(sql, parameters);
        using var reader = command.ExecuteReader();
        var found = new List<Proposal>();
        while (reader.Read())
        {
            found.Add(Read(reader));
        }

        return found;
    }

    private static Proposal Read(SqliteDataReader reader) =>
        Proposal.Rehydrate(
            new ProposalId(reader.GetId(0)),
            new DocumentId(reader.GetId(1)),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetTime(4),
            reader.IsDBNull(6) ? null : new ProposedElement(reader.GetString(6), reader.GetElementKind(7), reader.GetNullableString(8)),
            reader.IsDBNull(9)
                ? null
                : new ProposedRelationship(reader.GetString(9), reader.GetString(10), reader.GetString(11), reader.GetNullableString(12)),
            reader.IsDBNull(13) ? null : new ProposedDetail(reader.GetString(13), reader.GetString(14), reader.GetString(15)),
            reader.IsDBNull(16) ? null : new ProposedMilestone(reader.GetString(16), reader.GetString(17)),
            reader.GetString(5) switch
            {
                "accepted" => ProposalState.Accepted,
                "dismissed" => ProposalState.Dismissed,
                _ => ProposalState.Pending,
            });

    private static string State(ProposalState state) => state switch
    {
        ProposalState.Accepted => "accepted",
        ProposalState.Dismissed => "dismissed",
        _ => "pending",
    };
}
