using Rocinante.Domain.Squire;
using Rocinante.Domain.Threads;

namespace Rocinante.Domain.Tests.Threads;

public sealed class MilestoneTests
{
    private const string Death = "Aquella noche murió el padre de Antonio, sin decir palabra.";
    private readonly ElementId _antonio = ElementId.New(Moments.Start);
    private readonly DocumentId _chapter = DocumentId.New(Moments.Start);

    private Milestone At(int block, string paragraph = Death, string text = " Muere su padre ") =>
        Milestone.Create(_antonio, _chapter, paragraph, block, text, Moments.At(1));

    [Fact]
    public void A_milestone_says_what_happens_at_its_paragraph()
    {
        var milestone = At(1);

        milestone.Text.ShouldBe("Muere su padre");
        milestone.Paragraph.ShouldBe(Death);
        milestone.Block.ShouldBe(1);
        milestone.Lost.ShouldBeFalse();
        milestone.ElementId.ShouldBe(_antonio);
        milestone.DocumentId.ShouldBe(_chapter);
    }

    [Fact]
    public void It_says_something_in_a_short_sentence()
    {
        Should.Throw<DomainException>(() => At(0, text: "  ")).Error.ShouldBe(DomainError.MilestoneTextRequired);
        Should.Throw<DomainException>(() => At(0, text: new string('a', 301))).Error.ShouldBe(DomainError.MilestoneTextRequired);

        var milestone = At(0);
        milestone.Rename(" Llega a Madrid ");
        milestone.Text.ShouldBe("Llega a Madrid");
        Should.Throw<DomainException>(() => milestone.Rename("")).Error.ShouldBe(DomainError.MilestoneTextRequired);
    }

    [Fact]
    public void It_follows_its_paragraph_when_paragraphs_come_before_it()
    {
        var milestone = At(1);

        milestone.Follow(["Primero.", Death]).ShouldBeFalse();
        milestone.Follow(["Primero.", "Otro párrafo nuevo.", Death]).ShouldBeTrue();
        milestone.Block.ShouldBe(2);
        milestone.Lost.ShouldBeFalse();
    }

    [Fact]
    public void It_follows_its_paragraph_as_it_is_rewritten_little_by_little()
    {
        var milestone = At(0);
        const string Changed = "Aquella noche, ya tarde, murió el padre de Antonio, sin decir palabra a nadie.";

        milestone.Follow(["Otra cosa que no tiene que ver.", Changed]).ShouldBeTrue();
        milestone.Block.ShouldBe(1);
        milestone.Paragraph.ShouldBe(Changed);
    }

    [Fact]
    public void It_is_lost_when_its_paragraph_is_rewritten_whole_and_found_again_when_it_comes_back()
    {
        var milestone = At(0);

        milestone.Follow(["Llovía en la venta y nadie hablaba."]).ShouldBeTrue();
        milestone.Lost.ShouldBeTrue();
        milestone.Paragraph.ShouldBe(Death);
        milestone.Follow(["Llovía en la venta y nadie hablaba."]).ShouldBeFalse();

        milestone.Follow(["Llovía.", Death]).ShouldBeTrue();
        milestone.Lost.ShouldBeFalse();
        milestone.Block.ShouldBe(1);
    }

    [Fact]
    public void When_its_paragraph_is_split_in_two_it_goes_on_in_the_half_that_kept_the_most()
    {
        var milestone = At(1);

        milestone.Follow(["Llovía.", "Aquella noche murió", "el padre de Antonio, sin decir palabra."]).ShouldBeTrue();
        milestone.Lost.ShouldBeFalse();
        milestone.Block.ShouldBe(2);

        var even = At(0, "uno dos tres cuatro");
        even.Follow(["uno dos", "tres cuatro"]).ShouldBeTrue();
        even.Block.ShouldBe(0);
    }

    [Fact]
    public void Between_two_copies_of_its_paragraph_it_keeps_the_nearest()
    {
        var milestone = At(2);

        milestone.Follow([Death, "a", "b", "c", Death]).ShouldBeTrue();
        milestone.Block.ShouldBe(0);
        At(3).Follow([Death, "a", "b", "c", Death]).ShouldBeTrue();
    }

    [Fact]
    public void A_paragraph_of_a_few_words_is_only_found_by_its_text()
    {
        ParagraphFinder.Find(["No, dijo él."], "No, dijo", 0).ShouldBeNull();
        ParagraphFinder.Find(["Sí.", "No."], "No.", 0).ShouldBe(1);
    }

    [Fact]
    public void The_squire_proposes_a_milestone_of_a_ficha()
    {
        var proposal = Proposal.ForMilestone(
            _chapter, "huella", Death, new ProposedMilestone(" Antonio ", " Muere su padre "), Moments.At(2));

        proposal.Kind.ShouldBe(ProposalKind.Milestone);
        proposal.Milestone.ShouldBe(new ProposedMilestone("Antonio", "Muere su padre"));
        proposal.Key.ShouldBe(Proposal.ForMilestone(
            _chapter, "otra", Death, new ProposedMilestone("antonio", "muere su padre"), Moments.At(3)).Key);
        Should.Throw<DomainException>(() => Proposal.ForMilestone(
            _chapter, "huella", Death, new ProposedMilestone("Antonio", " "), Moments.At(2)));
    }
}
