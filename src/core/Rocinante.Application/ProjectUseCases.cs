using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain.Projects;

namespace Rocinante.Application;

/// <summary>Creating, opening, renaming, copying and closing the project.</summary>
public sealed class ProjectUseCases(Workspace workspace, IProjectFiles files, WriterSettings settings, IChangeNotifier notifier, TimeProvider clock)
{
    public ProjectSnapshot Create(string path, string title, string origin)
    {
        var project = Project.Create(title, clock.GetUtcNow());
        return SwitchTo(files.Create(path, project), origin);
    }

    public ProjectSnapshot Open(string path, string origin) => SwitchTo(files.Open(path), origin);

    public ProjectSnapshot Current() => workspace.Snapshot();

    public ProjectSnapshot Rename(string title, string origin)
    {
        workspace.ChangeIndex(project =>
        {
            project.Rename(title);
            return project;
        });
        var snapshot = workspace.Snapshot();
        Remember(snapshot, origin);
        notifier.ProjectChanged(snapshot, origin);
        return snapshot;
    }

    /// <summary>Copies the project to <paramref name="path"/> and goes on working on the copy, as «Guardar como» does.</summary>
    public ProjectSnapshot SaveAs(string path, string origin)
    {
        workspace.Session.SaveCopyAs(path);
        return SwitchTo(files.Open(path), origin);
    }

    public void Close(string origin)
    {
        if (!workspace.IsOpen)
        {
            throw new ProjectNotOpenException();
        }

        workspace.Close();
        settings.ForgetLastProject();
        notifier.ProjectClosed(origin);
    }

    private ProjectSnapshot SwitchTo(IProjectSession session, string origin)
    {
        try
        {
            workspace.Switch(session);
        }
        catch
        {
            session.Dispose();
            throw;
        }

        var snapshot = workspace.Snapshot();
        Remember(snapshot, origin);
        notifier.ProjectOpened(snapshot, origin);
        return snapshot;
    }

    /// <summary>The project goes first in the recent list and will reopen when the app starts.</summary>
    private void Remember(ProjectSnapshot snapshot, string origin)
    {
        settings.Remember(snapshot.Path, snapshot.Project.Title, clock.GetUtcNow());
        notifier.RecentChanged(RecentProjectView.Of(settings), origin);
    }
}
