using Microsoft.Data.Sqlite;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Notes;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores notes in <c>note</c>, and the elements each is linked with in <c>note_element</c>.</summary>
public sealed class NoteRepository(ProjectDatabase database) : INoteRepository
{
    private const string Columns =
        "note.id, note.document_id, note.text, note.content, note.anchored, note.anchor_order, note.resolved_at, note.created_at, note.updated_at, note.deleted_at";

    /// <summary>Inserts a new note or updates an existing one, with its links.</summary>
    public void Save(Note note)
    {
        ArgumentNullException.ThrowIfNull(note);

        database.InTransaction(() =>
        {
            database.Execute(
                """
                INSERT INTO note (id, document_id, text, content, anchored, anchor_order, resolved_at, created_at, updated_at, deleted_at)
                VALUES ($id, $documentId, $text, $content, $anchored, $anchorOrder, $resolvedAt, $createdAt, $updatedAt, $deletedAt)
                ON CONFLICT (id) DO UPDATE SET
                    text = excluded.text,
                    content = excluded.content,
                    anchored = excluded.anchored,
                    anchor_order = excluded.anchor_order,
                    resolved_at = excluded.resolved_at,
                    updated_at = excluded.updated_at,
                    deleted_at = excluded.deleted_at;
                """,
                ("$id", Persistence.Columns.Id(note.Id.Value)),
                ("$documentId", note.DocumentId is { } document ? Persistence.Columns.Id(document.Value) : null),
                ("$text", note.Text),
                ("$content", note.Content.Json),
                ("$anchored", note.IsAnchored),
                ("$anchorOrder", note.AnchorOrder),
                ("$resolvedAt", Persistence.Columns.Time(note.ResolvedAt)),
                ("$createdAt", Persistence.Columns.Time(note.CreatedAt)),
                ("$updatedAt", Persistence.Columns.Time(note.UpdatedAt)),
                ("$deletedAt", Persistence.Columns.Time(note.DeletedAt)));

            database.Execute("DELETE FROM note_element WHERE note_id = $id;", ("$id", Persistence.Columns.Id(note.Id.Value)));
            for (var position = 0; position < note.Elements.Count; position++)
            {
                database.Execute(
                    "INSERT INTO note_element (note_id, element_id, position) VALUES ($note, $element, $position);",
                    ("$note", Persistence.Columns.Id(note.Id.Value)),
                    ("$element", Persistence.Columns.Id(note.Elements[position].Value)),
                    ("$position", position));
            }

            return 0;
        });
    }

    /// <summary>A note, shown or set aside.</summary>
    public Note Load(NoteId id)
    {
        var notes = Query($"SELECT {Columns} FROM note WHERE note.id = $id;", ("$id", Persistence.Columns.Id(id.Value)));
        return notes.Count == 1
            ? notes[0]
            : throw new DomainException(DomainError.NoteNotFound, $"Note {id} does not exist.");
    }

    /// <summary>
    /// The notes the writer sees, in the order they were written: loose ideas and the notes of the
    /// documents in the work, leaving out those set aside and those of documents in the trash.
    /// </summary>
    public IReadOnlyList<Note> ListShown() =>
        Query(
            $"""
            SELECT {Columns} FROM note
            LEFT JOIN document ON document.id = note.document_id
            WHERE note.deleted_at IS NULL AND (note.document_id IS NULL OR document.deleted_at IS NULL)
            ORDER BY note.created_at, note.id;
            """);

    /// <summary>Every note of a document, set aside or not, in the order they were written.</summary>
    public IReadOnlyList<Note> ListByDocument(DocumentId documentId) =>
        Query(
            $"SELECT {Columns} FROM note WHERE note.document_id = $documentId ORDER BY note.created_at, note.id;",
            ("$documentId", Persistence.Columns.Id(documentId.Value)));

    /// <summary>Deletes a note for good, with its links. Returns whether it existed.</summary>
    public bool Delete(NoteId id) =>
        database.InTransaction(() => database.Execute("DELETE FROM note WHERE id = $id;", ("$id", Persistence.Columns.Id(id.Value)))) > 0;

    /// <summary>Deletes for good every note that was set aside. Returns how many there were.</summary>
    public int PurgeDeleted() =>
        database.InTransaction(() => database.Execute("DELETE FROM note WHERE deleted_at IS NOT NULL;"));

    private List<Note> Query(string sql, params (string Name, object? Value)[] parameters)
    {
        var rows = new List<Row>();
        using (var command = database.Command(sql, parameters))
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                rows.Add(Row.Read(reader));
            }
        }

        var links = rows.Count == 0 ? [] : Links(rows.Count == 1 ? rows[0].Id : null);
        return [.. rows.Select(row => row.ToNote(links.TryGetValue(row.Id, out var elements) ? elements : []))];
    }

    /// <summary>The elements linked with one note, or with every note when <paramref name="only"/> is null.</summary>
    private Dictionary<Guid, List<ElementId>> Links(Guid? only)
    {
        using var command = only is { } id
            ? database.Command(
                "SELECT note_id, element_id FROM note_element WHERE note_id = $id ORDER BY position;",
                ("$id", Persistence.Columns.Id(id)))
            : database.Command("SELECT note_id, element_id FROM note_element ORDER BY note_id, position;");
        using var reader = command.ExecuteReader();

        var links = new Dictionary<Guid, List<ElementId>>();
        while (reader.Read())
        {
            var note = reader.GetId(0);
            if (!links.TryGetValue(note, out var elements))
            {
                links[note] = elements = [];
            }

            elements.Add(new ElementId(reader.GetId(1)));
        }

        return links;
    }

    private sealed record Row(
        Guid Id,
        Guid? DocumentId,
        string Text,
        string? Content,
        bool Anchored,
        int? AnchorOrder,
        DateTimeOffset? ResolvedAt,
        DateTimeOffset CreatedAt,
        DateTimeOffset UpdatedAt,
        DateTimeOffset? DeletedAt)
    {
        public static Row Read(SqliteDataReader reader) =>
            new(
                reader.GetId(0),
                reader.IsDBNull(1) ? null : reader.GetId(1),
                reader.GetString(2),
                reader.GetNullableString(3),
                reader.GetBoolean(4),
                reader.IsDBNull(5) ? null : reader.GetInt32(5),
                reader.GetNullableTime(6),
                reader.GetTime(7),
                reader.GetTime(8),
                reader.GetNullableTime(9));

        public Note ToNote(IEnumerable<ElementId> elements) =>
            Note.Rehydrate(
                new NoteId(Id),
                DocumentId is { } document ? new DocumentId(document) : null,
                Content is null ? null : DocumentContent.Parse(Content),
                Text,
                Anchored,
                AnchorOrder,
                ResolvedAt,
                elements,
                CreatedAt,
                UpdatedAt,
                DeletedAt);
    }
}
