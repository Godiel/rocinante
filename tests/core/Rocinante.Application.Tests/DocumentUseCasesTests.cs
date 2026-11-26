using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Versions;

namespace Rocinante.Application.Tests;

public sealed class DocumentUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private readonly AppFixture _app = new();

    public DocumentUseCasesTests() => _app.CreateProject();

    public void Dispose() => _app.Dispose();

    [Fact]
    public void Creating_documents_updates_the_index_and_announces_it()
    {
        var first = _app.Documents.Create(DocumentKind.Chapter, "Capítulo primero", position: null, Main);
        var before = _app.Documents.Create(DocumentKind.Chapter, "Prólogo", position: 0, Main);
        var fragment = _app.Documents.Create(DocumentKind.Fragment, "Molinos", position: null, "window-1");

        var project = _app.Projects.Current().Project;
        project.Chapters.Select(entry => entry.Id).ShouldBe([before.Id, first.Id]);
        project.Fragments.ShouldHaveSingleItem().Id.ShouldBe(fragment.Id);
        _app.Notifier.Events.ShouldBe(["project.changed:main", "project.changed:main", "project.changed:window-1"]);
        _app.Documents.Get(first.Id).Content.ShouldBe(DocumentContent.Empty);
    }

    [Fact]
    public void Rename_move_delete_and_restore_survive_reopening_the_file()
    {
        var first = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        var second = _app.Documents.Create(DocumentKind.Chapter, "Dos", null, Main);
        var third = _app.Documents.Create(DocumentKind.Chapter, "Tres", null, Main);

        _app.Documents.Rename(first.Id, "Capítulo uno", Main).Title.ShouldBe("Capítulo uno");
        _app.Documents.Move(third.Id, DocumentKind.Chapter, 0, Main);
        _app.Documents.Move(second.Id, DocumentKind.Fragment, 0, Main);
        _app.Documents.Delete(first.Id, Main);
        _app.Documents.Restore(first.Id, Main);
        _app.Documents.Delete(third.Id, Main);

        var path = _app.Projects.Current().Path;
        _app.Projects.Close(Main);
        var project = _app.Projects.Open(path, Main).Project;

        project.Chapters.Select(entry => entry.Title).ShouldBe(["Capítulo uno"]);
        project.Fragments.Select(entry => entry.Title).ShouldBe(["Dos"]);
        project.Trash.Select(entry => entry.Title).ShouldBe(["Tres"]);
    }

    [Fact]
    public void A_refused_index_change_leaves_memory_and_file_as_they_were()
    {
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        _app.Notifier.Clear();

        Should.Throw<DomainException>(() => _app.Documents.Move(chapter.Id, DocumentKind.Chapter, 5, Main))
            .Error.ShouldBe(DomainError.PositionOutOfRange);

        _app.Projects.Current().Project.Chapters.ShouldHaveSingleItem().Position.ShouldBe(0);
        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void Saving_text_announces_it_with_the_counts_of_the_work()
    {
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        var fragment = _app.Documents.Create(DocumentKind.Fragment, "Suelto", null, Main);
        _app.Notifier.Clear();

        _app.Documents.Save(fragment.Id, TipTap.Paragraphs("no cuenta en la obra"), Main);
        var saved = _app.Documents.Save(chapter.Id, TipTap.Paragraphs("En un lugar de la Mancha"), "window-1");

        saved.Changed.ShouldBeTrue();
        saved.Document.Revision.ShouldBe(1);
        saved.Document.Content.Statistics.Words.ShouldBe(6);
        saved.Work.Words.ShouldBe(6);
        saved.AutomaticVersion.ShouldBeNull();
        _app.Notifier.Events.ShouldBe(["document.changed:main", "document.changed:window-1"]);
        _app.Projects.Current().Work.Words.ShouldBe(6);
    }

    [Fact]
    public void Saving_the_same_text_announces_nothing()
    {
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        _app.Documents.Save(chapter.Id, TipTap.Paragraphs("Igual"), Main);
        _app.Notifier.Clear();

        _app.Documents.Save(chapter.Id, TipTap.Paragraphs("Igual"), Main).Changed.ShouldBeFalse();

        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void Ten_minutes_of_writing_store_an_automatic_version()
    {
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        DocumentSaved? last = null;
        for (var minute = 0; minute <= 10; minute++)
        {
            last = _app.Documents.Save(chapter.Id, TipTap.Paragraphs($"minuto {minute}"), Main);
            _app.Clock.AdvanceMinutes(1);
        }

        var version = last!.AutomaticVersion.ShouldNotBeNull();
        version.Kind.ShouldBe(VersionKind.Automatic);
        _app.Versions.List(chapter.Id).ShouldHaveSingleItem().Id.ShouldBe(version.Id);
        _app.Notifier.Events.ShouldContain("versions.changed:main");
    }

    [Fact]
    public void Deleting_a_passage_leaves_its_note_loose_and_undoing_anchors_it_again()
    {
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        var note = _app.Notes.Create(chapter.Id, DocumentContent.FromPlainText("revisar esta fecha"), anchored: true, [], Main);
        _app.Documents.Save(chapter.Id, TipTap.Anchored("el 3 de mayo", note.Id.Value), Main);
        _app.Notifier.Clear();

        _app.Documents.Save(chapter.Id, TipTap.Paragraphs("sin el pasaje"), Main);

        _app.Notifier.Events.ShouldBe(["document.changed:main", "notes.changed:main"]);
        _app.Notifier.LastNotes.ShouldNotBeNull().ShouldHaveSingleItem().IsAnchored.ShouldBeFalse();
        _app.Notes.All().ShouldHaveSingleItem().IsAnchored.ShouldBeFalse();

        _app.Documents.Save(chapter.Id, TipTap.Anchored("el 3 de mayo", note.Id.Value), Main);

        _app.Notes.All().ShouldHaveSingleItem().IsAnchored.ShouldBeTrue();
        _app.Notes.All().ShouldHaveSingleItem().AnchorOrder.ShouldBe(0);
    }

    [Fact]
    public void Documents_in_the_trash_cannot_be_edited()
    {
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        _app.Documents.Delete(chapter.Id, Main);

        Should.Throw<DomainException>(() => _app.Documents.Save(chapter.Id, TipTap.Paragraphs("texto"), Main))
            .Error.ShouldBe(DomainError.DocumentIsDeleted);
        _app.Documents.Get(chapter.Id).Revision.ShouldBe(0);
    }

    [Fact]
    public void Unknown_documents_and_invalid_text_are_refused()
    {
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        var stranger = DocumentId.New(_app.Clock.GetUtcNow());

        Should.Throw<DomainException>(() => _app.Documents.Get(stranger)).Error.ShouldBe(DomainError.DocumentNotFound);
        Should.Throw<DomainException>(() => _app.Documents.Save(chapter.Id, """{"type":"paragraph"}""", Main))
            .Error.ShouldBe(DomainError.InvalidContent);
    }
}
