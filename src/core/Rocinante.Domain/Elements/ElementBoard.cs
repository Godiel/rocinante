namespace Rocinante.Domain.Elements;

/// <summary>
/// The elements of a work, the relationships between them and the kinds of relationship the writer wrote.
/// An element in the trash keeps its relationships, hidden, so restoring it brings them back.
/// </summary>
public sealed class ElementBoard
{
    /// <summary>The room a card takes on the board, with some air around it, when looking for a free place.</summary>
    public const double CardWidth = 260;

    public const double CardHeight = 120;

    private const int MaxRings = 200;

    private readonly Dictionary<ElementId, Element> _elements = [];
    private readonly List<Relationship> _relationships = [];
    private readonly List<RelationshipKind> _ownKinds = [];

    /// <summary>Elements in the work, in no particular order.</summary>
    public IEnumerable<Element> Elements => _elements.Values.Where(element => !element.IsDeleted);

    /// <summary>Elements in the trash, most recently deleted first.</summary>
    public IEnumerable<Element> Trash => _elements.Values.Where(element => element.IsDeleted).OrderByDescending(element => element.DeletedAt);

    /// <summary>Relationships whose two elements are in the work.</summary>
    public IEnumerable<Relationship> Relationships => _relationships.Where(IsVisible);

    public IReadOnlyList<RelationshipKind> OwnKinds => _ownKinds;

    public static ElementBoard Rehydrate(
        IEnumerable<Element> elements,
        IEnumerable<Relationship> relationships,
        IEnumerable<RelationshipKind> ownKinds)
    {
        ArgumentNullException.ThrowIfNull(elements);
        ArgumentNullException.ThrowIfNull(relationships);
        ArgumentNullException.ThrowIfNull(ownKinds);

        var board = new ElementBoard();
        foreach (var element in elements)
        {
            board._elements[element.Id] = element;
        }

        board._ownKinds.AddRange(ownKinds);
        board._relationships.AddRange(relationships.Where(relationship =>
            board._elements.ContainsKey(relationship.From) && board._elements.ContainsKey(relationship.To)));
        return board;
    }

    /// <summary>Creates an element at <paramref name="position"/>, or at the free place nearest the centre of the board.</summary>
    public Element Create(
        ElementKind kind,
        string? otherKind,
        string name,
        IEnumerable<ElementAttribute>? attributes,
        BoardPosition? position,
        DateTimeOffset now)
    {
        var element = Element.Create(kind, otherKind, name, attributes, position ?? FreePlaceNear(BoardPosition.Origin), now);
        _elements[element.Id] = element;
        return element;
    }

    /// <summary>An element in the work or in the trash.</summary>
    public Element Find(ElementId id) =>
        _elements.TryGetValue(id, out var element)
            ? element
            : throw new DomainException(DomainError.ElementNotFound, $"Element {id} is not in the work.");

    /// <summary>An element in the work: one in the trash must be restored before it changes.</summary>
    public Element InWork(ElementId id)
    {
        var element = Find(id);
        return element.IsDeleted
            ? throw new DomainException(DomainError.ElementIsDeleted, $"Element {id} is in the trash.")
            : element;
    }

    /// <summary>Sends an element to the trash. Its relationships stay with it, hidden.</summary>
    public void Delete(ElementId id, DateTimeOffset now) => InWork(id).DeletedAt = now;

    /// <summary>Brings an element back with its place on the board and its relationships.</summary>
    public void Restore(ElementId id)
    {
        var element = Find(id);
        if (!element.IsDeleted)
        {
            throw new DomainException(DomainError.ElementIsNotDeleted, $"Element {id} is not in the trash.");
        }

        element.DeletedAt = null;
    }

    /// <summary>Moves cards on the board; either all of them move or none does.</summary>
    public void Move(IEnumerable<(ElementId Id, BoardPosition Position)> positions)
    {
        ArgumentNullException.ThrowIfNull(positions);

        var moves = positions.Select(move => (Element: InWork(move.Id), move.Position)).ToList();
        foreach (var (element, position) in moves)
        {
            element.MoveTo(position);
        }
    }

