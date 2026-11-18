using Rocinante.Application.Ports;

namespace Rocinante.Application.Settings;

/// <summary>
/// The app settings in memory, saved on every change. Paths are compared as the operating system
/// does: without case on Windows, with case elsewhere.
/// </summary>
public sealed class WriterSettings
{
    /// <summary>How many recent projects are remembered.</summary>
    public const int MaxRecent = 10;

    private static readonly StringComparer _paths = OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;

    private readonly ISettingsStore _store;
    private AppSettings _current;

    public WriterSettings(ISettingsStore store)
    {
        ArgumentNullException.ThrowIfNull(store);
        _store = store;
        _current = store.Load();
    }

    public Preferences Preferences => _current.Preferences;

    /// <summary>Most recent first.</summary>
    public IReadOnlyList<RecentProject> Recent => _current.Recent;

    public string? LastProject => _current.LastProject;

    public Preferences Update(PreferencesChange change)
    {
        ArgumentNullException.ThrowIfNull(change);
        Save(_current with { Preferences = change.ApplyTo(_current.Preferences) });
        return Preferences;
    }

    /// <summary>A project was opened: it goes first in the recent list and will reopen on start.</summary>
    public void Remember(string path, string title, DateTimeOffset now)
    {
        var place = Find(path)?.Place;
        var recent = _current.Recent.Where(entry => !Same(entry.Path, path)).Prepend(new RecentProject(path, title, now, place)).Take(MaxRecent);
        Save(_current with { Recent = [.. recent], LastProject = path });
    }

    /// <summary>The writer closed the project: next time the app starts on the welcome screen.</summary>
    public void ForgetLastProject() => Save(_current with { LastProject = null });

    public void Remove(string path) =>
        Save(_current with
        {
            Recent = [.. _current.Recent.Where(entry => !Same(entry.Path, path))],
            LastProject = Same(_current.LastProject, path) ? null : _current.LastProject,
        });

    public Place? PlaceOf(string path) => Find(path)?.Place;

    /// <summary>Remembers where the writer is in a recent project. Does nothing if the place did not change.</summary>
    public void SavePlace(string path, Place place)
    {
        var entry = Find(path);
        if (entry is null || entry.Place == place)
        {
            return;
        }

        Save(_current with { Recent = [.. _current.Recent.Select(recent => ReferenceEquals(recent, entry) ? recent with { Place = place } : recent)] });
    }

    private RecentProject? Find(string path) => _current.Recent.FirstOrDefault(entry => Same(entry.Path, path));

    private static bool Same(string? left, string? right) => left is not null && right is not null && _paths.Equals(left, right);

    private void Save(AppSettings settings)
    {
        _store.Save(settings);
        _current = settings;
    }
}
