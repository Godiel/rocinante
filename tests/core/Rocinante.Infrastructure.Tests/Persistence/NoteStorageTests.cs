using System.Globalization;
using Microsoft.Data.Sqlite;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Notes;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class NoteStorageTests : IDisposable
{
    private readonly ProjectFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    private NoteRepository Notes => new(_fixture.Database);

    private static DocumentContent Text(string text) => DocumentContent.FromPlainText(text);

    private Element SavedElement(string name)
    {
        var element = new ElementBoard().Create(ElementKind.Character, null, name, null, null, Moments.Start);
        new ElementRepository(_fixture.Database).Save(element);
        return element;
    }

    [Fact]
    public void Every_part_of_a_note_survives_closing_the_file()
    {
        var antonio = SavedElement("Antonio");
        var claudio = SavedElement("Claudio");
        var note = Note.Create(_fixture.First.Id, Text("aquí Antonio\naún no conoce a Claudio"), anchored: true, [claudio.Id, antonio.Id], Moments.At(1));
        note.Reconcile(DocumentContent.Parse(
            $$$"""{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"x","marks":[{"type":"noteAnchor","attrs":{"noteId":"{{{note.Id}}}"}}]}]}]}"""));
        note.Resolve(Moments.At(2));
        Notes.Save(note);

        var stored = new NoteRepository(_fixture.Reopen()).Load(note.Id);

        stored.DocumentId.ShouldBe(_fixture.First.Id);
        stored.Content.ShouldBe(note.Content);
        stored.Text.ShouldBe("aquí Antonio\naún no conoce a Claudio");
        stored.IsAnchored.ShouldBeTrue();
        stored.AnchorOrder.ShouldBe(0);
        stored.ResolvedAt.ShouldBe(Moments.At(2));
        stored.Elements.ShouldBe([claudio.Id, antonio.Id]);
        stored.CreatedAt.ShouldBe(Moments.At(1));
        stored.UpdatedAt.ShouldBe(Moments.At(2));
        stored.DeletedAt.ShouldBeNull();
    }

    [Fact]
    public void A_loose_idea_is_stored_without_a_document()
    {
        var idea = Note.Create(documentId: null, Text("un final en el Toboso"), anchored: false, [], Moments.At(1));
        Notes.Save(idea);

        var stored = new NoteRepository(_fixture.Reopen()).Load(idea.Id);

        stored.DocumentId.ShouldBeNull();
        stored.Text.ShouldBe("un final en el Toboso");
    }

    [Fact]
    public void Saving_again_replaces_the_links_and_keeps_their_order()
    {
        var antonio = SavedElement("Antonio");
        var claudio = SavedElement("Claudio");
        var note = Note.Create(null, Text("idea"), anchored: false, [antonio.Id, claudio.Id], Moments.At(1));
        Notes.Save(note);

        note.LinkWith([claudio.Id], Moments.At(2));
        Notes.Save(note);

        Notes.Load(note.Id).Elements.ShouldBe([claudio.Id]);
    }

    [Fact]
    public void The_notes_shown_leave_out_those_set_aside_and_those_of_documents_in_the_trash()
    {
        var idea = Note.Create(null, Text("idea"), anchored: false, [], Moments.At(1));
        var onFirst = Note.Create(_fixture.First.Id, Text("en el primero"), anchored: false, [], Moments.At(2));
        var onSecond = Note.Create(_fixture.Second.Id, Text("en el segundo"), anchored: false, [], Moments.At(3));
        var setAside = Note.Create(_fixture.First.Id, Text("apartada"), anchored: false, [], Moments.At(4));
        setAside.Delete(Moments.At(5));
        foreach (var note in new[] { idea, onFirst, onSecond, setAside })
        {
            Notes.Save(note);
        }

        var projects = new ProjectRepository(_fixture.Database);
        var project = projects.Load();
        project.Delete(_fixture.Second.Id, Moments.At(6));
        projects.Save(project);

        Notes.ListShown().Select(note => note.Id).ShouldBe([idea.Id, onFirst.Id]);
        Notes.ListByDocument(_fixture.First.Id).Select(note => note.Id).ShouldBe([onFirst.Id, setAside.Id]);
    }

    [Fact]
    public void Opening_the_work_deletes_for_good_the_notes_set_aside()
    {
        var kept = Note.Create(_fixture.First.Id, Text("se queda"), anchored: false, [], Moments.At(1));
        var setAside = Note.Create(null, Text("se va"), anchored: false, [SavedElement("Antonio").Id], Moments.At(2));
        setAside.Delete(Moments.At(3));
        Notes.Save(kept);
        Notes.Save(setAside);
        _fixture.Database.Dispose();

        using (var session = new SqliteProjectFiles().Open(_fixture.Path))
        {
            session.Notes.ListByDocument(_fixture.First.Id).ShouldHaveSingleItem().Id.ShouldBe(kept.Id);
            Should.Throw<DomainException>(() => session.Notes.Load(setAside.Id)).Error.ShouldBe(DomainError.NoteNotFound);
        }

        using var database = ProjectDatabase.Open(_fixture.Path);
        using var links = database.Command("SELECT count(*) FROM note_element;");
        links.ExecuteScalar().ShouldBe(0L);
    }

    [Fact]
    public void A_change_cut_short_leaves_nothing_half_written()
    {
        var note = Note.Create(null, Text("idea"), anchored: false, [SavedElement("Antonio").Id], Moments.At(1));

        Should.Throw<InvalidOperationException>(() => _fixture.Database.InTransaction(() =>
        {
            Notes.Save(note);
            throw new InvalidOperationException("The power went out.");
        }));

        var reopened = new NoteRepository(_fixture.Reopen());
        reopened.ListShown().ShouldBeEmpty();
    }

    [Fact]
    public void A_copy_of_the_work_takes_its_notes_and_their_links()
    {
        var antonio = SavedElement("Antonio");
        var note = Note.Create(null, Text("idea"), anchored: false, [antonio.Id], Moments.At(1));
        Notes.Save(note);

        using var folder = new TempFolder();
        var copyPath = folder.File("copia.rocinante");
        _fixture.Database.SaveCopyAs(copyPath);

        using var copy = ProjectDatabase.Open(copyPath);
        new NoteRepository(copy).ListShown().ShouldHaveSingleItem().Elements.ShouldBe([antonio.Id]);
    }

    [Theory]
    [InlineData("INSERT INTO note (id, document_id, text, anchored, created_at, updated_at) VALUES ('n', NULL, 'idea', 1, 0, 0);")]
    [InlineData("INSERT INTO note (id, document_id, text, anchored, created_at, updated_at) VALUES ('n', NULL, '', 0, 0, 0);")]
    [InlineData("INSERT INTO note (id, document_id, text, anchored, anchor_order, created_at, updated_at) VALUES ('n', NULL, 'idea', 0, 2, 0, 0);")]
    [InlineData("INSERT INTO note_element (note_id, element_id, position) VALUES ('nadie', 'nadie', 0);")]
    public void The_file_itself_refuses_impossible_notes(string insert)
    {
        Should.Throw<SqliteException>(() => _fixture.Database.Execute(insert));
    }

    [Fact]
    public void A_work_written_with_schema_version_3_opens_with_every_note_as_it_was()
    {
        using var folder = new TempFolder();
        var path = folder.File("tercera.rocinante");
        const string chapter = "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6c";
        var longText = new string('a', Note.MaxTextLength);
        using (var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString()))
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = string.Create(
                CultureInfo.InvariantCulture,
                $$"""
                PRAGMA application_id = {{ProjectDatabase.ApplicationId}};
                {{Migrations.All[0].Sql}}
                {{Migrations.All[1].Sql}}
                {{Migrations.All[2].Sql}}
                INSERT INTO meta (key, value) VALUES ('schema_version', '3');
                INSERT INTO project (id, title, created_at) VALUES ('0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b', 'Escrita con la 004', 0);
                INSERT INTO document (id, kind, title, position, created_at, content, revision, updated_at, words, characters, paragraphs, active_writing_ms, unversioned_changes)
                VALUES ('{{chapter}}', 'chapter', 'Uno', 0, 0, '{"type":"doc"}', 0, 0, 0, 0, 0, 0, 0);
                INSERT INTO note (id, document_id, text, anchored, created_at, updated_at) VALUES
                    ('0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a01', '{{chapter}}', 'revisar esta fecha', 1, 1, 1),
                    ('0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a02', '{{chapter}}', 'el pasaje ya no está
                y sigue aquí', 0, 2, 3),
                    ('0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a03', '{{chapter}}', '{{longText}}', 0, 4, 4);
                """);
            command.ExecuteNonQuery();
        }

        using var database = ProjectDatabase.Open(path);

        database.ReadSchemaVersion().ShouldBe(Migrations.Latest);
        var notes = new NoteRepository(database).ListShown();
        notes.Select(note => note.Text).ShouldBe(["revisar esta fecha", "el pasaje ya no está\ny sigue aquí", longText]);
        notes.Select(note => note.IsAnchored).ShouldBe([true, false, false]);
        notes.ShouldAllBe(note => note.DocumentId == new DocumentId(Guid.Parse(chapter)) && note.Elements.Count == 0 && !note.IsResolved);
        notes[1].Content.ShouldBe(DocumentContent.FromPlainText("el pasaje ya no está\ny sigue aquí"));
        notes[1].UpdatedAt.ShouldBe(DateTimeOffset.FromUnixTimeMilliseconds(3));
    }
}
