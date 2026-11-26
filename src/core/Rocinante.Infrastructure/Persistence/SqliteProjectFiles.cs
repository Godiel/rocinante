using Rocinante.Application.Ports;
using Rocinante.Domain.Projects;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Project files as SQLite databases (see <c>docs/format</c>).</summary>
public sealed class SqliteProjectFiles : IProjectFiles
{
    public IProjectSession Create(string path, Project project) => new SqliteProjectSession(ProjectDatabase.Create(path, project));

    /// <summary>
    /// Opens a project. The notes set aside in the last session, waiting for an undo that can no
    /// longer come, are deleted for good.
    /// </summary>
    public IProjectSession Open(string path)
    {
        var session = new SqliteProjectSession(ProjectDatabase.Open(path));
        try
        {
            session.Notes.PurgeDeleted();
            return session;
        }
        catch
        {
            session.Dispose();
            throw;
        }
    }
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
        Proposals = new ProposalRepository(database);
        Threads = new ThreadRepository(database);
    }

    public string FilePath => _database.FilePath;

    public IProjectRepository Projects { get; }

    public IDocumentRepository Documents { get; }

    public IVersionRepository Versions { get; }

    public INoteRepository Notes { get; }

    public IElementRepository Elements { get; }

    public IProposalRepository Proposals { get; }

    public IThreadRepository Threads { get; }

    public T InTransaction<T>(Func<T> work) => _database.InTransaction(work);

    public void SaveCopyAs(string path) => _database.SaveCopyAs(path);

    public void Dispose() => _database.Dispose();
}
