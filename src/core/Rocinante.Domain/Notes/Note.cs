using Rocinante.Domain.Content;

namespace Rocinante.Domain.Notes;

/// <summary>
/// Something the writer wants to remember about the work. It belongs to a document, anchored in
/// its text or loose in it, or to no document at all: a loose idea of the work. Its text lives
/// here, never in the document: the document only holds an anchor with the note's id, so notes
/// stay out of the work, its counts and its exports.
/// </summary>
public sealed class Note
{
    public const int MaxTextLength = 10_000;

    public const int MaxElements = 50;

    private List<ElementId> _elements;

    private Note(
        NoteId id,
        DocumentId? documentId,
        DocumentContent content,
        bool isAnchored,
        int? anchorOrder,
        DateTimeOffset? resolvedAt,
        List<ElementId> elements,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt,
        DateTimeOffset? deletedAt)
    {
        Id = id;
        DocumentId = documentId;
        Content = content;
        IsAnchored = isAnchored;
        AnchorOrder = anchorOrder;
        ResolvedAt = resolvedAt;
        _elements = elements;
        CreatedAt = createdAt;
        UpdatedAt = updatedAt;
        DeletedAt = deletedAt;
    }

    public NoteId Id { get; }

    /// <summary>The document the note belongs to, or null for a loose idea of the work.</summary>
    public DocumentId? DocumentId { get; }

    public DocumentContent Content { get; private set; }

    /// <summary>The words of the note, derived from its content: what the writer searches and sees in a list.</summary>
    public string Text => Content.PlainText;

    /// <summary>
    /// Whether the document's text still contains this note's anchor. A note whose passage was
    /// deleted is loose in its document and is not lost; a loose idea is never anchored.
    /// </summary>
    public bool IsAnchored { get; private set; }

    /// <summary>
    /// The place of this note's anchor among the anchors of its document, from the last time the
    /// text was saved. Null while the note is not anchored, or until its anchor is first saved.
    /// </summary>
    public int? AnchorOrder { get; private set; }

    public DateTimeOffset? ResolvedAt { get; private set; }

    public bool IsResolved => ResolvedAt is not null;

    /// <summary>The elements the note is linked with, each once, in the order they were linked.</summary>
    public IReadOnlyList<ElementId> Elements => _elements;

