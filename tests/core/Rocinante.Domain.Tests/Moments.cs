namespace Rocinante.Domain.Tests;

/// <summary>Fixed instants, so tests read as "minute 3" instead of raw timestamps.</summary>
internal static class Moments
{
    public static readonly DateTimeOffset Start = new(2026, 3, 14, 9, 0, 0, TimeSpan.Zero);

    public static DateTimeOffset At(double minutes) => Start.AddMinutes(minutes);
}
