using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Formats;

namespace Rocinante.Application;

/// <summary>A recent project as the welcome screen shows it.</summary>
public sealed record RecentProjectView(string Path, string Title, DateTimeOffset LastOpenedAt, bool Exists)
{
    /// <summary>The recent list, checking whether each file is still there.</summary>
    public static IReadOnlyList<RecentProjectView> Of(WriterSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);
        return [.. settings.Recent.Select(entry => new RecentProjectView(entry.Path, entry.Title, entry.LastOpenedAt, File.Exists(entry.Path)))];
    }
}

/// <summary>Why the project to reopen on start could not be opened.</summary>
public sealed record StartProblem(string Path, ProjectFileError Error);

/// <summary>What a window shows when it starts.</summary>
public sealed record StartState(
    ProjectSnapshot? Project,
    Place? Place,
    StartProblem? Problem,
    IReadOnlyList<RecentProjectView> Recent,
    Preferences Preferences,
    string DefaultFolder,
    WorkFormat SuggestedFormat,
    IReadOnlyList<OwnAmbienceView> OwnAmbience);

/// <summary>Preferences, recent projects, where the writer left each project, and what to open on start.</summary>
public sealed class SettingsUseCases(
    Workspace workspace, ProjectUseCases projects, AmbienceUseCases ambience, WriterSettings settings, IChangeNotifier notifier, string defaultFolder, string? launchFile)
{
    private string? _launchFile = launchFile;

    /// <summary>
    /// The first window opens the file the app was launched with, or else the project left open
    /// last time. Later windows get the project that is already open. A project that cannot be
    /// opened is reported and, if it was the one to reopen, forgotten, so the next start shows the
    /// welcome screen.
    /// </summary>
    public StartState Start(string origin)
    {
        if (!workspace.IsOpen && TakeProjectToOpen() is var (path, reopening) && path is not null)
        {
            try
            {
                projects.Open(path, origin);
            }
            catch (ProjectFileException exception)
            {
                if (reopening)
                {
                    settings.ForgetLastProject();
                }

                return State(new StartProblem(exception.Path, exception.Error));
            }
        }

        return State(problem: null);
    }

    public Preferences UpdatePreferences(PreferencesChange change, string origin)
    {
        var preferences = settings.Update(change);
        notifier.PreferencesChanged(preferences, origin);
        return preferences;
    }

    public IReadOnlyList<RecentProjectView> Recent() => RecentProjectView.Of(settings);

    public IReadOnlyList<RecentProjectView> RemoveRecent(string path, string origin)
    {
        settings.Remove(Path.GetFullPath(path));
        var recent = Recent();
        notifier.RecentChanged(recent, origin);
        return recent;
    }

    /// <summary>Where the writer left the open project, if that document is still in the work.</summary>
    public Place? CurrentPlace()
    {
        var place = settings.PlaceOf(workspace.Session.FilePath);
        return place is not null && IsInWork(place.DocumentId) ? place : null;
    }

    public void SavePlace(Place place)
    {
        ArgumentNullException.ThrowIfNull(place);
        workspace.ActiveEntry(place.DocumentId);
        settings.SavePlace(workspace.Session.FilePath, place);
    }

    /// <summary>The file the app was launched with (only once), or else the project to reopen.</summary>
    private (string? Path, bool Reopening) TakeProjectToOpen()
    {
        var launched = _launchFile;
        _launchFile = null;
        return launched is not null ? (launched, false) : (settings.LastProject, true);
    }

    private bool IsInWork(DocumentId id)
    {
        try
        {
            workspace.ActiveEntry(id);
            return true;
        }
        catch (DomainException)
        {
            return false;
        }
    }

    private StartState State(StartProblem? problem) =>
        new(
            workspace.IsOpen ? workspace.Snapshot() : null,
            workspace.IsOpen ? CurrentPlace() : null,
            problem,
            Recent(),
            settings.Preferences,
            defaultFolder,
            settings.SuggestedFormat,
            ambience.Own());
}