    public DateTimeOffset CreatedAt { get; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>When the note was set aside; null while it is shown.</summary>
    public DateTimeOffset? DeletedAt { get; private set; }

    public bool IsDeleted => DeletedAt is not null;

    /// <summary>
    /// Creates a note. Only a note on a document can be anchored: an anchored note expects the
    /// editor to place its anchor in the text, and <see cref="Reconcile"/> settles it with the
    /// next save either way.
    /// </summary>
    public static Note Create(
        DocumentId? documentId,
        DocumentContent content,
        bool anchored,
        IEnumerable<ElementId> elements,
        DateTimeOffset now) =>
        new(
            NoteId.New(now),
            documentId,
            Valid(content),
            anchored && documentId is not null,
            anchorOrder: null,
            resolvedAt: null,
            Distinct(elements),
            now,
            now,
            deletedAt: null);

    /// <summary>
    /// Rebuilds a note from storage. A note written before notes had formatting has no content,
    /// only text: it is read as one paragraph per line.
    /// </summary>
    public static Note Rehydrate(
        NoteId id,
        DocumentId? documentId,
        DocumentContent? content,
        string legacyText,
        bool isAnchored,
        int? anchorOrder,
        DateTimeOffset? resolvedAt,
        IEnumerable<ElementId> elements,
        DateTimeOffset createdAt,
        DateTimeOffset updatedAt,
        DateTimeOffset? deletedAt) =>
        new(
            id,
            documentId,
            content ?? DocumentContent.FromPlainText(legacyText),
            isAnchored,
            anchorOrder,
            resolvedAt,
            [.. elements],
            createdAt,
            updatedAt,
            deletedAt);

    /// <summary>Changes the text of the note.</summary>
    /// <returns>Whether anything changed.</returns>
    public bool Edit(DocumentContent content, DateTimeOffset now)
    {
        EnsureShown();
        Valid(content);
        if (content.Equals(Content))
        {
            return false;
        }

        Content = content;
        UpdatedAt = now;
        return true;
    }

    /// <returns>Whether anything changed.</returns>
    public bool Resolve(DateTimeOffset now)
    {
        EnsureShown();
        if (IsResolved)
        {
            return false;
        }

        ResolvedAt = now;
        UpdatedAt = now;
        return true;
    }

    /// <returns>Whether anything changed.</returns>
    public bool Reopen(DateTimeOffset now)
    {
        EnsureShown();
        if (!IsResolved)
        {
            return false;
        }

        ResolvedAt = null;
        UpdatedAt = now;
        return true;
    }

    /// <summary>Links the note with exactly these elements, in this order.</summary>
    /// <returns>Whether anything changed.</returns>
    public bool LinkWith(IEnumerable<ElementId> elements, DateTimeOffset now)
    {
        EnsureShown();
        var linked = Distinct(elements);
        if (linked.SequenceEqual(_elements))
        {
            return false;
        }

        _elements = linked;
        UpdatedAt = now;
        return true;
    }

    /// <summary>Sets the note aside. Its anchor, if it has one, stays in the text, hidden.</summary>
    public void Delete(DateTimeOffset now)
    {
        EnsureShown();
        DeletedAt = now;
    }

    /// <summary>Brings back a note that was set aside, as it was.</summary>
    public void Restore()
    {
        if (!IsDeleted)
        {
            throw new DomainException(DomainError.NoteIsNotDeleted, $"Note {Id} is not deleted.");
        }

        DeletedAt = null;
    }

    /// <summary>
    /// Updates <see cref="IsAnchored"/> and <see cref="AnchorOrder"/> from the document's current
    /// text. Works both ways: deleting the passage makes the note loose, and undoing the deletion
    /// anchors it again.
    /// </summary>
    /// <returns>Whether the note changed and must be stored.</returns>
    public bool Reconcile(DocumentContent content)
    {
        ArgumentNullException.ThrowIfNull(content);

        if (DocumentId is null)
        {
            return false;
        }

        var index = IndexOf(content.NoteAnchors, Id);
        int? order = index < 0 ? null : index;
        if (order == AnchorOrder && (order is not null) == IsAnchored)
        {
            return false;
        }

        IsAnchored = order is not null;
        AnchorOrder = order;
        return true;
    }

    private void EnsureShown()
    {
        if (IsDeleted)
        {
            throw new DomainException(DomainError.NoteIsDeleted, $"Note {Id} is deleted.");
        }
    }

    private static int IndexOf(IReadOnlyList<NoteId> anchors, NoteId id)
    {
        for (var index = 0; index < anchors.Count; index++)
        {
            if (anchors[index] == id)
            {
                return index;
            }
        }

        return -1;
    }

    private static List<ElementId> Distinct(IEnumerable<ElementId> elements)
    {
        ArgumentNullException.ThrowIfNull(elements);

        var linked = elements.Distinct().ToList();
        return linked.Count <= MaxElements
            ? linked
            : throw new ArgumentException($"A note links with at most {MaxElements} elements.", nameof(elements));
    }

    private static DocumentContent Valid(DocumentContent content)
    {
        ArgumentNullException.ThrowIfNull(content);

        if (string.IsNullOrWhiteSpace(content.PlainText))
        {
            throw new DomainException(DomainError.NoteTextRequired, "A note needs some text.");
        }

        return content.PlainText.Length <= MaxTextLength
            ? content
            : throw new DomainException(
                DomainError.NoteTextTooLong,
                $"A note cannot exceed {MaxTextLength} characters.");
    }
}
