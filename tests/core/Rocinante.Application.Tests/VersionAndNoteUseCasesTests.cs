using Rocinante.Domain;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Versions;

namespace Rocinante.Application.Tests;

public sealed class VersionAndNoteUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private readonly AppFixture _app = new();
    private readonly DocumentId _chapter;

    public VersionAndNoteUseCasesTests()
    {
        _app.CreateProject();
        _chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main).Id;
        _app.Notifier.Clear();
    }

    public void Dispose() => _app.Dispose();

    [Fact]
    public void A_manual_version_is_stored_listed_and_read_back()
    {
        _app.Documents.Save(_chapter, TipTap.Paragraphs("primer borrador"), Main);
        _app.Notifier.Clear();

        var summary = _app.Versions.Create(_chapter, "Borrador", "window-1");

        summary.Kind.ShouldBe(VersionKind.Manual);
        summary.Name.ShouldBe("Borrador");
        summary.Statistics.Words.ShouldBe(2);
        _app.Notifier.Events.ShouldBe(["versions.changed:window-1"]);
        _app.Versions.List(_chapter).ShouldHaveSingleItem().ShouldBe(summary);
        _app.Versions.Get(summary.Id).Content.Json.ShouldBe(TipTap.Paragraphs("primer borrador"));
    }

    [Fact]
    public void Restoring_saves_the_current_text_first()
    {
        _app.Documents.Save(_chapter, TipTap.Paragraphs("versión antigua"), Main);
        var old = _app.Versions.Create(_chapter, "Antigua", Main);
        _app.Clock.AdvanceMinutes(1);
        _app.Documents.Save(_chapter, TipTap.Paragraphs("texto de hoy"), Main);
        _app.Notifier.Clear();

        var restored = _app.Versions.Restore(old.Id, "window-1");

        restored.Document.Content.Json.ShouldBe(TipTap.Paragraphs("versión antigua"));
        _app.Documents.Get(_chapter).Content.Json.ShouldBe(TipTap.Paragraphs("versión antigua"));
        var before = restored.Before.ShouldNotBeNull();
        before.Kind.ShouldBe(VersionKind.BeforeRestore);
        _app.Versions.Get(before.Id).Content.Json.ShouldBe(TipTap.Paragraphs("texto de hoy"));
        _app.Versions.List(_chapter).Count.ShouldBe(2);
        _app.Notifier.Events.ShouldBe(["document.changed:window-1", "versions.changed:window-1"]);
    }

    [Fact]
    public void Restoring_the_text_already_there_changes_and_announces_nothing()
    {
        _app.Documents.Save(_chapter, TipTap.Paragraphs("igual"), Main);
        var same = _app.Versions.Create(_chapter, name: null, Main);
        _app.Notifier.Clear();

        _app.Versions.Restore(same.Id, Main).Before.ShouldBeNull();

        _app.Notifier.Events.ShouldBeEmpty();
        _app.Versions.List(_chapter).ShouldHaveSingleItem();
    }

    [Fact]
    public void Restoring_a_version_with_the_passage_anchors_its_note_again()
    {
        var note = _app.Notes.Create(_chapter, "revisar", anchored: true, Main);
        _app.Documents.Save(_chapter, TipTap.Anchored("pasaje", note.Id.Value), Main);
        var withPassage = _app.Versions.Create(_chapter, name: null, Main);
        _app.Documents.Save(_chapter, TipTap.Paragraphs("sin pasaje"), Main);
        _app.Notifier.Clear();

        _app.Versions.Restore(withPassage.Id, Main);

        _app.Notes.List(_chapter).ShouldHaveSingleItem().IsAnchored.ShouldBeTrue();
        _app.Notifier.Events.ShouldContain("notes.changed:main");
    }

    [Fact]
    public void Versions_of_documents_in_the_trash_cannot_be_saved_or_restored()
    {
        var version = _app.Versions.Create(_chapter, name: null, Main);
        _app.Documents.Delete(_chapter, Main);

        Should.Throw<DomainException>(() => _app.Versions.Create(_chapter, null, Main)).Error.ShouldBe(DomainError.DocumentIsDeleted);
        Should.Throw<DomainException>(() => _app.Versions.Restore(version.Id, Main)).Error.ShouldBe(DomainError.DocumentIsDeleted);
        _app.Versions.List(_chapter).ShouldHaveSingleItem();
    }

    [Fact]
    public void Notes_are_created_edited_listed_and_deleted_with_an_announcement_each_time()
    {
        var first = _app.Notes.Create(_chapter, "revisar esta fecha", anchored: true, Main);
        _app.Clock.AdvanceMinutes(1);
        var second = _app.Notes.Create(_chapter, "Antonio no conoce a Claudio", anchored: false, Main);
        _app.Clock.AdvanceMinutes(1);
        var edited = _app.Notes.Update(first.Id, "revisar la fecha de la batalla", "window-1");
        _app.Notes.Delete(second.Id, Main);

        edited.Text.ShouldBe("revisar la fecha de la batalla");
        edited.UpdatedAt.ShouldBe(_app.Clock.GetUtcNow());
        _app.Notes.List(_chapter).ShouldHaveSingleItem().Id.ShouldBe(first.Id);
        _app.Notifier.Events.ShouldBe(["notes.changed:main", "notes.changed:main", "notes.changed:window-1", "notes.changed:main"]);
        _app.Notifier.LastNotes.ShouldNotBeNull().ShouldHaveSingleItem().Id.ShouldBe(first.Id);
    }

    [Fact]
    public void Notes_need_a_document_in_the_work()
    {
        _app.Documents.Delete(_chapter, Main);

        Should.Throw<DomainException>(() => _app.Notes.Create(_chapter, "nota", anchored: false, Main))
            .Error.ShouldBe(DomainError.DocumentIsDeleted);
        Should.Throw<DomainException>(() => _app.Notes.Update(NoteId.New(_app.Clock.GetUtcNow()), "x", Main))
            .Error.ShouldBe(DomainError.NoteNotFound);
    }
}
