using Rocinante.Domain.Content;

namespace Rocinante.Domain.Notes;

/// <summary>
/// Something the writer wants to remember about a document. Its text lives here, never in the
/// document: the document only holds an anchor with the note's id, so notes stay out of the work,
/// its counts and its exports.
/// </summary>
public sealed class Note
{
    public const int MaxTextLength = 10_000;

    private Note(NoteId id, DocumentId documentId, string text, bool isAnchored, DateTimeOffset createdAt, DateTimeOffset updatedAt)
    {
        Id = id;
        DocumentId = documentId;
        Text = text;
        IsAnchored = isAnchored;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
    }

    public NoteId Id { get; }

    public DocumentId DocumentId { get; }

    public string Text { get; private set; }

    /// <summary>
    /// Whether the document's text still contains this note's anchor. A note whose passage was
    /// deleted is loose: it still belongs to the document and is not lost.
    /// </summary>
    public bool IsAnchored { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>
    /// Creates a note. An anchored note expects the editor to place its anchor in the text;
    /// <see cref="Reconcile"/> settles it with the next save either way.
    /// </summary>
    public static Note Create(DocumentId documentId, string text, bool anchored, DateTimeOffset now) =>
        new(NoteId.New(now), documentId, NormalizeText(text), anchored, now, now);

    /// <summary>Rebuilds a note from storage.</summary>
    public static Note Rehydrate(NoteId id, DocumentId documentId, string text, bool isAnchored, DateTimeOffset createdAt, DateTimeOffset updatedAt) =>
        new(id, documentId, text, isAnchored, createdAt, updatedAt);

    public void Edit(string text, DateTimeOffset now)
    {
        Text = NormalizeText(text);
        UpdatedAt = now;
    }

    /// <summary>
    /// Updates <see cref="IsAnchored"/> from the document's current text. Works both ways: deleting
    /// the passage makes the note loose, and undoing the deletion anchors it again.
    /// </summary>
    /// <returns>Whether the note changed and must be stored.</returns>
    public bool Reconcile(DocumentContent content)
    {
        ArgumentNullException.ThrowIfNull(content);

        var anchored = content.NoteAnchors.Contains(Id);
        if (anchored == IsAnchored)
        {
            return false;
        }

        IsAnchored = anchored;
        return true;
    }

    private static string NormalizeText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            throw new DomainException(DomainError.NoteTextRequired, "A note needs some text.");
        }

        return text.Length <= MaxTextLength
            ? text
            : throw new DomainException(
                DomainError.NoteTextTooLong,
                $"A note cannot exceed {MaxTextLength} characters.");
    }
}
