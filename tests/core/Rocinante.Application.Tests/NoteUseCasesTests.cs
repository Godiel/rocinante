using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Projects;

namespace Rocinante.Application.Tests;

public sealed class NoteUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private const string Other = "window-1";
    private readonly AppFixture _app = new();
    private readonly DocumentId _chapter;

    public NoteUseCasesTests()
    {
        _app.CreateProject();
        _chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main).Id;
        _app.Notifier.Clear();
    }

    public void Dispose() => _app.Dispose();

    private NoteUseCases Notes => _app.Notes;

    private static DocumentContent Text(string text) => DocumentContent.FromPlainText(text);

    private Note OnTheChapter(string text = "revisar esta fecha", params ElementId[] elements) =>
        Notes.Create(_chapter, Text(text), anchored: false, elements, Main);

    private Note Idea(string text = "un final en el Toboso", params ElementId[] elements) =>
        Notes.Create(null, Text(text), anchored: false, elements, Main);

    private Element Character(string name) => _app.Elements.Create(ElementKind.Character, null, name, [], null, Main);

    [Fact]
    public void Without_a_work_open_there_are_no_notes()
    {
        using var app = new AppFixture();

        Should.Throw<ProjectNotOpenException>(() => app.Notes.All());
    }

    [Fact]
    public void Every_note_of_the_work_comes_in_the_order_it_was_written()
    {
        var onTheChapter = OnTheChapter();
        _app.Clock.AdvanceMinutes(1);
        var idea = Idea();

        Notes.All().Select(note => note.Id).ShouldBe([onTheChapter.Id, idea.Id]);
    }

    [Fact]
    public void Each_change_announces_only_the_note_that_changed()
    {
        OnTheChapter("otra");
        _app.Notifier.Clear();

        var idea = Notes.Create(null, Text("un final"), anchored: false, [], Other);

        _app.Notifier.Events.ShouldBe(["notes.changed:window-1"]);
        _app.Notifier.LastNotes.ShouldNotBeNull().ShouldHaveSingleItem().Id.ShouldBe(idea.Id);
        _app.Notifier.LastRemovedNotes.ShouldNotBeNull().ShouldBeEmpty();
    }

    [Fact]
    public void A_loose_idea_is_never_anchored()
    {
        var idea = Notes.Create(null, Text("un final"), anchored: true, [], Main);

        idea.DocumentId.ShouldBeNull();
        idea.IsAnchored.ShouldBeFalse();
    }

    [Fact]
    public void A_note_is_edited_resolved_and_linked_in_one_change()
    {
        var antonio = Character("Antonio");
        var note = OnTheChapter();
        _app.Clock.AdvanceMinutes(2);
        _app.Notifier.Clear();

        var changed = Notes.Update(note.Id, new NoteUpdate(Text("revisar la fecha de la batalla"), Resolved: true, [antonio.Id]), Other);

        changed.Text.ShouldBe("revisar la fecha de la batalla");
        changed.ResolvedAt.ShouldBe(_app.Clock.GetUtcNow());
        changed.Elements.ShouldBe([antonio.Id]);
        _app.Notifier.Events.ShouldBe(["notes.changed:window-1"]);
        Notes.All().ShouldHaveSingleItem().IsResolved.ShouldBeTrue();

        Notes.Update(note.Id, new NoteUpdate(Resolved: false), Main).IsResolved.ShouldBeFalse();
    }

    [Fact]
    public void Changing_nothing_announces_nothing()
    {
        var note = OnTheChapter();
        _app.Notifier.Clear();

        Notes.Update(note.Id, new NoteUpdate(Text("revisar esta fecha"), Resolved: false, []), Main);

        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void A_note_links_only_with_elements_in_the_work()
    {
        var antonio = Character("Antonio");
        _app.Elements.Delete(antonio.Id, Main);

        Should.Throw<DomainException>(() => Idea("idea", antonio.Id)).Error.ShouldBe(DomainError.ElementIsDeleted);
        Should.Throw<DomainException>(() => Idea("idea", ElementId.New(_app.Clock.GetUtcNow()))).Error.ShouldBe(DomainError.ElementNotFound);
    }

    [Fact]
    public void A_link_with_an_element_sent_to_the_trash_is_kept_and_the_note_still_changes()
    {
        var antonio = Character("Antonio");
        var claudio = Character("Claudio");
        var note = Idea("idea", antonio.Id, claudio.Id);
        _app.Elements.Delete(antonio.Id, Main);

        Notes.All().ShouldHaveSingleItem().Elements.ShouldBe([antonio.Id, claudio.Id]);
        Notes.Update(note.Id, new NoteUpdate(Text("otra idea"), Elements: [antonio.Id, claudio.Id]), Main).Text.ShouldBe("otra idea");
        Notes.Update(note.Id, new NoteUpdate(Elements: [claudio.Id]), Main).Elements.ShouldBe([claudio.Id]);
    }

    [Fact]
    public void A_deleted_note_is_set_aside_and_comes_back_as_it_was()
    {
        var note = OnTheChapter();
        Notes.Update(note.Id, new NoteUpdate(Resolved: true), Main);
        _app.Notifier.Clear();

        Notes.Delete(note.Id, Other);

        Notes.All().ShouldBeEmpty();
        _app.Notifier.Events.ShouldBe(["notes.changed:window-1"]);
        _app.Notifier.LastNotes.ShouldNotBeNull().ShouldBeEmpty();
        _app.Notifier.LastRemovedNotes.ShouldBe([note.Id]);
        Should.Throw<DomainException>(() => Notes.Update(note.Id, new NoteUpdate(Resolved: false), Main)).Error.ShouldBe(DomainError.NoteIsDeleted);
        Should.Throw<DomainException>(() => Notes.Delete(note.Id, Main)).Error.ShouldBe(DomainError.NoteIsDeleted);

        var back = Notes.Restore(note.Id, Main);

        back.IsResolved.ShouldBeTrue();
        Notes.All().ShouldHaveSingleItem().Id.ShouldBe(note.Id);
        _app.Notifier.LastNotes.ShouldNotBeNull().ShouldHaveSingleItem().Id.ShouldBe(note.Id);
        Should.Throw<DomainException>(() => Notes.Restore(note.Id, Main)).Error.ShouldBe(DomainError.NoteIsNotDeleted);
    }

    [Fact]
    public void The_notes_of_a_document_in_the_trash_go_and_come_back_with_it()
    {
        var note = OnTheChapter();
        _app.Clock.AdvanceMinutes(1);
        var idea = Idea();
        _app.Clock.AdvanceMinutes(1);
        var setAside = OnTheChapter("apartada");
        Notes.Delete(setAside.Id, Main);
        _app.Notifier.Clear();

        _app.Documents.Delete(_chapter, Main);

        Notes.All().ShouldHaveSingleItem().Id.ShouldBe(idea.Id);
        _app.Notifier.Events.ShouldBe(["project.changed:main", "notes.changed:main"]);
        _app.Notifier.LastRemovedNotes.ShouldBe([note.Id]);
        Should.Throw<DomainException>(() => Notes.Update(note.Id, new NoteUpdate(Resolved: true), Main)).Error.ShouldBe(DomainError.DocumentIsDeleted);
        Should.Throw<DomainException>(() => Notes.Restore(setAside.Id, Main)).Error.ShouldBe(DomainError.DocumentIsDeleted);

        _app.Documents.Restore(_chapter, Main);

        Notes.All().Select(shown => shown.Id).ShouldBe([note.Id, idea.Id]);
        _app.Notifier.LastNotes.ShouldNotBeNull().ShouldHaveSingleItem().Id.ShouldBe(note.Id);
    }

    [Fact]
    public void A_document_without_notes_goes_to_the_trash_without_a_note_announcement()
    {
        Idea();
        _app.Notifier.Clear();

        _app.Documents.Delete(_chapter, Main);

        _app.Notifier.Events.ShouldBe(["project.changed:main"]);
    }

    [Fact]
    public void Notes_need_a_document_in_the_work()
    {
        _app.Documents.Delete(_chapter, Main);

        Should.Throw<DomainException>(() => OnTheChapter()).Error.ShouldBe(DomainError.DocumentIsDeleted);
        Should.Throw<DomainException>(() => Notes.Update(NoteId.New(_app.Clock.GetUtcNow()), new NoteUpdate(Resolved: true), Main))
            .Error.ShouldBe(DomainError.NoteNotFound);
    }

    [Fact]
    public void Saving_the_text_announces_only_the_notes_whose_anchor_changed()
    {
        var first = Notes.Create(_chapter, Text("primera"), anchored: true, [], Main);
        var second = Notes.Create(_chapter, Text("segunda"), anchored: true, [], Main);
        _app.Documents.Save(_chapter, TipTap.Anchored("el pasaje", first.Id.Value), Main);
        _app.Notifier.Clear();

        _app.Documents.Save(_chapter, TipTap.Anchored("el pasaje, ya escrito", first.Id.Value), Main);

        _app.Notifier.Events.ShouldBe(["document.changed:main"]);
        Notes.All().Single(note => note.Id == second.Id).IsAnchored.ShouldBeFalse();
    }

    [Fact]
    public void The_anchor_of_a_note_set_aside_is_still_followed_and_not_announced()
    {
        var note = Notes.Create(_chapter, Text("revisar"), anchored: true, [], Main);
        _app.Documents.Save(_chapter, TipTap.Anchored("pasaje", note.Id.Value), Main);
        Notes.Delete(note.Id, Main);
        _app.Notifier.Clear();

        _app.Documents.Save(_chapter, TipTap.Paragraphs("sin pasaje"), Main);

        _app.Notifier.Events.ShouldBe(["document.changed:main"]);
        Notes.Restore(note.Id, Main).IsAnchored.ShouldBeFalse();
    }
}
