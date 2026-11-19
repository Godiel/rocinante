using Rocinante.Domain;
using Rocinante.Domain.Formats;

namespace Rocinante.Application.Settings;

/// <summary>Colour theme of the writing surface.</summary>
public enum Theme
{
    /// <summary>Ivory paper and ink.</summary>
    Paper,

    /// <summary>Warm dark, for writing at night.</summary>
    Candlelight,
}

/// <summary>Whether the project index is docked to the side or floats over the text.</summary>
public enum OutlineMode
{
    Docked,
    Floating,
}

/// <summary>How the writer likes to work. They belong to the writer, not to any work.</summary>
public sealed record Preferences(Theme Theme, OutlineMode Outline, bool CounterVisible, bool TypewriterScrolling)
{
    public static Preferences Default { get; } = new(Theme.Paper, OutlineMode.Docked, CounterVisible: true, TypewriterScrolling: true);
}

/// <summary>Some preferences to change; the ones left null stay as they are.</summary>
public sealed record PreferencesChange(Theme? Theme = null, OutlineMode? Outline = null, bool? CounterVisible = null, bool? TypewriterScrolling = null)
{
    public Preferences ApplyTo(Preferences preferences)
    {
        ArgumentNullException.ThrowIfNull(preferences);
        return new(
            Theme ?? preferences.Theme,
            Outline ?? preferences.Outline,
            CounterVisible ?? preferences.CounterVisible,
            TypewriterScrolling ?? preferences.TypewriterScrolling);
    }
}

/// <summary>Where the writer was in a project: a document and a ProseMirror selection in it.</summary>
public sealed record Place(DocumentId DocumentId, int Anchor, int Head);

/// <summary>A project the writer opened, and where they left it.</summary>
public sealed record RecentProject(string Path, string Title, DateTimeOffset LastOpenedAt, Place? Place);

/// <summary>
/// Everything the app remembers between sessions, kept in the app data folder and never in the
/// project: preferences, recent projects, the project to reopen on start, and the format to suggest
/// for the next new work.
/// </summary>
/// <param name="Preferences">How the writer likes to work.</param>
/// <param name="Recent">Recently opened projects, most recent first.</param>
/// <param name="LastProject">The project that was open when the app quit; null if the writer closed it.</param>
/// <param name="LastFormat">The format of the last work the writer set up; null if there is none yet.</param>
public sealed record AppSettings(Preferences Preferences, IReadOnlyList<RecentProject> Recent, string? LastProject, WorkFormat? LastFormat = null)
{
    public static AppSettings Empty { get; } = new(Preferences.Default, [], LastProject: null);
}
