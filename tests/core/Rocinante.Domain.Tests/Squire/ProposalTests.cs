using Rocinante.Domain.Elements;
using Rocinante.Domain.Squire;

namespace Rocinante.Domain.Tests.Squire;

public sealed class ProposalTests
{
    private const string Paragraph = "huella";
    private const string Passage = "Antonio llegó con su hijo Claudio, pelirrojo como él.";
    private readonly DocumentId _document = DocumentId.New(Moments.Start);

    private Proposal Element(string name = " Claudio ", ElementKind kind = ElementKind.Character, string? otherKind = null) =>
        Proposal.ForElement(_document, Paragraph, Passage, new ProposedElement(name, kind, otherKind), Moments.At(1));

    [Fact]
    public void A_proposed_element_is_waiting_with_its_passage()
    {
        var proposal = Element();

        proposal.Kind.ShouldBe(ProposalKind.Element);
        proposal.State.ShouldBe(ProposalState.Pending);
        proposal.Element.ShouldBe(new ProposedElement("Claudio", ElementKind.Character, null));
        proposal.Passage.ShouldBe(Passage);
        proposal.DocumentId.ShouldBe(_document);
        proposal.CreatedAt.ShouldBe(Moments.At(1));
    }

    [Fact]
    public void A_proposed_element_needs_a_name_and_another_kind_needs_its_name()
    {
        Should.Throw<DomainException>(() => Element("  ")).Error.ShouldBe(DomainError.NameRequired);
        Should.Throw<DomainException>(() => Element("Yelmo", ElementKind.Other)).Error.ShouldBe(DomainError.NameRequired);
        Element("Yelmo", ElementKind.Other, "Objeto").Element!.OtherKind.ShouldBe("Objeto");
        Element("Toboso", ElementKind.Place, "sobra").Element!.OtherKind.ShouldBeNull();
    }

    [Fact]
    public void A_proposed_relationship_joins_two_different_names()
    {
        var proposal = Proposal.ForRelationship(
            _document, Paragraph, Passage, new ProposedRelationship("Claudio", "Antonio", "hijo de", " padre de "), Moments.At(1));

        proposal.Kind.ShouldBe(ProposalKind.Relationship);
        proposal.Relationship.ShouldBe(new ProposedRelationship("Claudio", "Antonio", "hijo de", "padre de"));
        Proposal.ForRelationship(_document, Paragraph, Passage, new ProposedRelationship("Ana", "Eva", "amiga de", " "), Moments.At(1))
            .Relationship!.Inverse.ShouldBeNull();
        Should.Throw<DomainException>(() => Proposal.ForRelationship(
            _document, Paragraph, Passage, new ProposedRelationship("Antonio", "ANTONIO", "hijo de", null), Moments.At(1)))
            .Error.ShouldBe(DomainError.SameElement);
    }

    [Fact]
    public void A_proposed_detail_says_something_of_a_ficha()
    {
        var proposal = Proposal.ForAttribute(_document, Paragraph, Passage, new ProposedDetail("Antonio", "Pelo", " pelirrojo "), Moments.At(1));

        proposal.Kind.ShouldBe(ProposalKind.Attribute);
        proposal.Attribute.ShouldBe(new ProposedDetail("Antonio", "Pelo", "pelirrojo"));
    }

    [Fact]
    public void Two_proposals_about_the_same_names_are_the_same_whatever_the_case_or_accents()
    {
        Element("Ángela").Key.ShouldBe(Element("angela").Key);
        Element("Ángela").Key.ShouldNotBe(Element("Ángel").Key);
        Proposal.ForAttribute(_document, Paragraph, Passage, new ProposedDetail("Antonio", "Pelo", "rojo"), Moments.At(1)).Key
            .ShouldBe(Proposal.ForAttribute(_document, Paragraph, Passage, new ProposedDetail("antonio", "pelo", "castaño"), Moments.At(2)).Key);
    }

    [Fact]
    public void A_proposal_is_accepted_or_dismissed_once()
    {
        var accepted = Element();
        accepted.Accept();
        accepted.State.ShouldBe(ProposalState.Accepted);
        Should.Throw<DomainException>(() => accepted.Dismiss()).Error.ShouldBe(DomainError.ProposalNotFound);

        var dismissed = Element();
        dismissed.Dismiss();
        dismissed.State.ShouldBe(ProposalState.Dismissed);
        Should.Throw<DomainException>(() => dismissed.Accept()).Error.ShouldBe(DomainError.ProposalNotFound);
    }

    [Fact]
    public void A_long_passage_is_kept_short()
    {
        var proposal = Proposal.ForElement(
            _document, Paragraph, new string('a', Proposal.MaxPassageLength + 50), new ProposedElement("Claudio", ElementKind.Character, null), Moments.At(1));

        proposal.Passage.Length.ShouldBe(Proposal.MaxPassageLength);
    }

    [Fact]
    public void Rehydrating_keeps_every_value()
    {
        var id = ProposalId.New(Moments.Start);
        var detail = new ProposedDetail("Antonio", "Pelo", "rojo");

        var proposal = Proposal.Rehydrate(id, _document, Paragraph, Passage, Moments.At(3), null, null, detail, ProposalState.Dismissed);

        proposal.Id.ShouldBe(id);
        proposal.Attribute.ShouldBe(detail);
        proposal.State.ShouldBe(ProposalState.Dismissed);
        proposal.CreatedAt.ShouldBe(Moments.At(3));
    }
}
