using Microsoft.Data.Sqlite;

namespace Rocinante.Infrastructure.Tests;

/// <summary>A folder of its own for each test, deleted afterwards.</summary>
internal sealed class TempFolder : IDisposable
{
    public string Path { get; } = Directory.CreateTempSubdirectory("rocinante-tests-").FullName;

    public string File(string name) => System.IO.Path.Combine(Path, name);

    /// <summary>Opens the file with plain SQLite, outside the code under test, to inspect or tamper with it.</summary>
    public static SqliteConnection Raw(string path)
    {
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString());
        connection.Open();
        return connection;
    }

    public static object? Query(string path, string sql)
    {
        using var connection = Raw(path);
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        return command.ExecuteScalar();
    }

    public void Dispose() => Directory.Delete(Path, recursive: true);
}
