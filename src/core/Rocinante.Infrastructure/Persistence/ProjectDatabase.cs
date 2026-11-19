using System.Globalization;
using Microsoft.Data.Sqlite;
using Rocinante.Application.Ports;
using Rocinante.Domain.Projects;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>
/// An open <c>.rocinante</c> file: a SQLite database with one project inside. It keeps a single
/// connection for as long as the project is open. Not thread-safe; the core handles one request
/// at a time.
/// </summary>
public sealed class ProjectDatabase : IDisposable
{
    /// <summary>Written in the SQLite header (<c>PRAGMA application_id</c>): the bytes "ROCI".</summary>
    public const int ApplicationId = 0x524F4349;

    private const int SqliteNotADatabase = 26;
    private const int SqliteCorrupt = 11;

    private readonly SqliteConnection _connection;
    private SqliteTransaction? _transaction;

    private ProjectDatabase(string path, SqliteConnection connection)
    {
        FilePath = path;
        _connection = connection;
    }

    /// <summary>Absolute path of the file.</summary>
    public string FilePath { get; }

    /// <summary>Creates a new project file. Fails if a file already exists at <paramref name="path"/>.</summary>
    public static ProjectDatabase Create(string path, Project project)
    {
        ArgumentNullException.ThrowIfNull(project);

        var fullPath = Path.GetFullPath(path);
        if (File.Exists(fullPath))
        {
            throw new ProjectFileException(ProjectFileError.AlreadyExists, fullPath, "A file already exists at this path.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        var database = new ProjectDatabase(fullPath, Connect(fullPath, SqliteOpenMode.ReadWriteCreate));
        try
        {
            database.Execute(string.Create(CultureInfo.InvariantCulture, $"PRAGMA application_id = {ApplicationId};"));
            database.Configure();
            Migrations.Apply(database);
            new ProjectRepository(database).Save(project);
            return database;
        }
        catch
        {
            database.Dispose();
            DeleteWithCompanions(fullPath);
            throw;
        }
    }

    /// <summary>
    /// Opens an existing project file, after checking it is a project this version understands and
    /// that it is not damaged. Pending migrations are applied.
    /// </summary>
    public static ProjectDatabase Open(string path)
    {
        var fullPath = Path.GetFullPath(path);
        if (!File.Exists(fullPath))
        {
            throw new ProjectFileException(ProjectFileError.NotFound, fullPath, "The project file does not exist.");
        }

        var database = new ProjectDatabase(fullPath, Connect(fullPath, SqliteOpenMode.ReadWrite));
        try
        {
            database.Verify();
            database.Configure();
            Migrations.Apply(database);
            return database;
        }
        catch (SqliteException exception) when (exception.SqliteErrorCode == SqliteNotADatabase)
        {
            database.Dispose();
            throw new ProjectFileException(ProjectFileError.NotAProject, fullPath, "The file is not a SQLite database.", exception);
        }
        catch (SqliteException exception) when (exception.SqliteErrorCode == SqliteCorrupt)
        {
            database.Dispose();
            throw new ProjectFileException(ProjectFileError.Corrupted, fullPath, "The project file is damaged.", exception);
        }
        catch
        {
            database.Dispose();
            throw;
        }
    }

    /// <summary>Writes a complete, consistent copy of the project to a new file.</summary>
    public void SaveCopyAs(string path)
    {
        var fullPath = Path.GetFullPath(path);
        if (File.Exists(fullPath))
        {
            throw new ProjectFileException(ProjectFileError.AlreadyExists, fullPath, "A file already exists at this path.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
        using var target = Connect(fullPath, SqliteOpenMode.ReadWriteCreate);
        target.Open();
        _connection.BackupDatabase(target);
    }

    /// <summary>
    /// Runs <paramref name="work"/> in a transaction: every write inside it is kept, or none is.
    /// Nested calls join the outer transaction.
    /// </summary>
    public T InTransaction<T>(Func<T> work)
    {
        ArgumentNullException.ThrowIfNull(work);

        if (_transaction is not null)
        {
            return work();
        }

        _transaction = _connection.BeginTransaction();
        try
        {
            var result = work();
            _transaction.Commit();
            return result;
        }
        catch
        {
            _transaction.Rollback();
            throw;
        }
        finally
        {
            _transaction.Dispose();
            _transaction = null;
        }
    }

    /// <inheritdoc cref="InTransaction{T}(Func{T})"/>
    public void InTransaction(Action work)
    {
        ArgumentNullException.ThrowIfNull(work);
        InTransaction(() =>
        {
            work();
            return true;
        });
    }

    public void Dispose() => _connection.Dispose();

    /// <summary>A command bound to the current transaction, if there is one.</summary>
    internal SqliteCommand Command(string sql, params (string Name, object? Value)[] parameters)
    {
        var command = _connection.CreateCommand();
        command.Transaction = _transaction;
        command.CommandText = sql;
        foreach (var (name, value) in parameters)
        {
            command.Parameters.AddWithValue(name, value ?? DBNull.Value);
        }

        return command;
    }

    internal int Execute(string sql, params (string Name, object? Value)[] parameters)
    {
        using var command = Command(sql, parameters);
        return command.ExecuteNonQuery();
    }

    internal T? Scalar<T>(string sql, params (string Name, object? Value)[] parameters)
    {
        using var command = Command(sql, parameters);
        var value = command.ExecuteScalar();
        return value is null or DBNull ? default : (T)System.Convert.ChangeType(value, typeof(T), CultureInfo.InvariantCulture);
    }

    /// <summary>The schema version stored in <c>meta</c>; 0 for a file with no schema yet.</summary>
    internal int ReadSchemaVersion()
    {
        var hasMeta = Scalar<long>("SELECT count(*) FROM sqlite_schema WHERE type = 'table' AND name = 'meta';") > 0;
        return hasMeta
            ? int.Parse(Scalar<string>("SELECT value FROM meta WHERE key = 'schema_version';") ?? "0", CultureInfo.InvariantCulture)
            : 0;
    }

    internal void WriteSchemaVersion(int version) =>
        Execute(
            "INSERT INTO meta (key, value) VALUES ('schema_version', $version) ON CONFLICT (key) DO UPDATE SET value = excluded.value;",
            ("$version", version.ToString(CultureInfo.InvariantCulture)));

    private static SqliteConnection Connect(string path, SqliteOpenMode mode)
    {
        // No pooling: closing the project must release the file at once, so it can be moved or copied.
        var connection = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = mode,
            Pooling = false,
        }.ToString());
        connection.Open();
        return connection;
    }

    /// <summary>Read-only checks, so a file that fails them is never modified.</summary>
    private void Verify()
    {
        if (Scalar<long>("PRAGMA application_id;") != ApplicationId)
        {
            throw new ProjectFileException(ProjectFileError.NotAProject, FilePath, "The database is not a Rocinante project.");
        }

        var version = ReadSchemaVersion();
        if (version > Migrations.Latest)
        {
            throw new ProjectFileException(
                ProjectFileError.NewerVersion,
                FilePath,
                $"The project uses schema {version}; this version understands up to {Migrations.Latest}.");
        }

        var integrity = Scalar<string>("PRAGMA integrity_check;");
        if (integrity != "ok")
        {
            throw new ProjectFileException(ProjectFileError.Corrupted, FilePath, $"Integrity check failed: {integrity}");
        }
    }

    private void Configure()
    {
        // WAL keeps the file consistent if the app is killed mid-write; FULL syncs every commit, so a
        // power cut loses at most the save in flight. Both settings are what the spec's
        // "lose at most 2 seconds, never corrupt" requires.
        Execute("PRAGMA journal_mode = WAL;");
        Execute("PRAGMA synchronous = FULL;");
        Execute("PRAGMA foreign_keys = ON;");
    }

    private static void DeleteWithCompanions(string path)
    {
        foreach (var file in new[] { path, path + "-wal", path + "-shm" })
        {
            File.Delete(file);
        }
    }
}
