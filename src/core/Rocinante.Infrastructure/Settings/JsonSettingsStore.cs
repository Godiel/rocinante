using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;

namespace Rocinante.Infrastructure.Settings;

/// <summary>
/// Keeps the app settings in <c>settings.json</c> inside the app data folder. Writes go to a
/// temporary file that then replaces the old one, so a crash never leaves half a file. A file that
/// cannot be read is set aside as <c>settings.unreadable-…json</c> and the app starts with defaults:
/// losing preferences must never stop the writer from working.
/// </summary>
public sealed class JsonSettingsStore(string directory, TextWriter log) : ISettingsStore
{
    public const string FileName = "settings.json";
    private const int FormatVersion = 1;

    public string FilePath { get; } = Path.Combine(directory, FileName);

    public AppSettings Load()
    {
        if (!File.Exists(FilePath))
        {
            return AppSettings.Empty;
        }

        try
        {
            var file = JsonSerializer.Deserialize(File.ReadAllText(FilePath), SettingsJson.Default.SettingsFile)
                ?? throw new JsonException("The settings file is empty.");
            return file.Version > FormatVersion
                ? throw new JsonException($"Settings format {file.Version} is newer than {FormatVersion}.")
                : ToSettings(file);
        }
        catch (Exception exception) when (exception is JsonException or NotSupportedException or FormatException or InvalidOperationException)
        {
            var aside = Path.Combine(directory, $"settings.unreadable-{DateTime.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture)}.json");
            File.Move(FilePath, aside, overwrite: true);
            log.WriteLine($"settings: {FilePath} could not be read ({exception.Message}); moved to {aside}, starting with defaults.");
            return AppSettings.Empty;
        }
    }

    public void Save(AppSettings settings)
    {
        ArgumentNullException.ThrowIfNull(settings);

        Directory.CreateDirectory(directory);
        var temporary = FilePath + ".tmp";
        File.WriteAllText(temporary, JsonSerializer.Serialize(ToFile(settings), SettingsJson.Default.SettingsFile));
        File.Move(temporary, FilePath, overwrite: true);
    }

    private static SettingsFile ToFile(AppSettings settings) =>
        new(
            FormatVersion,
            new PreferencesFile(
                settings.Preferences.Theme == Theme.Candlelight ? "candlelight" : "paper",
                settings.Preferences.Outline == OutlineMode.Floating ? "floating" : "docked",
                settings.Preferences.CounterVisible,
                settings.Preferences.TypewriterScrolling),
            settings.LastProject,
            [.. settings.Recent.Select(recent => new RecentFile(
                recent.Path,
                recent.Title,
                recent.LastOpenedAt,
                recent.Place is { } place ? new PlaceFile(place.DocumentId.Value, place.Anchor, place.Head) : null))]);

    // Unknown values (a theme added by a newer version, say) fall back to the default, one by one.
    private static AppSettings ToSettings(SettingsFile file)
    {
        var defaults = Preferences.Default;
        var preferences = file.Preferences is { } stored
            ? new Preferences(
                stored.Theme == "candlelight" ? Theme.Candlelight : defaults.Theme,
                stored.Outline == "floating" ? OutlineMode.Floating : defaults.Outline,
                stored.CounterVisible ?? defaults.CounterVisible,
                stored.TypewriterScrolling ?? defaults.TypewriterScrolling)
            : defaults;

        var recent = (file.Recent ?? [])
            .Where(entry => !string.IsNullOrWhiteSpace(entry.Path) && !string.IsNullOrWhiteSpace(entry.Title))
            .Take(WriterSettings.MaxRecent)
            .Select(entry => new RecentProject(
                entry.Path,
                entry.Title,
                entry.LastOpenedAt,
                entry.Place is { Anchor: >= 0, Head: >= 0 } place ? new Place(new DocumentId(place.DocumentId), place.Anchor, place.Head) : null))
            .ToList();

        return new AppSettings(preferences, recent, file.LastProject);
    }
}

internal sealed record SettingsFile(int Version, PreferencesFile? Preferences, string? LastProject, IReadOnlyList<RecentFile>? Recent);

internal sealed record PreferencesFile(string? Theme, string? Outline, bool? CounterVisible, bool? TypewriterScrolling);

internal sealed record RecentFile(string Path, string Title, DateTimeOffset LastOpenedAt, PlaceFile? Place);

internal sealed record PlaceFile(Guid DocumentId, int Anchor, int Head);

/// <summary>Source-generated serialization: the core is published trimmed.</summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase, WriteIndented = true)]
[JsonSerializable(typeof(SettingsFile))]
internal sealed partial class SettingsJson : JsonSerializerContext;
