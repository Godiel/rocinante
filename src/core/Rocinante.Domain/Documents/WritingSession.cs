namespace Rocinante.Domain.Documents;

/// <summary>
/// How much the writer has worked on a document since its last version. Only active writing
/// counts: a pause longer than <see cref="IdleThreshold"/> is not added, so leaving a chapter open
/// overnight does not produce a version in the morning.
/// </summary>
/// <param name="ActiveTime">Writing time accumulated since the last version.</param>
/// <param name="LastEditAt">When the text last changed.</param>
/// <param name="HasUnversionedChanges">Whether the text differs from what the last version captured.</param>
public readonly record struct WritingSession(TimeSpan ActiveTime, DateTimeOffset? LastEditAt, bool HasUnversionedChanges)
{
    /// <summary>Active writing time after which an automatic version is saved.</summary>
    public static readonly TimeSpan AutomaticVersionInterval = TimeSpan.FromMinutes(10);

    /// <summary>Longest gap between two edits that still counts as continuous writing.</summary>
    public static readonly TimeSpan IdleThreshold = TimeSpan.FromMinutes(2);

    public static WritingSession None { get; } = new(TimeSpan.Zero, LastEditAt: null, HasUnversionedChanges: false);

    public bool IsDueForVersion => HasUnversionedChanges && ActiveTime >= AutomaticVersionInterval;

    /// <summary>Records an edit made at <paramref name="now"/>.</summary>
    public WritingSession WithEdit(DateTimeOffset now)
    {
        var gap = now - LastEditAt;
        var active = gap > TimeSpan.Zero && gap <= IdleThreshold ? ActiveTime + gap.Value : ActiveTime;
        return new WritingSession(active, now, HasUnversionedChanges: true);
    }

    /// <summary>The text has just been captured in a version: start counting again.</summary>
    public WritingSession AfterVersion() => this with { ActiveTime = TimeSpan.Zero, HasUnversionedChanges = false };
}
