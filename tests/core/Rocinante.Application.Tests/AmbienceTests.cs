using Rocinante.Application.Settings;
using Rocinante.Domain;

namespace Rocinante.Application.Tests;

public sealed class AmbienceTests
{
    private static readonly Guid _ownRain = Guid.Parse("0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b");

    private static Ambience With(IReadOnlyList<Ambient> ambients, AmbienceId? background = null) =>
        new(background ?? Ambience.DefaultBackground, Ambience.Default.Typing, ambients, 0.5, ambientMuted: false, dimOthers: false, SessionGoal.None);

    [Theory]
    [InlineData("builtin:parchment")]
    [InlineData("builtin:rain-window")]
    [InlineData("own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b")]
    public void Ids_name_a_built_in_or_an_own_file(string value)
    {
        AmbienceId.TryParse(value, out var id).ShouldBeTrue();
        id.Value.ShouldBe(value);
    }

    [Theory]
    [InlineData("parchment")]
    [InlineData("builtin:")]
    [InlineData("builtin:Lluvia")]
    [InlineData("own:no-es-un-uuid")]
    [InlineData("own:0196A3B2-7C4D-7E8F-9A0B-1C2D3E4F5A6B")]
    [InlineData("web:https://example.com/rain.ogg")]
    public void Anything_else_is_not_an_id(string value)
    {
        AmbienceId.TryParse(value, out _).ShouldBeFalse();
    }

    [Fact]
    public void An_own_id_says_which_file_it_names()
    {
        AmbienceId.OwnFile(_ownRain).Own.ShouldBe(_ownRain);
        AmbienceId.Builtin("rain").Own.ShouldBeNull();
    }

    [Theory]
    [InlineData(-0.01)]
    [InlineData(1.01)]
    [InlineData(double.NaN)]
    public void A_volume_goes_from_silent_to_full(double volume)
    {
        Should.Throw<ArgumentOutOfRangeException>(() => new Typing(TypingSound.Quill, volume, muted: false));
        Should.Throw<ArgumentOutOfRangeException>(() => new Ambient(AmbienceId.Builtin("rain"), volume));
    }

    [Fact]
    public void The_same_ambient_cannot_play_twice()
    {
        var rain = AmbienceId.Builtin("rain");

        Should.Throw<DomainException>(() => With([new Ambient(rain, 0.5), new Ambient(rain, 1)]))
            .Error.ShouldBe(DomainError.AmbientRepeated);
    }

    [Fact]
    public void At_most_six_ambients_play_at_once()
    {
        var seven = Enumerable.Range(1, 7).Select(n => new Ambient(AmbienceId.Builtin($"sound-{n}"), 1)).ToList();

        Should.Throw<ArgumentOutOfRangeException>(() => With(seven));
        With(seven[..6]).Ambients.Count.ShouldBe(6);
    }

    [Theory]
    [InlineData(GoalKind.Words, 50, true)]
    [InlineData(GoalKind.Words, 50_000, true)]
    [InlineData(GoalKind.Words, 49, false)]
    [InlineData(GoalKind.Words, 50_001, false)]
    [InlineData(GoalKind.Minutes, 5, true)]
    [InlineData(GoalKind.Minutes, 600, true)]
    [InlineData(GoalKind.Minutes, 4, false)]
    [InlineData(GoalKind.Minutes, 601, false)]
    public void A_goal_stays_within_reason(GoalKind kind, int amount, bool accepted)
    {
        Func<SessionGoal> goal = () => kind == GoalKind.Words ? SessionGoal.Words(amount) : SessionGoal.Minutes(amount);

        if (accepted)
        {
            goal().Amount.ShouldBe(amount);
        }
        else
        {
            Should.Throw<ArgumentOutOfRangeException>(goal);
        }
    }

    [Fact]
    public void Two_ambiences_with_the_same_mix_are_equal()
    {
        With([new Ambient(AmbienceId.Builtin("rain"), 0.5)]).ShouldBe(With([new Ambient(AmbienceId.Builtin("rain"), 0.5)]));
        With([new Ambient(AmbienceId.Builtin("rain"), 0.5)]).ShouldNotBe(With([new Ambient(AmbienceId.Builtin("rain"), 0.6)]));
    }

    [Fact]
    public void Without_an_own_file_the_background_returns_to_paper_and_the_sound_leaves_the_mix()
    {
        var own = AmbienceId.OwnFile(_ownRain);
        var ambience = With([new Ambient(AmbienceId.Builtin("fire"), 0.5), new Ambient(own, 0.3)], background: own);

        var left = ambience.Without(_ => false);

        ambience.OwnFiles().ShouldBe([_ownRain, _ownRain]);
        left.Background.ShouldBe(Ambience.DefaultBackground);
        left.Ambients.ShouldHaveSingleItem().Id.ShouldBe(AmbienceId.Builtin("fire"));
        ambience.Without(_ => true).ShouldBe(ambience);
    }
}
