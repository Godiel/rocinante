using Rocinante.Domain.Elements;

namespace Rocinante.Domain.Squire;

public enum ProposalKind
{
    Element,
    Relationship,
    Attribute,
    Milestone,
}

public enum ProposalState
{
    Pending,
    Accepted,
    Dismissed,
}

/// <summary>A ficha the squire saw in the text and the work does not have.</summary>
public sealed record ProposedElement(string Name, ElementKind Kind, string? OtherKind);

/// <summary>Two fichas, named, joined by a kind of relationship read from each side.</summary>
public sealed record ProposedRelationship(string From, string To, string Forward, string? Inverse);

/// <summary>Something the text says about a ficha: an attribute of it.</summary>
public sealed record ProposedDetail(string Element, string Name, string Value);

/// <summary>Something that happens to a ficha in the paragraph.</summary>
public sealed record ProposedMilestone(string Element, string Text);

/// <summary>
/// Something the squire deduced from a paragraph and proposes to the writer. Nothing of it enters the work
/// until the writer accepts it; dismissed, it is not proposed again for that paragraph.
/// </summary>
public sealed class Proposal
{
    public const int MaxPassageLength = 2000;

    private Proposal(
        ProposalId id,
        DocumentId documentId,
        string paragraph,
        string passage,
        DateTimeOffset createdAt,
        ProposedElement? element,
        ProposedRelationship? relationship,
        ProposedDetail? attribute,
        ProposedMilestone? milestone,
        ProposalState state)
    {
        Id = id;
        DocumentId = documentId;
        Paragraph = paragraph;
        Passage = passage;
        CreatedAt = createdAt;
        Element = element;
        Relationship = relationship;
        Attribute = attribute;
        Milestone = milestone;
        State = state;
    }

    public ProposalId Id { get; }

    public DocumentId DocumentId { get; }

    /// <summary>The fingerprint of the paragraph it comes from: the same text gives the same one.</summary>
    public string Paragraph { get; }

    /// <summary>The paragraph it comes from, as it was read.</summary>
    public string Passage { get; }

    public DateTimeOffset CreatedAt { get; }

    public ProposedElement? Element { get; }

    public ProposedRelationship? Relationship { get; }

    public ProposedDetail? Attribute { get; }

    public ProposedMilestone? Milestone { get; }

    public ProposalState State { get; private set; }

    public ProposalKind Kind =>
        Element is not null ? ProposalKind.Element
        : Relationship is not null ? ProposalKind.Relationship
        : Attribute is not null ? ProposalKind.Attribute
        : ProposalKind.Milestone;

    /// <summary>
    /// What makes two proposals the same, whatever their id: the same kind of thing about the same names. The
    /// squire does not propose again what is already waiting or was dismissed for a paragraph.
    /// </summary>
    public string Key => Kind switch
    {
        ProposalKind.Element => $"element:{MentionFinder.Key(Element!.Name)}",
        ProposalKind.Relationship =>
            $"relationship:{MentionFinder.Key(Relationship!.From)}:{MentionFinder.Key(Relationship.Forward)}:{MentionFinder.Key(Relationship.To)}",
        ProposalKind.Attribute => $"attribute:{MentionFinder.Key(Attribute!.Element)}:{MentionFinder.Key(Attribute.Name)}",
        _ => $"milestone:{MentionFinder.Key(Milestone!.Element)}:{MentionFinder.Key(Milestone.Text)}",
    };

    public static Proposal ForElement(DocumentId documentId, string paragraph, string passage, ProposedElement element, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(element);
        var valid = element with
        {
            Name = Names.Required(element.Name, Elements.Element.MaxNameLength, "A proposed element"),
            OtherKind = element.Kind == ElementKind.Other
                ? Names.Required(element.OtherKind, Elements.Element.MaxOtherKindLength, "The kind of a proposed element")
                : null,
        };
        return Create(documentId, paragraph, passage, now, valid, null, null);
    }

    public static Proposal ForRelationship(
        DocumentId documentId, string paragraph, string passage, ProposedRelationship relationship, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(relationship);
        var valid = new ProposedRelationship(
            Names.Required(relationship.From, Elements.Element.MaxNameLength, "A proposed relationship"),
            Names.Required(relationship.To, Elements.Element.MaxNameLength, "A proposed relationship"),
            Names.Required(relationship.Forward, RelationshipKind.MaxLabelLength, "A proposed relationship"),
            string.IsNullOrWhiteSpace(relationship.Inverse)
                ? null
                : Names.Required(relationship.Inverse, RelationshipKind.MaxLabelLength, "A proposed relationship"));
        if (MentionFinder.Key(valid.From) == MentionFinder.Key(valid.To))
        {
            throw new DomainException(DomainError.SameElement, "A proposed relationship joins an element with itself.");
        }

        return Create(documentId, paragraph, passage, now, null, valid, null);
    }

    public static Proposal ForAttribute(DocumentId documentId, string paragraph, string passage, ProposedDetail attribute, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(attribute);
        var valid = new ProposedDetail(
            Names.Required(attribute.Element, Elements.Element.MaxNameLength, "A proposed attribute"),
            Names.Required(attribute.Name, ElementAttribute.MaxNameLength, "A proposed attribute"),
            Names.Bounded(attribute.Value?.Trim() ?? string.Empty, ElementAttribute.MaxValueLength, "A proposed attribute"));
        return Create(documentId, paragraph, passage, now, null, null, valid);
    }

    public static Proposal ForMilestone(DocumentId documentId, string paragraph, string passage, ProposedMilestone milestone, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(milestone);
        var valid = new ProposedMilestone(
            Names.Required(milestone.Element, Elements.Element.MaxNameLength, "A proposed milestone"),
            Names.Required(milestone.Text, Threads.Milestone.MaxTextLength, "A proposed milestone"));
        return Create(documentId, paragraph, passage, now, null, null, null, valid);
    }

    /// <summary>Rebuilds a proposal from storage.</summary>
    public static Proposal Rehydrate(
        ProposalId id,
        DocumentId documentId,
        string paragraph,
        string passage,
        DateTimeOffset createdAt,
        ProposedElement? element,
        ProposedRelationship? relationship,
        ProposedDetail? attribute,
        ProposedMilestone? milestone,
        ProposalState state) =>
        new(id, documentId, paragraph, passage, createdAt, element, relationship, attribute, milestone, state);

    /// <summary>The writer took it: what it says is now in the work.</summary>
    public void Accept() => Decide(ProposalState.Accepted);

    /// <summary>The writer dropped it.</summary>
    public void Dismiss() => Decide(ProposalState.Dismissed);

    private void Decide(ProposalState state)
    {
        if (State != ProposalState.Pending)
        {
            throw new DomainException(DomainError.ProposalNotFound, $"Proposal {Id} is no longer waiting.");
        }

        State = state;
    }

    private static Proposal Create(
        DocumentId documentId,
        string paragraph,
        string passage,
        DateTimeOffset now,
        ProposedElement? element,
        ProposedRelationship? relationship,
        ProposedDetail? attribute,
        ProposedMilestone? milestone = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(paragraph);
        ArgumentNullException.ThrowIfNull(passage);
        var shown = passage.Length <= MaxPassageLength ? passage : passage[..MaxPassageLength];
        return new Proposal(ProposalId.New(now), documentId, paragraph, shown, now, element, relationship, attribute, milestone, ProposalState.Pending);
    }
}
