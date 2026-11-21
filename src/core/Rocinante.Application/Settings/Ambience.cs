using System.Text.RegularExpressions;
using Rocinante.Domain;

namespace Rocinante.Application.Settings;

/// <summary>The sound of each keystroke that writes.</summary>
public enum TypingSound
{
    Typewriter,
    Mechanical,
    Quill,
}

/// <summary>What a session of focus mode aims for.</summary>
public enum GoalKind
{
    None,
    Words,
    Minutes,
}

/// <summary>Whether the writer's own file is a background or an ambient sound.</summary>
public enum OwnAmbienceKind
{
    Image,
    Sound,
}

/// <summary>
/// A background or an ambient sound: <c>builtin:&lt;name&gt;</c> for one that comes with the app,
/// <c>own:&lt;id&gt;</c> for one the writer added. The core does not know the built-in ones: the UI
/// keeps that list and shows an unknown one as the default.
/// </summary>
public readonly partial record struct AmbienceId
{
    private AmbienceId(string value) => Value = value;

    public string Value { get; }

    /// <summary>The writer's own file this names, or null for a built-in one.</summary>
    public Guid? Own => Value.StartsWith("own:", StringComparison.Ordinal) ? Guid.Parse(Value.AsSpan(4)) : null;

    public static AmbienceId Builtin(string name) => Parse($"builtin:{name}");

    public static AmbienceId OwnFile(Guid id) => new($"own:{id:D}");

    public static AmbienceId Parse(string value) =>
        TryParse(value, out var id) ? id : throw new FormatException($"'{value}' is not an ambience id.");

    public static bool TryParse(string? value, out AmbienceId id)
    {
        if (value is not null && Shape().IsMatch(value))
        {
            id = new AmbienceId(value);
            return true;
        }

        id = default;
        return false;
    }

    public override string ToString() => Value;

    [GeneratedRegex("^(builtin:[a-z0-9-]{1,40}|own:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$")]
    private static partial Regex Shape();
}

/// <summary>A volume or a level, from 0 (silent) to 1 (full).</summary>
public static class Volume
{
    public static double Checked(double value, string name) =>
        double.IsFinite(value) && value is >= 0 and <= 1 ? value : throw new ArgumentOutOfRangeException(name, value, "A volume goes from 0 to 1.");
}

/// <summary>The typing sound, its volume and its silence; muting keeps the choice and the volume.</summary>
public sealed record Typing
{
    public Typing(TypingSound sound, double volume, bool muted)
    {
        Sound = sound;
        Volume = Settings.Volume.Checked(volume, nameof(volume));
        Muted = muted;
    }

    public TypingSound Sound { get; }

    public double Volume { get; }

    public bool Muted { get; }
}

/// <summary>One looping ambient sound in the mix, at its own level.</summary>
public sealed record Ambient
{
    public Ambient(AmbienceId id, double level)
    {
        Id = id;
        Level = Volume.Checked(level, nameof(level));
    }

    public AmbienceId Id { get; }

    public double Level { get; }
}

/// <summary>Nothing, a number of new words, or a number of minutes.</summary>
public sealed record SessionGoal
{
    public const int MinWords = 50;
    public const int MaxWords = 50_000;
    public const int MinMinutes = 5;
    public const int MaxMinutes = 600;

    private SessionGoal(GoalKind kind, int amount)
    {
        Kind = kind;
        Amount = amount;
    }

    public static SessionGoal None { get; } = new(GoalKind.None, 0);

    public GoalKind Kind { get; }

    /// <summary>Words or minutes; 0 when there is no goal.</summary>
    public int Amount { get; }

    public static SessionGoal Words(int amount) =>
        amount is >= MinWords and <= MaxWords ? new(GoalKind.Words, amount) : throw new ArgumentOutOfRangeException(nameof(amount), amount, "A words goal goes from 50 to 50 000.");

    public static SessionGoal Minutes(int amount) =>
        amount is >= MinMinutes and <= MaxMinutes ? new(GoalKind.Minutes, amount) : throw new ArgumentOutOfRangeException(nameof(amount), amount, "A minutes goal goes from 5 to 600.");
}

