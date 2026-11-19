using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Versions;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores document versions in <c>document_version</c>. Versions are only added, never changed.</summary>
public sealed class VersionRepository(ProjectDatabase database) : IVersionRepository
{
    public void Add(DocumentVersion version)
    {
        ArgumentNullException.ThrowIfNull(version);

        var statistics = version.Content.Statistics;
        database.InTransaction(() => database.Execute(
            """
            INSERT INTO document_version (id, document_id, kind, name, created_at, content, words, characters, paragraphs)
            VALUES ($id, $documentId, $kind, $name, $createdAt, $content, $words, $characters, $paragraphs);
            """,
            ("$id", Columns.Id(version.Id.Value)),
            ("$documentId", Columns.Id(version.DocumentId.Value)),
            ("$kind", Columns.Kind(version.Kind)),
            ("$name", version.Name),
            ("$createdAt", Columns.Time(version.CreatedAt)),
            ("$content", version.Content.Json),
            ("$words", statistics.Words),
            ("$characters", statistics.Characters),
            ("$paragraphs", statistics.Paragraphs)));
    }

    /// <summary>Versions of a document, newest first.</summary>
    public IReadOnlyList<VersionSummary> List(DocumentId documentId)
    {
        using var command = database.Command(
            """
            SELECT id, kind, name, created_at, words, characters, paragraphs
            FROM document_version WHERE document_id = $documentId
            ORDER BY created_at DESC, id DESC;
            """,
            ("$documentId", Columns.Id(documentId.Value)));
        using var reader = command.ExecuteReader();

        var versions = new List<VersionSummary>();
        while (reader.Read())
        {
            versions.Add(new VersionSummary(
                new VersionId(reader.GetId(0)),
                documentId,
                reader.GetVersionKind(1),
                reader.GetNullableString(2),
                reader.GetTime(3),
                new TextStatistics(reader.GetInt32(4), reader.GetInt32(5), reader.GetInt32(6))));
        }

        return versions;
    }

    public DocumentVersion Load(VersionId id)
    {
        using var command = database.Command(
            "SELECT document_id, kind, name, created_at, content FROM document_version WHERE id = $id;",
            ("$id", Columns.Id(id.Value)));
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new DomainException(DomainError.VersionNotFound, $"Version {id} does not exist.");
        }

        return DocumentVersion.Rehydrate(
            id,
            new DocumentId(reader.GetId(0)),
            reader.GetVersionKind(1),
            reader.GetNullableString(2),
            reader.GetTime(3),
            DocumentContent.Parse(reader.GetString(4)));
    }
}
