using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Squire;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class ProposalStorageTests : IDisposable
{
    private const string Paragraph = "a1b2";
    private const string Passage = "Antonio llegó con su hijo Claudio.";
    private readonly ProjectFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    private ProposalRepository Proposals => new(_fixture.Database);

    private Proposal Element(string name, int minute) =>
        Proposal.ForElement(_fixture.First.Id, Paragraph, Passage, new ProposedElement(name, ElementKind.Character, null), Moments.At(minute));

    [Fact]
    public void Every_kind_of_proposal_survives_closing_the_file()
    {
        var element = Proposal.ForElement(_fixture.First.Id, Paragraph, Passage, new ProposedElement("Yelmo", ElementKind.Other, "Objeto"), Moments.At(1));
        var relationship = Proposal.ForRelationship(
            _fixture.First.Id, Paragraph, Passage, new ProposedRelationship("Claudio", "Antonio", "hijo de", "padre de"), Moments.At(2));
        var detail = Proposal.ForAttribute(_fixture.First.Id, Paragraph, Passage, new ProposedDetail("Antonio", "Pelo", "rojo"), Moments.At(3));
        foreach (var proposal in new[] { element, relationship, detail })
        {
            Proposals.Save(proposal);
        }

        var reopened = new ProposalRepository(_fixture.Reopen());

        reopened.Pending().Select(proposal => proposal.Id).ShouldBe([detail.Id, relationship.Id, element.Id]);
        reopened.Load(element.Id).Element.ShouldBe(element.Element);
        reopened.Load(relationship.Id).Relationship.ShouldBe(relationship.Relationship);
        reopened.Load(detail.Id).Attribute.ShouldBe(detail.Attribute);
        reopened.Load(detail.Id).Passage.ShouldBe(Passage);
    }

    [Fact]
    public void A_decided_proposal_is_no_longer_waiting_but_its_key_stays()
    {
        var accepted = Element("Claudio", 1);
        var dismissed = Element("Antonio", 2);
        Proposals.Save(accepted);
        Proposals.Save(dismissed);

        accepted.Accept();
        dismissed.Dismiss();
        Proposals.Save(accepted);
        Proposals.Save(dismissed);

        Proposals.Pending().ShouldBeEmpty();
        Proposals.Load(dismissed.Id).State.ShouldBe(ProposalState.Dismissed);
        Proposals.KeysOf(_fixture.First.Id, Paragraph).ShouldBe([accepted.Key, dismissed.Key], ignoreOrder: true);
        Proposals.KeysOf(_fixture.Second.Id, Paragraph).ShouldBeEmpty();
        Should.Throw<DomainException>(() => Proposals.Load(ProposalId.New(Moments.Start))).Error.ShouldBe(DomainError.ProposalNotFound);
    }

    [Fact]
    public void The_proposals_of_a_document_in_the_trash_are_not_waiting()
    {
        Proposals.Save(Element("Claudio", 1));
        var projects = new ProjectRepository(_fixture.Database);
        var project = projects.Load();
        project.Delete(_fixture.First.Id, Moments.At(5));
        projects.Save(project);

        Proposals.Pending().ShouldBeEmpty();
    }

    [Fact]
    public void Remembers_the_paragraphs_it_read_and_whether_it_may_read_the_work()
    {
        Proposals.WasRead(_fixture.First.Id, Paragraph).ShouldBeFalse();
        Proposals.MarkRead(_fixture.First.Id, Paragraph, Moments.At(1));
        Proposals.MarkRead(_fixture.First.Id, Paragraph, Moments.At(2));
        Proposals.SquireEnabled().ShouldBeFalse();
        Proposals.SetSquireEnabled(true);

        var reopened = new ProposalRepository(_fixture.Reopen());
        reopened.WasRead(_fixture.First.Id, Paragraph).ShouldBeTrue();
        reopened.WasRead(_fixture.Second.Id, Paragraph).ShouldBeFalse();
        reopened.SquireEnabled().ShouldBeTrue();
    }
}