/// <summary>
/// The writer's focus mode and sounds: the background behind the sheet, the typing sound, the mix
/// of ambient sounds, dimming the other paragraphs and the session goal. Volumes out of range are a
/// programming error (the contract refuses them on the wire); an ambient that repeats is a rule the
/// writer can break from two windows at once.
/// </summary>
public sealed record Ambience
{
    /// <summary>How many ambient sounds may play at once.</summary>
    public const int MaxAmbients = 6;

    public Ambience(AmbienceId background, Typing typing, IReadOnlyList<Ambient> ambients, double ambientVolume, bool ambientMuted, bool dimOthers, SessionGoal goal)
    {
        ArgumentNullException.ThrowIfNull(typing);
        ArgumentNullException.ThrowIfNull(ambients);
        ArgumentNullException.ThrowIfNull(goal);
        if (ambients.Count > MaxAmbients)
        {
            throw new ArgumentOutOfRangeException(nameof(ambients), ambients.Count, $"At most {MaxAmbients} ambients play at once.");
        }

        if (ambients.Select(ambient => ambient.Id).Distinct().Count() != ambients.Count)
        {
            throw new DomainException(DomainError.AmbientRepeated, "The same ambient sound is in the mix twice.");
        }

        Background = background;
        Typing = typing;
        Ambients = [.. ambients];
        AmbientVolume = Volume.Checked(ambientVolume, nameof(ambientVolume));
        AmbientMuted = ambientMuted;
        DimOthers = dimOthers;
        Goal = goal;
    }

    /// <summary>The background before the writer chooses one: the paper of the theme.</summary>
    public static AmbienceId DefaultBackground { get; } = AmbienceId.Builtin("parchment");

    /// <summary>The paper background, the typewriter muted, no ambients, nothing dimmed and no goal.</summary>
    public static Ambience Default { get; } = new(
        DefaultBackground, new Typing(TypingSound.Typewriter, 0.6, muted: true), [], 0.6, ambientMuted: false, dimOthers: false, SessionGoal.None);

    public AmbienceId Background { get; }

    public Typing Typing { get; }

    public IReadOnlyList<Ambient> Ambients { get; }

    public double AmbientVolume { get; }

    public bool AmbientMuted { get; }

    public bool DimOthers { get; }

    public SessionGoal Goal { get; }

    /// <summary>Every one of the writer's own files this ambience uses.</summary>
    public IEnumerable<Guid> OwnFiles() =>
        Ambients.Select(ambient => ambient.Id).Prepend(Background).Select(id => id.Own).OfType<Guid>();

    /// <summary>The same ambience without the writer's own files that are not in <paramref name="kept"/>.</summary>
    public Ambience Without(Func<Guid, bool> kept)
    {
        ArgumentNullException.ThrowIfNull(kept);
        bool Keeps(AmbienceId id) => id.Own is not { } own || kept(own);

        return new Ambience(
            Keeps(Background) ? Background : DefaultBackground,
            Typing,
            [.. Ambients.Where(ambient => Keeps(ambient.Id))],
            AmbientVolume,
            AmbientMuted,
            DimOthers,
            Goal);
    }

    public bool Equals(Ambience? other) =>
        other is not null
        && Background == other.Background
        && Typing == other.Typing
        && Ambients.SequenceEqual(other.Ambients)
        && AmbientVolume.Equals(other.AmbientVolume)
        && AmbientMuted == other.AmbientMuted
        && DimOthers == other.DimOthers
        && Goal == other.Goal;

    public override int GetHashCode() => HashCode.Combine(Background, Typing, Ambients.Count, AmbientVolume, AmbientMuted, DimOthers, Goal);
}

/// <summary>An image or a sound the writer added, kept as <paramref name="FileName"/> in the app's ambience folder.</summary>
/// <param name="Id">Its identifier; the ambience names it as <c>own:&lt;id&gt;</c>.</param>
/// <param name="Kind">A background or an ambient sound.</param>
/// <param name="Name">The name of the original file, shown to the writer.</param>
/// <param name="FileName">The copy's name inside the ambience folder.</param>
public sealed record OwnAmbience(Guid Id, OwnAmbienceKind Kind, string Name, string FileName);
