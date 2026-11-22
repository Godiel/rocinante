namespace Rocinante.Domain.Elements;

/// <summary>Two elements joined by a kind: it reads forward from <see cref="From"/> and inverse from <see cref="To"/>.</summary>
public sealed class Relationship
{
    private Relationship(RelationshipId id, ElementId from, ElementId to, RelationshipKindId kind)
    {
        Id = id;
        From = from;
        To = to;
        Kind = kind;
    }

    public RelationshipId Id { get; }

    public ElementId From { get; }

    public ElementId To { get; }

    public RelationshipKindId Kind { get; internal set; }

    internal static Relationship Create(ElementId from, ElementId to, RelationshipKindId kind, DateTimeOffset now) =>
        from == to
            ? throw new DomainException(DomainError.SameElement, "An element cannot be related to itself.")
            : new Relationship(RelationshipId.New(now), from, to, kind);

    public static Relationship Rehydrate(RelationshipId id, ElementId from, ElementId to, RelationshipKindId kind) =>
        new(id, from, to, kind);

    public bool Touches(ElementId element) => From == element || To == element;

    /// <summary>Whether it joins the same two elements with the same kind, either way round when the kind reads the same from both sides.</summary>
    internal bool Repeats(ElementId from, ElementId to, RelationshipKindId kind, bool symmetric) =>
        Kind == kind && ((From == from && To == to) || (symmetric && From == to && To == from));
}
