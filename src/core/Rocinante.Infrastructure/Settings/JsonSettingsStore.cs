using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Formats;

namespace Rocinante.Infrastructure.Settings;

/// <summary>
/// Keeps the app settings in <c>settings.json</c> inside the app data folder. Writes go to a
/// temporary file that then replaces the old one, so a crash never leaves half a file. A file that
/// cannot be read is set aside as <c>settings.unreadable-…json</c> and the app starts with defaults:
/// losing preferences must never stop the writer from working. A suggested format that is no longer
/// valid is dropped on its own, and the default is offered instead.
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
                settings.Preferences.TypewriterScrolling,
                ToFile(settings.Preferences.Ambience),
                settings.Preferences.MentionsVisible,
                settings.Preferences.CorrectionVisible),
            settings.LastProject,
            [.. settings.Recent.Select(recent => new RecentFile(
                recent.Path,
                recent.Title,
                recent.LastOpenedAt,
                recent.Place is { } place ? new PlaceFile(place.DocumentId.Value, place.Anchor, place.Head) : null))],
            settings.LastFormat is { } format ? ToFile(format) : null,
            [.. settings.OwnAmbience.Select(own => new OwnFile(own.Id, Name(own.Kind), own.Name, own.FileName))],
            settings.Dictionary,
            settings.Squire is { } squire ? new SquireFile(squire.Provider, squire.Model, squire.Endpoint) : null);

    private static string Name<T>(T value)
        where T : struct, Enum => JsonNamingPolicy.CamelCase.ConvertName(value.ToString());

    private static bool TryParse<T>(string? name, out T value)
        where T : struct, Enum => Enum.TryParse(name, ignoreCase: true, out value) && Enum.IsDefined(value) && !int.TryParse(name, out _);

    private static AmbienceFile ToFile(Ambience ambience) =>
        new(
            ambience.Background.Value,
            new TypingFile(Name(ambience.Typing.Sound), ambience.Typing.Volume, ambience.Typing.Muted),
            [.. ambience.Ambients.Select(ambient => new AmbientFile(ambient.Id.Value, ambient.Level))],
            ambience.AmbientVolume,
            ambience.AmbientMuted,
            ambience.DimOthers,
            new GoalFile(Name(ambience.Goal.Kind), ambience.Goal.Kind == GoalKind.None ? null : ambience.Goal.Amount));

    // Field by field, like the rest of the preferences: what no longer makes sense falls back to
    // the default, and the rest is kept. A repeated ambient keeps its first appearance.
    private static Ambience ToAmbience(AmbienceFile? file)
    {
        var defaults = Ambience.Default;
        if (file is null)
        {
            return defaults;
        }

        var typing = file.Typing is { } storedTyping && TryParse<TypingSound>(storedTyping.Sound, out var sound) && IsVolume(storedTyping.Volume)
            ? new Typing(sound, storedTyping.Volume!.Value, storedTyping.Muted ?? defaults.Typing.Muted)
            : defaults.Typing;
        var ambients = (file.Ambients ?? [])
            .Where(ambient => AmbienceId.TryParse(ambient.Id, out _) && IsVolume(ambient.Level))
            .Select(ambient => new Ambient(AmbienceId.Parse(ambient.Id!), ambient.Level!.Value))
            .DistinctBy(ambient => ambient.Id)
            .Take(Ambience.MaxAmbients)
            .ToList();

        return new Ambience(
            AmbienceId.TryParse(file.Background, out var background) ? background : defaults.Background,
            typing,
            ambients,
            IsVolume(file.AmbientVolume) ? file.AmbientVolume!.Value : defaults.AmbientVolume,
            file.AmbientMuted ?? defaults.AmbientMuted,
            file.DimOthers ?? defaults.DimOthers,
            ToGoal(file.Goal));
    }

    private static bool IsVolume(double? value) => value is { } volume && double.IsFinite(volume) && volume is >= 0 and <= 1;

    private static SessionGoal ToGoal(GoalFile? file) =>
        file is null || !TryParse<GoalKind>(file.Kind, out var kind) ? SessionGoal.None
        : kind == GoalKind.Words && file.Amount is >= SessionGoal.MinWords and <= SessionGoal.MaxWords ? SessionGoal.Words(file.Amount.Value)
        : kind == GoalKind.Minutes && file.Amount is >= SessionGoal.MinMinutes and <= SessionGoal.MaxMinutes ? SessionGoal.Minutes(file.Amount.Value)
        : SessionGoal.None;

    private static List<OwnAmbience> ToOwn(IReadOnlyList<OwnFile>? files) =>
        [.. (files ?? [])
            .Where(file => TryParse<OwnAmbienceKind>(file.Kind, out _)
                && !string.IsNullOrWhiteSpace(file.Name)
                && file.FileName is { Length: > 0 } name
                && Path.GetFileName(name) == name)
            .Select(file => new OwnAmbience(file.Id, Enum.Parse<OwnAmbienceKind>(file.Kind!, ignoreCase: true), file.Name!, file.FileName!))
            .DistinctBy(file => file.Id)];

    private static FormatFile ToFile(WorkFormat format) =>
        new(
            JsonNamingPolicy.CamelCase.ConvertName(format.PageSize.ToString()),
            format.PageWidth,
            format.PageHeight,
            new MarginsFile(format.Margins.Top, format.Margins.Bottom, format.Margins.Inside, format.Margins.Outside),
            JsonNamingPolicy.CamelCase.ConvertName(format.Typeface.ToString()),
            format.BodySize,
            format.Leading,
            format.FirstLineIndent,
            format.Justified,
            format.DropCap);

    private static WorkFormat? ToFormat(FormatFile? file)
    {
        if (file?.Margins is not { } margins
            || !Enum.TryParse<PageSize>(file.PageSize, ignoreCase: true, out var size)
            || !Enum.TryParse<Typeface>(file.Typeface, ignoreCase: true, out var typeface))
        {
            return null;
        }

        try
        {
            return WorkFormat.Create(
                size,
                file.PageWidth,
                file.PageHeight,
                new PageMargins(margins.Top, margins.Bottom, margins.Inside, margins.Outside),
                typeface,
                file.BodySize,
                file.Leading,
                file.FirstLineIndent,
                file.Justified,
                file.DropCap);
        }
        catch (DomainException)
        {
            return null;
        }
    }

    // Unknown values (a theme added by a newer version, say) fall back to the default, one by one.
    private static AppSettings ToSettings(SettingsFile file)
    {
        var defaults = Preferences.Default;
        var preferences = file.Preferences is { } stored
            ? new Preferences(
                stored.Theme == "candlelight" ? Theme.Candlelight : defaults.Theme,
                stored.Outline == "floating" ? OutlineMode.Floating : defaults.Outline,
                stored.CounterVisible ?? defaults.CounterVisible,
                stored.TypewriterScrolling ?? defaults.TypewriterScrolling,
                ToAmbience(stored.Ambience),
                stored.MentionsVisible ?? defaults.MentionsVisible,
                stored.CorrectionVisible ?? defaults.CorrectionVisible)
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

        // An ambience that names an own file which is not listed is fixed here, not at the door.
        var own = ToOwn(file.OwnAmbience);
        preferences = preferences with { Ambience = preferences.Ambience.Without(id => own.Exists(entry => entry.Id == id)) };

        var words = (file.Dictionary ?? [])
            .Where(word => !string.IsNullOrWhiteSpace(word) && word.Length <= WriterSettings.MaxDictionaryWordLength && !word.Any(char.IsWhiteSpace))
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .Take(WriterSettings.MaxDictionaryWords)
            .ToList();
        var squire = file.Squire is { Provider: { } provider, Model: { } model } && !string.IsNullOrWhiteSpace(model)
            ? new SquireChoice(provider, model, file.Squire.Endpoint)
            : null;
        return new AppSettings(preferences, recent, file.LastProject, ToFormat(file.LastFormat), own, words, squire);
    }
}

