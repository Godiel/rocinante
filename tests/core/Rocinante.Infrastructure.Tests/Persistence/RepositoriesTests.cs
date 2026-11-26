using System.Text.Json.Nodes;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Versions;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class RepositoriesTests : IDisposable
{
    private readonly ProjectFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    [Fact]
    public void The_project_and_its_index_survive_closing_the_file()
    {
        var projects = new ProjectRepository(_fixture.Database);
        var project = projects.Load();
        project.Rename("Don Quijote de la Mancha");
        project.Move(_fixture.Second.Id, DocumentKind.Chapter, 0);
        project.Convert(_fixture.Fragment.Id, DocumentKind.Chapter);
        project.Delete(_fixture.First.Id, Moments.At(10));
        projects.Save(project);

        var reopened = new ProjectRepository(_fixture.Reopen()).Load();

        reopened.Id.ShouldBe(_fixture.Project.Id);
        reopened.Title.ShouldBe("Don Quijote de la Mancha");
        reopened.CreatedAt.ShouldBe(Moments.Start);
        reopened.Chapters.Select(entry => entry.Title).ShouldBe(["Capítulo segundo", "La aventura de los molinos"]);
        reopened.Fragments.ShouldBeEmpty();
        var trashed = reopened.Trash.ShouldHaveSingleItem();
        trashed.Id.ShouldBe(_fixture.First.Id);
        trashed.DeletedAt.ShouldBe(Moments.At(10));
        trashed.CreatedAt.ShouldBe(Moments.At(1));
    }

    [Fact]
    public void A_file_holds_a_single_project()
    {
        var other = Project.Create("Otra obra", Moments.Start);

        Should.Throw<Microsoft.Data.Sqlite.SqliteException>(() => new ProjectRepository(_fixture.Database).Save(other));
    }

    [Fact]
    public void A_new_document_starts_empty()
    {
        var document = new DocumentRepository(_fixture.Database).Load(_fixture.First.Id);

        document.Content.ShouldBe(DocumentContent.Empty);
        document.Revision.ShouldBe(0);
        document.UpdatedAt.ShouldBe(Moments.At(1));
        document.Session.ShouldBe(WritingSession.None);
    }

    [Fact]
    public void The_text_and_the_writing_session_survive_closing_the_file()
    {
        var documents = new DocumentRepository(_fixture.Database);
        var document = documents.Load(_fixture.First.Id);
        document.Save(Paragraphs("En un lugar de la Mancha"), Moments.At(5));
        document.Save(Paragraphs("En un lugar de la Mancha, de cuyo nombre"), Moments.At(6));
        documents.Save(document);

        var reopened = new DocumentRepository(_fixture.Reopen()).Load(_fixture.First.Id);

        reopened.Content.ShouldBe(document.Content);
        reopened.Content.Json.ShouldBe(document.Content.Json);
        reopened.Revision.ShouldBe(2);
        reopened.UpdatedAt.ShouldBe(Moments.At(6));
        reopened.Session.ShouldBe(document.Session);
    }

    [Fact]
    public void Unknown_documents_are_reported()
    {
        var documents = new DocumentRepository(_fixture.Database);
        var stranger = Document.Create(DocumentId.New(Moments.Start), Moments.Start);

        Should.Throw<DomainException>(() => documents.Load(stranger.Id)).Error.ShouldBe(DomainError.DocumentNotFound);
        Should.Throw<DomainException>(() => documents.Save(stranger)).Error.ShouldBe(DomainError.DocumentNotFound);
    }

    [Fact]
    public void The_work_counts_only_chapters_outside_the_trash()
    {
        var documents = new DocumentRepository(_fixture.Database);
        Write(documents, _fixture.First.Id, "uno dos tres");
        Write(documents, _fixture.Second.Id, "cuatro cinco");
        Write(documents, _fixture.Fragment.Id, "fragmento suelto que no cuenta");

        documents.WorkStatistics().ShouldBe(new TextStatistics(Words: 5, Characters: 24, Paragraphs: 2));

        var projects = new ProjectRepository(_fixture.Database);
        var project = projects.Load();
        project.Delete(_fixture.Second.Id, Moments.At(20));
        projects.Save(project);

        documents.WorkStatistics().ShouldBe(new TextStatistics(Words: 3, Characters: 12, Paragraphs: 1));
    }

    [Fact]
    public void An_empty_work_counts_zero()
    {
        var projects = new ProjectRepository(_fixture.Database);
        var project = projects.Load();
        project.Delete(_fixture.First.Id, Moments.At(10));
        project.Delete(_fixture.Second.Id, Moments.At(11));
        projects.Save(project);

        new DocumentRepository(_fixture.Database).WorkStatistics().ShouldBe(TextStatistics.Zero);
    }

    [Fact]
    public void Versions_are_listed_newest_first_without_their_text()
    {
        var documents = new DocumentRepository(_fixture.Database);
        var versions = new VersionRepository(_fixture.Database);
        var document = documents.Load(_fixture.First.Id);
        document.Save(Paragraphs("primer borrador"), Moments.At(5));
        versions.Add(document.SaveVersion("Borrador", Moments.At(6)));
        document.Save(Paragraphs("segundo borrador más largo"), Moments.At(7));
        versions.Add(document.SaveVersion(name: null, Moments.At(8)));

        var list = versions.List(_fixture.First.Id);

        list.Select(version => version.CreatedAt).ShouldBe([Moments.At(8), Moments.At(6)]);
        list[0].Name.ShouldBeNull();
        list[1].Name.ShouldBe("Borrador");
        list[1].Kind.ShouldBe(VersionKind.Manual);
        list[1].Statistics.ShouldBe(new TextStatistics(Words: 2, Characters: 15, Paragraphs: 1));
        versions.List(_fixture.Second.Id).ShouldBeEmpty();
    }

    [Fact]
    public void A_version_is_read_back_whole_and_can_be_restored()
    {
        var documents = new DocumentRepository(_fixture.Database);
        var versions = new VersionRepository(_fixture.Database);
        var document = documents.Load(_fixture.First.Id);
        document.Save(Paragraphs("versión antigua"), Moments.At(5));
        var saved = document.SaveVersion("Antigua", Moments.At(6));
        versions.Add(saved);
        document.Save(Paragraphs("texto nuevo"), Moments.At(7));
        documents.Save(document);

        var read = new VersionRepository(_fixture.Reopen()).Load(saved.Id);
        var reloaded = new DocumentRepository(_fixture.Database).Load(_fixture.First.Id);
        var before = reloaded.Restore(read, Moments.At(8)).ShouldNotBeNull();

        read.DocumentId.ShouldBe(_fixture.First.Id);
        read.Kind.ShouldBe(VersionKind.Manual);
        read.Name.ShouldBe("Antigua");
        read.CreatedAt.ShouldBe(Moments.At(6));
        reloaded.Content.ShouldBe(Paragraphs("versión antigua"));
        before.Kind.ShouldBe(VersionKind.BeforeRestore);
        new VersionRepository(_fixture.Database).Add(before);
        new VersionRepository(_fixture.Database).Load(before.Id).Kind.ShouldBe(VersionKind.BeforeRestore);
    }

    [Fact]
    public void Automatic_versions_keep_their_kind()
    {
        var versions = new VersionRepository(_fixture.Database);
        var document = new DocumentRepository(_fixture.Database).Load(_fixture.First.Id);
        var automatic = Enumerable.Range(0, 11)
            .Select(minute => document.Save(Paragraphs($"minuto {minute}"), Moments.At(minute)).AutomaticVersion)
            .OfType<DocumentVersion>()
            .Single();

        versions.Add(automatic);

        versions.Load(automatic.Id).Kind.ShouldBe(VersionKind.Automatic);
    }

    [Fact]
    public void Unknown_versions_are_reported()
    {
        Should.Throw<DomainException>(() => new VersionRepository(_fixture.Database).Load(VersionId.New(Moments.Start)))
            .Error.ShouldBe(DomainError.VersionNotFound);
    }

    [Fact]
    public void Notes_are_saved_updated_listed_and_deleted()
    {
        var notes = new NoteRepository(_fixture.Database);
        var first = Note.Create(_fixture.First.Id, Paragraphs("revisar esta fecha"), anchored: true, [], Moments.At(1));
        var second = Note.Create(_fixture.First.Id, Paragraphs("aquí Antonio aún no conoce a Claudio"), anchored: true, [], Moments.At(2));
        var elsewhere = Note.Create(_fixture.Second.Id, Paragraphs("otra"), anchored: false, [], Moments.At(3));
        notes.Save(first);
        notes.Save(second);
        notes.Save(elsewhere);

        first.Edit(Paragraphs("revisar la fecha de la batalla"), Moments.At(4));
        first.Reconcile(DocumentContent.Empty);
        notes.Save(first);

        var reopened = new NoteRepository(_fixture.Reopen());
        var listed = reopened.ListByDocument(_fixture.First.Id);
        listed.Select(note => note.Id).ShouldBe([first.Id, second.Id]);
        var updated = reopened.Load(first.Id);
        updated.Text.ShouldBe("revisar la fecha de la batalla");
        updated.IsAnchored.ShouldBeFalse();
        updated.CreatedAt.ShouldBe(Moments.At(1));
        updated.UpdatedAt.ShouldBe(Moments.At(4));

        reopened.Delete(second.Id).ShouldBeTrue();
        reopened.Delete(second.Id).ShouldBeFalse();
        reopened.ListByDocument(_fixture.First.Id).ShouldHaveSingleItem().Id.ShouldBe(first.Id);
        Should.Throw<DomainException>(() => reopened.Load(second.Id)).Error.ShouldBe(DomainError.NoteNotFound);
    }

    [Fact]
    public void Saving_text_versions_and_notes_together_is_all_or_nothing()
    {
        var database = _fixture.Database;
        var documents = new DocumentRepository(database);
        var document = documents.Load(_fixture.First.Id);
        document.Save(Paragraphs("texto que no debe quedar"), Moments.At(5));

        Should.Throw<InvalidOperationException>(() => database.InTransaction(() =>
        {
            documents.Save(document);
            new VersionRepository(database).Add(document.SaveVersion("x", Moments.At(6)));
            new NoteRepository(database).Save(Note.Create(_fixture.First.Id, Paragraphs("nota"), anchored: false, [], Moments.At(6)));
            throw new InvalidOperationException("Fallo a mitad de la operación.");
        }));

        documents.Load(_fixture.First.Id).Revision.ShouldBe(0);
        new VersionRepository(database).List(_fixture.First.Id).ShouldBeEmpty();
        new NoteRepository(database).ListByDocument(_fixture.First.Id).ShouldBeEmpty();
    }

    private static void Write(DocumentRepository documents, DocumentId id, string text)
    {
        var document = documents.Load(id);
        document.Save(Paragraphs(text), Moments.At(30));
        documents.Save(document);
    }

    private static DocumentContent Paragraphs(params string[] paragraphs) =>
        DocumentContent.Parse(new JsonObject
        {
            ["type"] = "doc",
            ["content"] = new JsonArray([.. paragraphs.Select(text => (JsonNode)new JsonObject
            {
                ["type"] = "paragraph",
                ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }),
            })]),
        }.ToJsonString());
}
