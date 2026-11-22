using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Formats;

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

    /// <summary>What a new work is offered: the last format the writer set up, or the default one.</summary>
    public WorkFormat SuggestedFormat => _current.LastFormat ?? WorkFormat.Default;

    /// <summary>The images and sounds the writer added, in the order they were added.</summary>
    public IReadOnlyList<OwnAmbience> Own => _current.OwnAmbience;

    /// <summary>Changes some preferences. An ambience may only use the writer's own files that are still here.</summary>
    public Preferences Update(PreferencesChange change)
    {
        ArgumentNullException.ThrowIfNull(change);
        foreach (var id in change.Ambience?.OwnFiles() ?? [])
        {
            if (FindOwn(id) is null)
            {
                throw new DomainException(DomainError.AmbienceNotFound, $"The ambience uses own file {id}, which is not there.");
            }
        }

        Save(_current with { Preferences = change.ApplyTo(_current.Preferences) });
        return Preferences;
    }

    public OwnAmbience? FindOwn(Guid id) => Own.FirstOrDefault(own => own.Id == id);

    public void AddOwn(OwnAmbience own)
    {
        ArgumentNullException.ThrowIfNull(own);
        Save(_current with { Own = [.. Own, own] });
    }

    /// <summary>
    /// Keeps only the writer's own files that <paramref name="kept"/> accepts, and stops the
    /// ambience from using the others. Returns whether the preferences changed.
    /// </summary>
    public bool KeepOwn(Func<OwnAmbience, bool> kept)
    {
        ArgumentNullException.ThrowIfNull(kept);
        var own = Own.Where(kept).ToList();
        var ambience = _current.Preferences.Ambience.Without(id => own.Exists(entry => entry.Id == id));
        var preferencesChanged = ambience != _current.Preferences.Ambience;
        if (own.Count != Own.Count || preferencesChanged)
        {
            Save(_current with { Own = own, Preferences = _current.Preferences with { Ambience = ambience } });
        }

        return preferencesChanged;
    }

    /// <summary>A project was opened: it goes first in the recent list and will reopen on start.</summary>
    public void Remember(string path, string title, DateTimeOffset now)
    {
        var place = Find(path)?.Place;
        var recent = _current.Recent.Where(entry => !Same(entry.Path, path)).Prepend(new RecentProject(path, title, now, place)).Take(MaxRecent);
        Save(_current with { Recent = [.. recent], LastProject = path });
    }

    /// <summary>The writer set up a work with <paramref name="format"/>: it is offered for the next one.</summary>
    public void RememberFormat(WorkFormat format)
    {
        ArgumentNullException.ThrowIfNull(format);
        if (format != _current.LastFormat)
        {
            Save(_current with { LastFormat = format });
        }
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
