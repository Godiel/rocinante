using Microsoft.Data.Sqlite;
using Rocinante.Domain.Projects;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class MigrationsTests : IDisposable
{
    private readonly TempFolder _folder = new();
    private readonly ProjectDatabase _database;

    public MigrationsTests()
    {
        _database = ProjectDatabase.Create(_folder.File("obra.rocinante"), Project.Create("Obra", Moments.Start));
    }

    public void Dispose()
    {
        _database.Dispose();
        _folder.Dispose();
    }

    [Fact]
    public void Embedded_migrations_are_numbered_from_one_without_gaps()
    {
        Migrations.All.Select(migration => migration.Version).ShouldBe(Enumerable.Range(1, Migrations.All.Count));
        Migrations.All[0].Name.ShouldBe("0001-initial.sql");
    }

    [Fact]
    public void Only_pending_migrations_are_applied()
    {
        var next = Migrations.Latest + 1;
        var upgraded = Migrations.All.Append(new Migration(next, "test", "ALTER TABLE project ADD COLUMN subtitle TEXT;")).ToList();

        Migrations.Apply(_database, upgraded);
        Migrations.Apply(_database, upgraded);

        _database.ReadSchemaVersion().ShouldBe(next);
        _database.Scalar<long>("SELECT count(*) FROM pragma_table_info('project') WHERE name = 'subtitle';").ShouldBe(1);
    }

    [Fact]
    public void A_failing_migration_leaves_the_schema_as_it_was()
    {
        var broken = Migrations.All
            .Append(new Migration(Migrations.Latest + 1, "good", "CREATE TABLE board (id TEXT PRIMARY KEY);"))
            .Append(new Migration(Migrations.Latest + 2, "bad", "THIS IS NOT SQL;"))
            .ToList();

        Should.Throw<SqliteException>(() => Migrations.Apply(_database, broken));

        _database.ReadSchemaVersion().ShouldBe(Migrations.Latest);
        _database.Scalar<long>("SELECT count(*) FROM sqlite_schema WHERE name = 'board';").ShouldBe(0);
    }
}
