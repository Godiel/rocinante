using Rocinante.Domain.Documents;

namespace Rocinante.Domain.Tests.Documents;

public sealed class WritingSessionTests
{
    [Fact]
    public void The_first_edit_starts_the_session_without_adding_time()
    {
        var session = WritingSession.None.WithEdit(Moments.At(0));

        session.ShouldBe(new WritingSession(TimeSpan.Zero, Moments.At(0), HasUnversionedChanges: true));
    }

    [Fact]
    public void Gaps_up_to_the_idle_threshold_count_as_writing()
    {
        var session = WritingSession.None.WithEdit(Moments.At(0)).WithEdit(Moments.At(2));

        session.ActiveTime.ShouldBe(WritingSession.IdleThreshold);
    }

    [Fact]
    public void Longer_gaps_do_not_count()
    {
        var session = WritingSession.None.WithEdit(Moments.At(0)).WithEdit(Moments.At(2.5));

        session.ActiveTime.ShouldBe(TimeSpan.Zero);
        session.LastEditAt.ShouldBe(Moments.At(2.5));
    }

    [Fact]
    public void A_clock_going_backwards_adds_no_time()
    {
        var session = WritingSession.None.WithEdit(Moments.At(5)).WithEdit(Moments.At(4));

        session.ActiveTime.ShouldBe(TimeSpan.Zero);
    }

    [Fact]
    public void A_version_is_due_only_with_changes_and_enough_time()
    {
        var enoughTime = new WritingSession(WritingSession.AutomaticVersionInterval, Moments.At(0), HasUnversionedChanges: false);

        enoughTime.IsDueForVersion.ShouldBeFalse();
        (enoughTime with { HasUnversionedChanges = true }).IsDueForVersion.ShouldBeTrue();
        (enoughTime with { HasUnversionedChanges = true, ActiveTime = TimeSpan.FromMinutes(9.9) }).IsDueForVersion.ShouldBeFalse();
    }

    [Fact]
    public void After_a_version_the_clock_restarts_but_remembers_the_last_edit()
    {
        var session = new WritingSession(TimeSpan.FromMinutes(12), Moments.At(12), HasUnversionedChanges: true).AfterVersion();

        session.ShouldBe(new WritingSession(TimeSpan.Zero, Moments.At(12), HasUnversionedChanges: false));
    }
}