internal sealed record SettingsFile(
    int Version,
    PreferencesFile? Preferences,
    string? LastProject,
    IReadOnlyList<RecentFile>? Recent,
    FormatFile? LastFormat,
    IReadOnlyList<OwnFile>? OwnAmbience,
    IReadOnlyList<string>? Dictionary = null,
    SquireFile? Squire = null);

internal sealed record SquireFile(string? Provider, string? Model, string? Endpoint);

internal sealed record AmbienceFile(
    string? Background, TypingFile? Typing, IReadOnlyList<AmbientFile>? Ambients, double? AmbientVolume, bool? AmbientMuted, bool? DimOthers, GoalFile? Goal);

internal sealed record TypingFile(string? Sound, double? Volume, bool? Muted);

internal sealed record AmbientFile(string? Id, double? Level);

internal sealed record GoalFile(string? Kind, int? Amount);

internal sealed record OwnFile(Guid Id, string? Kind, string? Name, string? FileName);

internal sealed record FormatFile(
    string? PageSize,
    double PageWidth,
    double PageHeight,
    MarginsFile? Margins,
    string? Typeface,
    double BodySize,
    double Leading,
    bool FirstLineIndent,
    bool Justified,
    bool DropCap);

internal sealed record MarginsFile(double Top, double Bottom, double Inside, double Outside);

internal sealed record PreferencesFile(
    string? Theme,
    string? Outline,
    bool? CounterVisible,
    bool? TypewriterScrolling,
    AmbienceFile? Ambience,
    bool? MentionsVisible = null,
    bool? CorrectionVisible = null);

internal sealed record RecentFile(string Path, string Title, DateTimeOffset LastOpenedAt, PlaceFile? Place);

internal sealed record PlaceFile(Guid DocumentId, int Anchor, int Head);

/// <summary>Source-generated serialization: the core is published trimmed.</summary>
[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase, WriteIndented = true)]
[JsonSerializable(typeof(SettingsFile))]
internal sealed partial class SettingsJson : JsonSerializerContext;
