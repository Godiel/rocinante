using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Squire;

namespace Rocinante.Application.Tests;

public sealed class ThreadUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private const string Death = "Aquella noche murió el padre de Antonio, sin decir palabra.";
    private readonly AppFixture _app = new();
    private readonly DocumentId _first;
    private readonly DocumentId _second;
    private readonly DocumentId _fragment;

    public ThreadUseCasesTests()
    {
        _app.CreateProject();
        _first = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main).Id;
        _second = _app.Documents.Create(DocumentKind.Chapter, "Dos", null, Main).Id;
        _fragment = _app.Documents.Create(DocumentKind.Fragment, "Suelto", null, Main).Id;
    }

    public void Dispose() => _app.Dispose();

    private Element Make(string name, ElementKind kind = ElementKind.Character) =>
        _app.Elements.Create(kind, null, name, [], null, Main);

    private void Write(DocumentId document, params string[] paragraphs) =>
        _app.Documents.Save(document, TipTap.Paragraphs(paragraphs), Main);

    [Fact]
    public void Until_the_writer_chooses_it_follows_the_five_characters_mentioned_the_most()
    {
        var names = new[] { "Ana", "Berta", "Carlos", "Diego", "Elena", "Fabio" };
        var people = names.Select(name => Make(name)).ToList();
        Make("Madrid", ElementKind.Place);
        Write(_first, "Fabio, Fabio y Fabio. Elena y Elena. Diego, Carlos, Berta. Madrid, Madrid, Madrid, Madrid.");

        var chosen = _app.Threads.Chosen();

        chosen.Count.ShouldBe(ThreadUseCases.ShownAtFirst);
        chosen[0].ShouldBe(people[5].Id);
        chosen[1].ShouldBe(people[4].Id);
        chosen.ShouldNotContain(people[0].Id);
    }

    [Fact]
    public void A_thread_counts_the_mentions_chapter_by_chapter_and_who_meets_in_a_paragraph()
    {
        var antonio = Make("Antonio");
        var claudio = Make("Claudio");
        Write(_first, "Antonio llegó con Claudio.", "Antonio estaba solo.", "Claudio, después, también.");
        Write(_second, "Claudio se fue.");
        Write(_fragment, "Antonio y Claudio, en un fragmento.");

        var view = _app.Threads.Get();

        view.Chapters.Select(chapter => chapter.Id).ShouldBe([_first, _second]);
        // Claudio is mentioned the most, so he comes first; the fragment counts for that, not for the thread.
        view.Chosen.ShouldBe([claudio.Id, antonio.Id]);
        view.Threads[0].Points.ShouldBe([new ThreadPoint(_first, 2), new ThreadPoint(_second, 1)]);
        view.Threads[1].Points.ShouldBe([new ThreadPoint(_first, 2)]);
        view.Meetings.ShouldBe([new ThreadMeeting(_first, claudio.Id, antonio.Id, 1)]);
    }

    [Fact]
    public void The_writer_chooses_whom_to_follow_and_it_is_kept()
    {
        var antonio = Make("Antonio");
        var yelmo = Make("Yelmo", ElementKind.Plot);

        _app.Threads.Choose([yelmo.Id, antonio.Id], Main);

        _app.Notifier.LastChosen.ShouldBe([yelmo.Id, antonio.Id]);
        _app.Threads.Get().Chosen.ShouldBe([yelmo.Id, antonio.Id]);
        _app.Elements.Delete(yelmo.Id, Main);
        _app.Threads.Chosen().ShouldBe([antonio.Id]);
        Should.Throw<DomainException>(() => _app.Threads.Choose([ElementId.New(_app.Clock.GetUtcNow())], Main))
            .Error.ShouldBe(DomainError.ElementNotFound);
    }

    [Fact]
    public void A_milestone_is_marked_at_a_paragraph_and_follows_it_as_the_text_changes()
    {
        var antonio = Make("Antonio");
        Write(_first, "Llovía.", Death);

        var milestone = _app.Threads.Mark(antonio.Id, _first, Death, "Muere su padre", Main);
        milestone.Block.ShouldBe(1);
        _app.Notifier.LastMilestones.ShouldNotBeNull().ShouldHaveSingleItem().Id.ShouldBe(milestone.Id);

        Write(_first, "Llovía.", "Tronaba.", "Aquella noche, ya tarde, murió el padre de Antonio, sin decir palabra.");
        var followed = _app.Threads.Get().Milestones.ShouldHaveSingleItem();
        followed.Block.ShouldBe(2);
        followed.Lost.ShouldBeFalse();
        _app.Notifier.Events.ShouldContain($"milestones.changed:{Main}");

        Write(_first, "Llovía.", "Otra cosa sucedió en la venta aquel día.");
        _app.Threads.Get().Milestones.ShouldHaveSingleItem().Lost.ShouldBeTrue();
    }

    [Fact]
    public void A_milestone_is_corrected_and_removed()
    {
        var antonio = Make("Antonio");
        Write(_first, Death);
        var milestone = _app.Threads.Mark(antonio.Id, _first, Death, "Muere su padre", Main);

        _app.Threads.Rename(milestone.Id, "Queda huérfano", Main).Text.ShouldBe("Queda huérfano");
        _app.Threads.Remove(milestone.Id, Main);

        _app.Notifier.LastRemovedMilestones.ShouldBe([milestone.Id]);
        _app.Threads.Get().Milestones.ShouldBeEmpty();
        Should.Throw<DomainException>(() => _app.Threads.Remove(milestone.Id, Main)).Error.ShouldBe(DomainError.MilestoneNotFound);
    }

    [Fact]
    public void Only_the_milestones_of_the_chosen_and_in_the_chapters_are_shown()
    {
        var antonio = Make("Antonio");
        var claudio = Make("Claudio");
        Write(_first, Death);
        Write(_fragment, Death);
        _app.Threads.Mark(antonio.Id, _first, Death, "Muere su padre", Main);
        _app.Threads.Mark(antonio.Id, _fragment, Death, "En un fragmento", Main);
        _app.Threads.Mark(claudio.Id, _first, Death, "Lo ve morir", Main);

        _app.Threads.Choose([antonio.Id], Main);

        _app.Threads.Get().Milestones.Select(milestone => milestone.Text).ShouldBe(["Muere su padre"]);
    }

    [Fact]
    public void A_relationship_holds_between_two_chapters_in_order()
    {
        var antonio = Make("Antonio");
        var claudio = Make("Claudio");

        var friends = _app.Elements.Relate(
            antonio.Id, claudio.Id, RelationshipKindChoice.Of(RelationshipKindId.Builtin("friend-of")), Main, _first, _second);
        friends.Starts.ShouldBe(_first);
        friends.Ends.ShouldBe(_second);

        var changed = _app.Elements.ChangeRelationship(friends.Id, null, Main, new RelationshipBounds(_second, null));
        changed.Starts.ShouldBe(_second);
        changed.Ends.ShouldBeNull();
        changed.Kind.ShouldBe(RelationshipKindId.Builtin("friend-of"));
        _app.Notifier.LastElements!.Relationships.ShouldHaveSingleItem().Starts.ShouldBe(_second);

        Should.Throw<DomainException>(() => _app.Elements.ChangeRelationship(friends.Id, null, Main, new RelationshipBounds(_second, _first)))
            .Error.ShouldBe(DomainError.RelationshipBounds);
        Should.Throw<DomainException>(() => _app.Elements.ChangeRelationship(friends.Id, null, Main, new RelationshipBounds(_fragment, null)))
            .Error.ShouldBe(DomainError.RelationshipBounds);
    }

    [Fact]
    public async Task The_squire_proposes_a_milestone_and_accepting_it_marks_it_at_its_paragraph()
    {
        var antonio = Make("Antonio");
        Write(_first, Death);
        _app.Squire.Configure(Squire.SquireProvider.Ollama, "llama3.1", null, Main);
        _app.Squire.Enable(true, Main);
        _app.SquireClient.Answer = """{"milestones":[{"element":"Antonio","text":"Muere su padre"}]}""";

        _app.Squire.Analyze(_first, Death, Main);
        await _app.Squire.WhenIdle();
        var proposal = _app.Squire.Pending().ShouldHaveSingleItem();
        proposal.Kind.ShouldBe(ProposalKind.Milestone);

        _app.Squire.Accept(proposal.Id, new Squire.ProposalCorrection(Text: "Queda huérfano"), Main);

        var milestone = _app.Threads.Get().Milestones.ShouldHaveSingleItem();
        milestone.ElementId.ShouldBe(antonio.Id);
        milestone.DocumentId.ShouldBe(_first);
        milestone.Text.ShouldBe("Queda huérfano");
        milestone.Block.ShouldBe(0);
    }
}
