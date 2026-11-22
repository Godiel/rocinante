using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;

namespace Rocinante.Application.Tests;

public sealed class AmbienceUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private static readonly byte[] _png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52];
    private static readonly byte[] _ogg = [.. "OggS"u8, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    private readonly AppFixture _app = new();

    public void Dispose() => _app.Dispose();

    private string AmbienceFolder => Path.Combine(_app.PathOf("datos"), "ambience");

    private string Write(string name, byte[] content)
    {
        var path = _app.PathOf(name);
        File.WriteAllBytes(path, content);
        return path;
    }

    /// <summary>The default ambience with an own file as its background or in its mix.</summary>
    private static Ambience Using(Guid own, bool asBackground)
    {
        var defaults = Ambience.Default;
        return new Ambience(
            asBackground ? AmbienceId.OwnFile(own) : defaults.Background,
            defaults.Typing,
            asBackground ? [] : [new Ambient(AmbienceId.OwnFile(own), 0.4)],
            defaults.AmbientVolume,
            defaults.AmbientMuted,
            defaults.DimOthers,
            defaults.Goal);
    }

    [Fact]
    public void An_imported_image_is_a_copy_that_survives_the_original()
    {
        var original = Write("molinos al amanecer.png", _png);

        var own = _app.Ambience.Import(original, OwnAmbienceKind.Image, Main);
        File.Delete(original);

        own.Name.ShouldBe("molinos al amanecer.png");
        own.Kind.ShouldBe(OwnAmbienceKind.Image);
        own.File.ShouldBe(Path.Combine(AmbienceFolder, $"{own.Id:D}.png"));
        File.ReadAllBytes(own.File).ShouldBe(_png);
        _app.Ambience.Own().ShouldHaveSingleItem().ShouldBe(own);
        _app.Notifier.Events.ShouldBe(["ambience.changed:main"]);
        _app.Notifier.LastOwn.ShouldHaveSingleItem().Id.ShouldBe(own.Id);
    }

    [Fact]
    public void The_kind_is_told_by_the_signature_and_not_the_extension()
    {
        var disguised = Write("lluvia.png", _ogg);

        var own = _app.Ambience.Import(disguised, OwnAmbienceKind.Sound, Main);

        Path.GetExtension(own.File).ShouldBe(".ogg");
        Should.Throw<DomainException>(() => _app.Ambience.Import(disguised, OwnAmbienceKind.Image, Main))
            .Error.ShouldBe(DomainError.NotAnImage);
        Should.Throw<DomainException>(() => _app.Ambience.Import(Write("carta.ogg", [.. "Querido Sancho:"u8]), OwnAmbienceKind.Sound, Main))
            .Error.ShouldBe(DomainError.NotASound);
        _app.Ambience.Own().ShouldHaveSingleItem();
    }

    [Theory]
    [InlineData(OwnAmbienceKind.Image, AmbienceUseCases.MaxImageBytes)]
    [InlineData(OwnAmbienceKind.Sound, AmbienceUseCases.MaxSoundBytes)]
    public void A_file_over_the_limit_is_refused_and_nothing_is_copied(OwnAmbienceKind kind, long limit)
    {
        var path = Write("enorme", kind == OwnAmbienceKind.Image ? _png : _ogg);
        using (var stream = File.OpenWrite(path))
        {
            stream.SetLength(limit + 1);
        }

        Should.Throw<DomainException>(() => _app.Ambience.Import(path, kind, Main)).Error.ShouldBe(DomainError.FileTooLarge);
        Directory.Exists(AmbienceFolder).ShouldBeFalse();
        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void A_file_that_is_not_there_is_reported_as_not_found()
    {
        Should.Throw<ProjectFileException>(() => _app.Ambience.Import(_app.PathOf("no-existe.ogg"), OwnAmbienceKind.Sound, Main))
            .Error.ShouldBe(ProjectFileError.NotFound);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Removing_an_own_file_in_use_takes_it_out_of_the_ambience(bool asBackground)
    {
        var own = _app.Ambience.Import(Write("propio", asBackground ? _png : _ogg), asBackground ? OwnAmbienceKind.Image : OwnAmbienceKind.Sound, Main);
        _app.App.UpdatePreferences(new PreferencesChange(Ambience: Using(own.Id, asBackground)), Main);
        _app.Notifier.Clear();

        var left = _app.Ambience.Remove(own.Id, "window-1");

        left.ShouldBeEmpty();
        File.Exists(own.File).ShouldBeFalse();
        _app.Settings.Preferences.Ambience.ShouldBe(Ambience.Default);
        _app.Notifier.Events.ShouldBe(["preferences.changed:window-1", "ambience.changed:window-1"]);
    }

    [Fact]
    public void Removing_an_own_file_nobody_uses_leaves_the_preferences_alone()
    {
        var own = _app.Ambience.Import(Write("propio.ogg", _ogg), OwnAmbienceKind.Sound, Main);
        _app.Notifier.Clear();

        _app.Ambience.Remove(own.Id, Main);

        _app.Notifier.Events.ShouldBe(["ambience.changed:main"]);
        Should.Throw<DomainException>(() => _app.Ambience.Remove(own.Id, Main)).Error.ShouldBe(DomainError.AmbienceNotFound);
    }

    [Fact]
    public void An_ambience_cannot_use_an_own_file_that_is_not_there()
    {
        Should.Throw<DomainException>(() => _app.App.UpdatePreferences(new PreferencesChange(Ambience: Using(Guid.CreateVersion7(), asBackground: true)), Main))
            .Error.ShouldBe(DomainError.AmbienceNotFound);
        _app.Settings.Preferences.ShouldBe(Preferences.Default);
    }

    [Fact]
    public void On_start_copies_that_are_gone_are_forgotten_and_stray_files_deleted()
    {
        var kept = _app.Ambience.Import(Write("molinos.png", _png), OwnAmbienceKind.Image, Main);
        var lost = _app.Ambience.Import(Write("lluvia.ogg", _ogg), OwnAmbienceKind.Sound, Main);
        _app.App.UpdatePreferences(new PreferencesChange(Ambience: Using(lost.Id, asBackground: false)), Main);
        File.Delete(lost.File);
        var stray = Path.Combine(AmbienceFolder, "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b.png.tmp");
        File.WriteAllBytes(stray, _png);
        _app.Notifier.Clear();

        _app.Ambience.Tidy();

        _app.Ambience.Own().ShouldHaveSingleItem().Id.ShouldBe(kept.Id);
        _app.Settings.Preferences.Ambience.Ambients.ShouldBeEmpty();
        File.Exists(stray).ShouldBeFalse();
        File.Exists(kept.File).ShouldBeTrue();
        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void The_start_state_lists_the_own_files()
    {
        var own = _app.Ambience.Import(Write("molinos.png", _png), OwnAmbienceKind.Image, Main);

        _app.App.Start(Main).OwnAmbience.ShouldHaveSingleItem().ShouldBe(own);
    }
}
