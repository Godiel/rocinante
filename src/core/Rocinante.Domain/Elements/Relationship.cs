namespace Rocinante.Domain.Elements;

/// <summary>
/// Two elements joined by a kind: it reads forward from <see cref="From"/> and inverse from <see cref="To"/>. It
/// holds from the chapter <see cref="Starts"/> to the chapter <see cref="Ends"/>, both included; without them,
/// in the whole work.
/// </summary>
public sealed class Relationship
{
    private Relationship(RelationshipId id, ElementId from, ElementId to, RelationshipKindId kind, DocumentId? starts, DocumentId? ends)
    {
        Id = id;
        From = from;
        To = to;
        Kind = kind;
        Starts = starts;
        Ends = ends;
    }

    public RelationshipId Id { get; }

    public ElementId From { get; }

    public ElementId To { get; }

    public RelationshipKindId Kind { get; internal set; }

    /// <summary>The chapter it starts in, or <see langword="null"/> if it holds from the start of the work.</summary>
    public DocumentId? Starts { get; internal set; }

    /// <summary>The chapter it ends in, or <see langword="null"/> if it holds to the end of the work.</summary>
    public DocumentId? Ends { get; internal set; }

    internal static Relationship Create(ElementId from, ElementId to, RelationshipKindId kind, DateTimeOffset now) =>
        from == to
            ? throw new DomainException(DomainError.SameElement, "An element cannot be related to itself.")
            : new Relationship(RelationshipId.New(now), from, to, kind, null, null);

    public static Relationship Rehydrate(
        RelationshipId id, ElementId from, ElementId to, RelationshipKindId kind, DocumentId? starts = null, DocumentId? ends = null) =>
        new(id, from, to, kind, starts, ends);

    public bool Touches(ElementId element) => From == element || To == element;

    /// <summary>
    /// Checks that the chapters a relationship holds between are chapters of the work, the first not after the
    /// last. <paramref name="chapterAt"/> gives the place of a chapter in reading order, or null if it is not one.
    /// </summary>
    public static void EnsureBounds(DocumentId? starts, DocumentId? ends, Func<DocumentId, int?> chapterAt)
    {
        ArgumentNullException.ThrowIfNull(chapterAt);
        int? Place(DocumentId? chapter) => chapter is { } id
            ? chapterAt(id) ?? throw new DomainException(DomainError.RelationshipBounds, $"Document {id} is not a chapter of the work.")
            : null;

        var first = Place(starts);
        var last = Place(ends);
        if (first > last)
        {
            throw new DomainException(DomainError.RelationshipBounds, "A relationship cannot end before it starts.");
        }
    }

    /// <summary>
    /// Whether it holds in the chapter at <paramref name="place"/>. A limit whose chapter is no longer in the work
    /// (<paramref name="chapterAt"/> gives null) does not count.
    /// </summary>
    public bool HoldsAt(int place, Func<DocumentId, int?> chapterAt)
    {
        ArgumentNullException.ThrowIfNull(chapterAt);
        var first = Starts is { } starts ? chapterAt(starts) : null;
        var last = Ends is { } ends ? chapterAt(ends) : null;
        return (first is null || first <= place) && (last is null || place <= last);
    }

    /// <summary>Whether it joins the same two elements with the same kind, either way round when the kind reads the same from both sides.</summary>
    internal bool Repeats(ElementId from, ElementId to, RelationshipKindId kind, bool symmetric) =>
        Kind == kind && ((From == from && To == to) || (symmetric && From == to && To == from));
}
