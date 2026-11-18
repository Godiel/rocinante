namespace Rocinante.Tests.Shared;

/// <summary>A clock that only moves when the test says so.</summary>
internal sealed class ManualClock(DateTimeOffset start) : TimeProvider
{
    private DateTimeOffset _now = start;

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan time) => _now += time;

    public void AdvanceMinutes(double minutes) => Advance(TimeSpan.FromMinutes(minutes));
}
