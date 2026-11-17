using Microsoft.Data.Sqlite;

namespace Rocinante.Sidecar;

/// <summary>
/// Minimal persistence for the walking skeleton: a single document stored as
/// TipTap JSON in a SQLite file. Replaced by the real schema in step 5 of the plan.
/// </summary>
public sealed class SkeletonDocumentStore : IDisposable
{
    private readonly SqliteConnection _connection;

    private SkeletonDocumentStore(SqliteConnection connection) => _connection = connection;

    public static SkeletonDocumentStore Open(string path)
    {
        var directory = Path.GetDirectoryName(Path.GetFullPath(path));
        if (directory is not null)
        {
            Directory.CreateDirectory(directory);
        }

        var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path }.ToString());
        connection.Open();

        using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            CREATE TABLE IF NOT EXISTS document (
                id       INTEGER PRIMARY KEY CHECK (id = 1),
                content  TEXT    NOT NULL,
                revision INTEGER NOT NULL
            );
            """;
        command.ExecuteNonQuery();

        return new SkeletonDocumentStore(connection);
    }

    public (string? Content, long Revision) Read()
    {
        using var command = _connection.CreateCommand();
        command.CommandText = "SELECT content, revision FROM document WHERE id = 1";
        using var reader = command.ExecuteReader();
        return reader.Read() ? (reader.GetString(0), reader.GetInt64(1)) : (null, 0);
    }

    public long Save(string content)
    {
        using var transaction = _connection.BeginTransaction();
        using var command = _connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            INSERT INTO document (id, content, revision) VALUES (1, $content, 1)
            ON CONFLICT (id) DO UPDATE SET content = excluded.content, revision = revision + 1
            RETURNING revision;
            """;
        command.Parameters.AddWithValue("$content", content);
        var revision = (long)command.ExecuteScalar()!;
        transaction.Commit();
        return revision;
    }

    public void Dispose() => _connection.Dispose();
}
