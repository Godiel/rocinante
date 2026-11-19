using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Formats;
using Rocinante.Domain.Projects;

namespace Rocinante.Application;

/// <summary>A chapter of the book as the page view reads it.</summary>
public sealed record ManuscriptChapter(DocumentId Id, string Title, DocumentContent Content);

/// <summary>Creating, opening, renaming, setting up, copying and closing the project.</summary>
public sealed class ProjectUseCases(Workspace workspace, IProjectFiles files, WriterSettings settings, IChangeNotifier notifier, TimeProvider clock)
{
    /// <summary>
    /// Creates a work with <paramref name="format"/>, or with the format the writer is offered. The
    /// format chosen is offered again for the next work.
    /// </summary>
    public ProjectSnapshot Create(string path, string title, WorkFormat? format, string origin)
    {
        var project = Project.Create(title, clock.GetUtcNow(), format ?? settings.SuggestedFormat);
        var snapshot = SwitchTo(files.Create(path, project), origin);
        settings.RememberFormat(project.Format);
        return snapshot;
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

    /// <summary>Changes how the work is set. The format is offered again for the next new work.</summary>
    public ProjectSnapshot SetFormat(WorkFormat format, string origin)
    {
        ArgumentNullException.ThrowIfNull(format);
        workspace.ChangeIndex(project =>
        {
            project.ChangeFormat(format);
            return project;
        });
        settings.RememberFormat(format);
        var snapshot = workspace.Snapshot();
        notifier.ProjectChanged(snapshot, origin);
        return snapshot;
    }

    /// <summary>The chapters of the work in reading order, with their text. Fragments and the trash are not part of the book.</summary>
    public IReadOnlyList<ManuscriptChapter> Manuscript()
    {
        var documents = workspace.Session.Documents;
        return [.. workspace.Project.Chapters.Select(entry => new ManuscriptChapter(entry.Id, entry.Title, documents.Load(entry.Id).Content))];
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
