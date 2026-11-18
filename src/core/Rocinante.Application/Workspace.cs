using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Projects;

namespace Rocinante.Application;

/// <summary>
/// The project the app has open, if any: the file session and the project index kept in memory.
/// There is one per core, shared by every window. Not thread-safe; requests arrive one at a time.
/// </summary>
public sealed class Workspace : IDisposable
{
    private IProjectSession? _session;
    private Project? _project;

    public bool IsOpen => _session is not null;

    public IProjectSession Session => _session ?? throw new ProjectNotOpenException();

    public Project Project => _project ?? throw new ProjectNotOpenException();

    public ProjectSnapshot Snapshot() => new(Session.FilePath, Project, Session.Documents.WorkStatistics());

    /// <summary>Starts working on <paramref name="session"/>, closing the previous project.</summary>
    public void Switch(IProjectSession session)
    {
        ArgumentNullException.ThrowIfNull(session);

        var project = session.Projects.Load();
        Close();
        _session = session;
        _project = project;
    }

    public void Close()
    {
        _session?.Dispose();
        _session = null;
        _project = null;
    }

    /// <summary>
    /// Applies a change to the index and saves it. If anything fails, the index is reloaded from the
    /// file, so memory never drifts from what is stored.
    /// </summary>
    public T ChangeIndex<T>(Func<Project, T> change)
    {
        ArgumentNullException.ThrowIfNull(change);

        var session = Session;
        var project = Project;
        try
        {
            return session.InTransaction(() =>
            {
                var result = change(project);
                session.Projects.Save(project);
                return result;
            });
        }
        catch
        {
            _project = session.Projects.Load();
            throw;
        }
    }

    /// <summary>The index entry of a document that is in the work, not in the trash.</summary>
    public DocumentEntry ActiveEntry(DocumentId id)
    {
        var entry = Project.Find(id);
        return entry.IsDeleted
            ? throw new DomainException(DomainError.DocumentIsDeleted, $"Document {id} is in the trash.")
            : entry;
    }

    public void Dispose() => Close();
}
