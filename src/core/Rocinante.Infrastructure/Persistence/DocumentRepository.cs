using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores the text of each document: the text columns of <c>document</c>.</summary>
public sealed class DocumentRepository(ProjectDatabase database)
{
    public Document Load(DocumentId id)
    {
        using var command = database.Command(
            """
            SELECT content, revision, updated_at, active_writing_ms, last_edit_at, unversioned_changes
            FROM document WHERE id = $id;
            """,
            ("$id", Columns.Id(id.Value)));
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw NotFound(id);
        }

        var session = new WritingSession(
            TimeSpan.FromMilliseconds(reader.GetInt64(3)),
            reader.GetNullableTime(4),
            reader.GetBoolean(5));
        return Document.Rehydrate(id, DocumentContent.Parse(reader.GetString(0)), reader.GetInt64(1), reader.GetTime(2), session);
    }

    /// <summary>Saves the text, its counts and the writing session. The document's index entry must exist.</summary>
    public void Save(Document document)
    {
        ArgumentNullException.ThrowIfNull(document);

        var statistics = document.Content.Statistics;
        var updated = database.InTransaction(() => database.Execute(
            """
            UPDATE document SET
                content = $content,
                revision = $revision,
                updated_at = $updatedAt,
                words = $words,
                characters = $characters,
                paragraphs = $paragraphs,
                active_writing_ms = $activeWritingMs,
                last_edit_at = $lastEditAt,
                unversioned_changes = $unversionedChanges
            WHERE id = $id;
            """,
            ("$id", Columns.Id(document.Id.Value)),
            ("$content", document.Content.Json),
            ("$revision", document.Revision),
            ("$updatedAt", Columns.Time(document.UpdatedAt)),
            ("$words", statistics.Words),
            ("$characters", statistics.Characters),
            ("$paragraphs", statistics.Paragraphs),
            ("$activeWritingMs", (long)document.Session.ActiveTime.TotalMilliseconds),
            ("$lastEditAt", Columns.Time(document.Session.LastEditAt)),
            ("$unversionedChanges", document.Session.HasUnversionedChanges)));

        if (updated == 0)
        {
            throw NotFound(document.Id);
        }
    }

    /// <summary>Counts of the whole work: every chapter that is not in the trash. Fragments are not part of the work.</summary>
    public TextStatistics WorkStatistics()
    {
        using var command = database.Command(
            """
            SELECT coalesce(sum(words), 0), coalesce(sum(characters), 0), coalesce(sum(paragraphs), 0)
            FROM document WHERE kind = 'chapter' AND deleted_at IS NULL;
            """);
        using var reader = command.ExecuteReader();
        reader.Read();
        return new TextStatistics(reader.GetInt32(0), reader.GetInt32(1), reader.GetInt32(2));
    }

    private static DomainException NotFound(DocumentId id) =>
        new(DomainError.DocumentNotFound, $"Document {id} is not in this project.");
}
