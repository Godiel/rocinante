using System.Text;
using Microsoft.Data.Sqlite;
using Rocinante.Domain.Projects;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class ProjectDatabaseTests : IDisposable
{
    private readonly TempFolder _folder = new();

    public void Dispose() => _folder.Dispose();

    [Fact]
    public void Creating_writes_a_rocinante_file_with_the_latest_schema()
    {
        var path = _folder.File("obra.rocinante");

        using (ProjectDatabase.Create(path, Project.Create("Obra", Moments.Start)))
        {
        }

        File.Exists(path).ShouldBeTrue();
        TempFolder.Query(path, "PRAGMA application_id;").ShouldBe((long)ProjectDatabase.ApplicationId);
        TempFolder.Query(path, "SELECT value FROM meta WHERE key = 'schema_version';").ShouldBe(Migrations.Latest.ToString(System.Globalization.CultureInfo.InvariantCulture));
        TempFolder.Query(path, "PRAGMA journal_mode;").ShouldBe("wal");
    }

    [Fact]
    public void Creating_makes_the_missing_folders()
    {
        var path = Path.Combine(_folder.Path, "Documentos", "Rocinante", "obra.rocinante");

        using var database = ProjectDatabase.Create(path, Project.Create("Obra", Moments.Start));

        database.FilePath.ShouldBe(path);
        File.Exists(path).ShouldBeTrue();
    }

    [Fact]
    public void Never_overwrites_an_existing_file()
    {
        var path = _folder.File("existente.rocinante");
        File.WriteAllText(path, "lo que ya había");

        Should.Throw<ProjectFileException>(() => ProjectDatabase.Create(path, Project.Create("Obra", Moments.Start)))
            .Error.ShouldBe(ProjectFileError.AlreadyExists);
        File.ReadAllText(path).ShouldBe("lo que ya había");
    }

    [Fact]
    public void Opening_a_missing_file_is_reported()
    {
        var path = _folder.File("no-existe.rocinante");

        var error = Should.Throw<ProjectFileException>(() => ProjectDatabase.Open(path));

        error.Error.ShouldBe(ProjectFileError.NotFound);
        error.Path.ShouldBe(path);
    }

    [Theory]
    [InlineData("Esto es una carta, no una novela.")]
    [InlineData("")]
    public void Opening_something_that_is_not_a_project_leaves_it_untouched(string text)
    {
        var path = _folder.File("carta.rocinante");
        File.WriteAllText(path, text, Encoding.UTF8);
        var before = File.ReadAllBytes(path);

        Should.Throw<ProjectFileException>(() => ProjectDatabase.Open(path)).Error.ShouldBe(ProjectFileError.NotAProject);

        File.ReadAllBytes(path).ShouldBe(before);
        Directory.GetFiles(_folder.Path).ShouldBe([path]);
    }

    [Fact]
    public void Another_sqlite_database_is_not_a_project()
    {
        var path = _folder.File("otra.db");
        using (var connection = TempFolder.Raw(path))
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "CREATE TABLE cosas (nombre TEXT);";
            command.ExecuteNonQuery();
        }

        var before = File.ReadAllBytes(path);

        Should.Throw<ProjectFileException>(() => ProjectDatabase.Open(path)).Error.ShouldBe(ProjectFileError.NotAProject);
        File.ReadAllBytes(path).ShouldBe(before);
    }

    [Fact]
    public void A_project_from_a_newer_version_is_refused_and_untouched()
    {
        var path = CreateClosed();
        TempFolder.Query(path, "UPDATE meta SET value = '99' WHERE key = 'schema_version';");
        var before = File.ReadAllBytes(path);

        Should.Throw<ProjectFileException>(() => ProjectDatabase.Open(path)).Error.ShouldBe(ProjectFileError.NewerVersion);
        File.ReadAllBytes(path).ShouldBe(before);
    }

    [Fact]
    public void A_damaged_project_is_reported_as_corrupted()
    {
        var path = CreateClosed(chapters: 200);
        var pageSize = Convert.ToInt32(TempFolder.Query(path, "PRAGMA page_size;"), System.Globalization.CultureInfo.InvariantCulture);

        // Keep the header page so the file still looks like a project, and scramble the rest.
        using (var file = new FileStream(path, FileMode.Open, FileAccess.Write))
        {
            file.Position = pageSize;
            file.Write(Enumerable.Repeat((byte)0xA5, (int)(file.Length - pageSize)).ToArray());
        }

        Should.Throw<ProjectFileException>(() => ProjectDatabase.Open(path)).Error.ShouldBe(ProjectFileError.Corrupted);
    }

    [Fact]
    public void Reopening_keeps_the_project_and_applies_no_migration_twice()
    {
        var path = CreateClosed();

        using var database = ProjectDatabase.Open(path);

        database.ReadSchemaVersion().ShouldBe(Migrations.Latest);
        new ProjectRepository(database).Load().Title.ShouldBe("Obra");
    }

    [Fact]
    public void Closing_releases_the_file()
    {
        var path = CreateClosed();
        using (ProjectDatabase.Open(path))
        {
        }

        File.Move(path, _folder.File("movida.rocinante"));
        File.Exists(path).ShouldBeFalse();
    }

    [Fact]
    public void A_transaction_keeps_all_writes_or_none()
    {
        var path = CreateClosed();
        using var database = ProjectDatabase.Open(path);
        var repository = new ProjectRepository(database);
        var project = repository.Load();

        Should.Throw<InvalidOperationException>(() => database.InTransaction(() =>
        {
            project.Rename("Título que no debe quedar");
            repository.Save(project);
            throw new InvalidOperationException("Fallo a mitad de la operación.");
        }));

        repository.Load().Title.ShouldBe("Obra");
    }

    [Fact]
    public void Nested_transactions_commit_together()
    {
        var path = CreateClosed();
        using var database = ProjectDatabase.Open(path);
        var repository = new ProjectRepository(database);
        var project = repository.Load();

        database.InTransaction(() =>
        {
            project.Rename("Segunda parte");
            repository.Save(project);
        });

        repository.Load().Title.ShouldBe("Segunda parte");
    }

    [Fact]
    public void Foreign_keys_are_enforced()
    {
        var path = CreateClosed();
        using var database = ProjectDatabase.Open(path);

        var error = Should.Throw<SqliteException>(() => database.Execute(
            "INSERT INTO note (id, document_id, text, anchored, created_at, updated_at) VALUES ('n', 'no-existe', 'x', 0, 0, 0);"));

        error.SqliteExtendedErrorCode.ShouldBe(787); // SQLITE_CONSTRAINT_FOREIGNKEY
    }

    [Fact]
    public void Save_as_writes_a_complete_copy_that_opens_on_its_own()
    {
        var path = CreateClosed(chapters: 3);
        var copy = Path.Combine(_folder.Path, "copias", "obra-copia.rocinante");
        using (var database = ProjectDatabase.Open(path))
        {
            database.SaveCopyAs(copy);
        }

        using var opened = ProjectDatabase.Open(copy);
        var project = new ProjectRepository(opened).Load();
        project.Title.ShouldBe("Obra");
        project.Chapters.Count.ShouldBe(3);
    }

    [Fact]
    public void Save_as_never_overwrites_an_existing_file()
    {
        var path = CreateClosed();
        var other = _folder.File("otra.rocinante");
        File.WriteAllText(other, "no tocar");
        using var database = ProjectDatabase.Open(path);

        Should.Throw<ProjectFileException>(() => database.SaveCopyAs(other)).Error.ShouldBe(ProjectFileError.AlreadyExists);
        File.ReadAllText(other).ShouldBe("no tocar");
    }

    private string CreateClosed(int chapters = 0)
    {
        var path = _folder.File("obra.rocinante");
        var project = Project.Create("Obra", Moments.Start);
        for (var index = 0; index < chapters; index++)
        {
            project.AddChapter($"Capítulo {index + 1}", Moments.At(index));
        }

        using (ProjectDatabase.Create(path, project))
        {
        }

        return path;
    }
}
