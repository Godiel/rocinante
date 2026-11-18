using System.Globalization;
using System.Reflection;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>One step of the schema, from <c>Version - 1</c> to <c>Version</c>.</summary>
internal sealed record Migration(int Version, string Name, string Sql);

/// <summary>
/// Brings a project file up to the schema this core understands. Migrations are SQL files embedded
/// in the assembly, named <c>NNNN-description.sql</c>, and never change once released: a new
/// schema is always a new file.
/// </summary>
internal static class Migrations
{
    private const string ResourcePrefix = "migrations/";

    public static IReadOnlyList<Migration> All { get; } = LoadEmbedded();

    /// <summary>The schema version a file has after every migration.</summary>
    public static int Latest => All[^1].Version;

    /// <summary>Applies the pending migrations in one transaction: either all of them or none.</summary>
    public static void Apply(ProjectDatabase database) => Apply(database, All);

    internal static void Apply(ProjectDatabase database, IReadOnlyList<Migration> migrations)
    {
        database.InTransaction(() =>
        {
            var current = database.ReadSchemaVersion();
            foreach (var migration in migrations.Where(migration => migration.Version > current))
            {
                database.Execute(migration.Sql);
                database.WriteSchemaVersion(migration.Version);
            }
        });
    }

    private static List<Migration> LoadEmbedded()
    {
        var assembly = typeof(Migrations).Assembly;
        var migrations = assembly.GetManifestResourceNames()
            .Where(name => name.StartsWith(ResourcePrefix, StringComparison.Ordinal))
            .Select(name => Read(assembly, name))
            .OrderBy(migration => migration.Version)
            .ToList();

        for (var index = 0; index < migrations.Count; index++)
        {
            if (migrations[index].Version != index + 1)
            {
                throw new InvalidOperationException(
                    $"Migrations must be numbered 1, 2, 3… without gaps; found {migrations[index].Name}.");
            }
        }

        return migrations.Count > 0
            ? migrations
            : throw new InvalidOperationException("No schema migrations are embedded in the assembly.");
    }

    private static Migration Read(Assembly assembly, string resource)
    {
        var name = resource[ResourcePrefix.Length..];
        var version = int.Parse(name.AsSpan(0, name.IndexOf('-', StringComparison.Ordinal)), CultureInfo.InvariantCulture);

        using var stream = assembly.GetManifestResourceStream(resource)!;
        using var reader = new StreamReader(stream);
        return new Migration(version, name, reader.ReadToEnd());
    }
}