    /// <summary>
    /// The free place nearest <paramref name="centre"/>, looking ring by ring around it, where a card would not
    /// cover another card in the work.
    /// </summary>
    public BoardPosition FreePlaceNear(BoardPosition centre)
    {
        var taken = Elements.Select(element => element.Position).ToList();
        for (var ring = 0; ring <= MaxRings; ring++)
        {
            foreach (var (column, row) in Ring(ring))
            {
                var x = centre.X + (column * CardWidth);
                var y = centre.Y + (row * CardHeight);
                if (Math.Abs(x) > BoardPosition.Limit || Math.Abs(y) > BoardPosition.Limit)
                {
                    continue;
                }

                if (!taken.Any(position => Math.Abs(position.X - x) < CardWidth && Math.Abs(position.Y - y) < CardHeight))
                {
                    return new BoardPosition(x, y);
                }
            }
        }

        return centre;
    }

    /// <summary>Joins two elements in the work with a kind that exists: a common one or one of this work.</summary>
    public Relationship Relate(ElementId from, ElementId to, RelationshipKindId kind, DateTimeOffset now)
    {
        InWork(from);
        InWork(to);
        var relationship = Relationship.Create(from, to, kind, now);
        EnsureNotRepeated(from, to, kind, except: null);
        _relationships.Add(relationship);
        return relationship;
    }

    /// <summary>
    /// The kind of this work that reads like the given words, writing it down first if there is none yet. A writer
    /// who types the same pair twice gets the same kind.
    /// </summary>
    public RelationshipKind OwnKind(string forward, string? inverse, DateTimeOffset now)
    {
        var existing = _ownKinds.FirstOrDefault(kind => kind.ReadsAs(forward, inverse));
        if (existing is not null)
        {
            return existing;
        }

        var created = RelationshipKind.Create(forward, inverse, now);
        _ownKinds.Add(created);
        return created;
    }

    /// <summary>Gives a relationship another kind.</summary>
    public Relationship ChangeKind(RelationshipId id, RelationshipKindId kind)
    {
        var relationship = FindRelationship(id);
        EnsureKindExists(kind);
        EnsureNotRepeated(relationship.From, relationship.To, kind, except: relationship);
        relationship.Kind = kind;
        return relationship;
    }

    /// <summary>
    /// Sets the chapters a relationship holds between; the caller checks them with
    /// <see cref="Relationship.EnsureBounds"/>, which needs the index of the work.
    /// </summary>
    public Relationship SetBounds(RelationshipId id, DocumentId? starts, DocumentId? ends)
    {
        var relationship = FindRelationship(id);
        relationship.Starts = starts;
        relationship.Ends = ends;
        return relationship;
    }

    public void Unrelate(RelationshipId id) => _relationships.Remove(FindRelationship(id));

    /// <summary>The relationships of an element, including the hidden ones of an element in the trash.</summary>
    public IEnumerable<Relationship> RelationshipsOf(ElementId id) => _relationships.Where(relationship => relationship.Touches(id));

    /// <summary>A relationship that is shown: both its elements are in the work.</summary>
    public Relationship FindRelationship(RelationshipId id) =>
        _relationships.FirstOrDefault(relationship => relationship.Id == id && IsVisible(relationship))
        ?? throw new DomainException(DomainError.RelationshipNotFound, $"Relationship {id} is not in the work.");

    private bool IsVisible(Relationship relationship) =>
        !_elements[relationship.From].IsDeleted && !_elements[relationship.To].IsDeleted;

    private void EnsureKindExists(RelationshipKindId kind)
    {
        if (kind.Own is { } own && _ownKinds.All(existing => existing.Id != own))
        {
            throw new DomainException(DomainError.RelationshipKindNotFound, $"Relationship kind {kind} is not in the work.");
        }
    }

    private void EnsureNotRepeated(ElementId from, ElementId to, RelationshipKindId kind, Relationship? except)
    {
        EnsureKindExists(kind);
        var symmetric = kind.Own is { } own && _ownKinds.First(existing => existing.Id == own).IsSymmetric;
        if (_relationships.Any(relationship => relationship != except && relationship.Repeats(from, to, kind, symmetric)))
        {
            throw new DomainException(DomainError.RelationshipRepeated, "Those two elements already have that relationship.");
        }
    }

    /// <summary>The cells at distance <paramref name="ring"/> from the centre, clockwise from the top-left corner.</summary>
    private static IEnumerable<(int Column, int Row)> Ring(int ring)
    {
        if (ring == 0)
        {
            yield return (0, 0);
            yield break;
        }

        for (var column = -ring; column < ring; column++)
        {
            yield return (column, -ring);
        }

        for (var row = -ring; row < ring; row++)
        {
            yield return (ring, row);
        }

        for (var column = ring; column > -ring; column--)
        {
            yield return (column, ring);
        }

        for (var row = ring; row > -ring; row--)
        {
            yield return (-ring, row);
        }
    }
}
