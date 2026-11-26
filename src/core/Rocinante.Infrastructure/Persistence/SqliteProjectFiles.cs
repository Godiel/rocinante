using Rocinante.Application.Ports;
using Rocinante.Domain.Projects;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Project files as SQLite databases (see <c>docs/format</c>).</summary>
public sealed class SqliteProjectFiles : IProjectFiles
{
    public IProjectSession Create(string path, Project project) => new SqliteProjectSession(ProjectDatabase.Create(path, project));

    public IProjectSession Open(string path) => new SqliteProjectSession(ProjectDatabase.Open(path));
}

/// <summary>An open <see cref="ProjectDatabase"/> with its repositories.</summary>
public sealed class SqliteProjectSession : IProjectSession
{
    private readonly ProjectDatabase _database;

    public SqliteProjectSession(ProjectDatabase database)
    {
        _database = database;
        Projects = new ProjectRepository(database);
        Documents = new DocumentRepository(database);
        Versions = new VersionRepository(database);
        Notes = new NoteRepository(database);
        Elements = new ElementRepository(database);
    }

    public string FilePath => _database.FilePath;

    public IProjectRepository Projects { get; }

    public IDocumentRepository Documents { get; }

    public IVersionRepository Versions { get; }

    public INoteRepository Notes { get; }

    public IElementRepository Elements { get; }

    public T InTransaction<T>(Func<T> work) => _database.InTransaction(work);

    public void SaveCopyAs(string path) => _database.SaveCopyAs(path);

    public void Dispose() => _database.Dispose();
}
