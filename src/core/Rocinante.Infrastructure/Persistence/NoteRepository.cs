using Microsoft.Data.Sqlite;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Notes;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores notes in <c>note</c>.</summary>
public sealed class NoteRepository(ProjectDatabase database) : INoteRepository
{
    /// <summary>Inserts a new note or updates an existing one.</summary>
    public void Save(Note note)
    {
        ArgumentNullException.ThrowIfNull(note);

        database.InTransaction(() => database.Execute(
            """
            INSERT INTO note (id, document_id, text, anchored, created_at, updated_at)
            VALUES ($id, $documentId, $text, $anchored, $createdAt, $updatedAt)
            ON CONFLICT (id) DO UPDATE SET
                text = excluded.text,
                anchored = excluded.anchored,
                updated_at = excluded.updated_at;
            """,
            ("$id", Columns.Id(note.Id.Value)),
            ("$documentId", Columns.Id(note.DocumentId!.Value.Value)),
            ("$text", note.Text),
            ("$anchored", note.IsAnchored),
            ("$createdAt", Columns.Time(note.CreatedAt)),
            ("$updatedAt", Columns.Time(note.UpdatedAt))));
    }

    public Note Load(NoteId id)
    {
        using var command = database.Command(
            "SELECT id, document_id, text, anchored, created_at, updated_at FROM note WHERE id = $id;",
            ("$id", Columns.Id(id.Value)));
        using var reader = command.ExecuteReader();
        return reader.Read()
            ? Read(reader)
            : throw new DomainException(DomainError.NoteNotFound, $"Note {id} does not exist.");
    }

    /// <summary>Notes of a document, in the order they were written.</summary>
    public IReadOnlyList<Note> ListByDocument(DocumentId documentId)
    {
        using var command = database.Command(
            """
            SELECT id, document_id, text, anchored, created_at, updated_at
            FROM note WHERE document_id = $documentId
            ORDER BY created_at, id;
            """,
            ("$documentId", Columns.Id(documentId.Value)));
        using var reader = command.ExecuteReader();

        var notes = new List<Note>();
        while (reader.Read())
        {
            notes.Add(Read(reader));
        }

        return notes;
    }

    /// <summary>Deletes a note for good. Returns whether it existed.</summary>
    public bool Delete(NoteId id) =>
        database.InTransaction(() => database.Execute("DELETE FROM note WHERE id = $id;", ("$id", Columns.Id(id.Value)))) > 0;

    private static Note Read(SqliteDataReader reader) =>
        Note.Rehydrate(
            new NoteId(reader.GetId(0)),
            new DocumentId(reader.GetId(1)),
            content: null,
            legacyText: reader.GetString(2),
            reader.GetBoolean(3),
            anchorOrder: null,
            resolvedAt: null,
            elements: [],
            reader.GetTime(4),
            reader.GetTime(5),
            deletedAt: null);
}
