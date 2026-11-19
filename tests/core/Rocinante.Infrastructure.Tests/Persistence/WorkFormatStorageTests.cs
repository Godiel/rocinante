using System.Globalization;
using Microsoft.Data.Sqlite;
using Rocinante.Application.Ports;
using Rocinante.Domain.Formats;
using Rocinante.Domain.Projects;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class WorkFormatStorageTests : IDisposable
{
    private readonly ProjectFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    private static WorkFormat Pocket => WorkFormat.Create(
        PageSize.Pocket, 110, 170, new PageMargins(14, 18.5, 16, 12), Typeface.LibreBaskerville, 9.5, 1.3, false, false, true);

    [Fact]
    public void A_new_file_keeps_the_format_of_its_work()
    {
        _fixture.Project.Format.ShouldBe(WorkFormat.Default);

        new ProjectRepository(_fixture.Database).Load().Format.ShouldBe(WorkFormat.Default);
    }

    [Fact]
    public void A_changed_format_survives_closing_the_file()
    {
        var projects = new ProjectRepository(_fixture.Database);
        var project = projects.Load();
        project.ChangeFormat(Pocket);
        projects.Save(project);

        new ProjectRepository(_fixture.Reopen()).Load().Format.ShouldBe(Pocket);
        _fixture.Database.Scalar<long>("SELECT count(*) FROM work_format;").ShouldBe(1);
    }

    [Theory]
    [InlineData("page_width = 60")]
    [InlineData("body_size = 20")]
    [InlineData("typeface = 'comic_sans'")]
    [InlineData("margin_inside = 60, margin_outside = 50")]
    [InlineData("margin_top = 80, margin_bottom = 75")]
    public void The_file_itself_refuses_an_impossible_format(string change)
    {
        Should.Throw<SqliteException>(() => _fixture.Database.Execute($"UPDATE work_format SET {change};"));
    }

    [Fact]
    public void A_file_without_its_format_row_is_reported_as_damaged()
    {
        _fixture.Database.Execute("DELETE FROM work_format;");

        Should.Throw<ProjectFileException>(() => new ProjectRepository(_fixture.Database).Load())
            .Error.ShouldBe(ProjectFileError.Corrupted);
    }

    [Fact]
    public void A_work_written_with_schema_version_1_opens_with_the_default_format_and_nothing_lost()
    {
        using var folder = new TempFolder();
        var path = folder.File("primera.rocinante");
        WriteVersion1(path);

        using var database = ProjectDatabase.Open(path);
        var project = new ProjectRepository(database).Load();

        database.ReadSchemaVersion().ShouldBe(Migrations.Latest);
        project.Title.ShouldBe("Escrita con la 001");
        project.Chapters.ShouldHaveSingleItem().Title.ShouldBe("Capítulo primero");
        project.Format.ShouldBe(WorkFormat.Default);
    }

    /// <summary>A project file exactly as the first version of the app left it.</summary>
    private static void WriteVersion1(string path)
    {
        using (var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString()))
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = string.Create(
                CultureInfo.InvariantCulture,
                $$"""
                PRAGMA application_id = {{ProjectDatabase.ApplicationId}};
                {{Migrations.All[0].Sql}}
                INSERT INTO meta (key, value) VALUES ('schema_version', '1');
                INSERT INTO project (id, title, created_at) VALUES ('0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b', 'Escrita con la 001', 0);
                INSERT INTO document (
                    id, kind, title, position, created_at, deleted_at, content, revision, updated_at,
                    words, characters, paragraphs, active_writing_ms, last_edit_at, unversioned_changes)
                VALUES (
                    '0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6c', 'chapter', 'Capítulo primero', 0, 0, NULL,
                    '{"type":"doc","content":[{"type":"paragraph"}]}', 0, 0, 0, 0, 0, 0, NULL, 0);
                """);
            command.ExecuteNonQuery();
        }
    }
}
