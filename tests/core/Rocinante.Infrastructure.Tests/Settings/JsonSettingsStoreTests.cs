using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Formats;
using Rocinante.Infrastructure.Settings;

namespace Rocinante.Infrastructure.Tests.Settings;

public sealed class JsonSettingsStoreTests : IDisposable
{
    private readonly TempFolder _folder = new();
    private readonly StringWriter _log = new();

    public void Dispose() => _folder.Dispose();

    [Fact]
    public void Without_a_file_the_settings_are_the_defaults()
    {
        Store().Load().ShouldBe(AppSettings.Empty);
    }

    [Fact]
    public void Settings_survive_a_round_trip()
    {
        var place = new Place(DocumentId.New(Moments.Start), 12, 30);
        var settings = new AppSettings(
            new Preferences(Theme.Candlelight, OutlineMode.Floating, CounterVisible: false, TypewriterScrolling: false, Ambience.Default, MentionsVisible: false),
            [
                new RecentProject(_folder.File("Don Quijote.rocinante"), "Don Quijote", Moments.At(5), place),
                new RecentProject(_folder.File("galatea.rocinante"), "La Galatea", Moments.At(1), Place: null),
            ],
            _folder.File("Don Quijote.rocinante"));

        Store().Save(settings);
        var loaded = Store().Load();

        loaded.Preferences.ShouldBe(settings.Preferences);
        loaded.LastProject.ShouldBe(settings.LastProject);
        loaded.Recent.ShouldBe(settings.Recent);
    }

    [Fact]
    public void The_format_to_suggest_survives_a_round_trip()
    {
        var format = WorkFormat.Create(
            PageSize.Digest, 139.7, 215.9, new PageMargins(16, 20, 18, 13), Typeface.SourceSerif4, 10.5, 1.4, true, false, true);

        Store().Save(AppSettings.Empty with { LastFormat = format });

        Store().Load().LastFormat.ShouldBe(format);
        File.ReadAllText(Path.Combine(_folder.Path, JsonSettingsStore.FileName)).ShouldContain("\"typeface\": \"sourceSerif4\"");
    }

    [Theory]
    [InlineData("\"pageSize\": \"a5\"", "\"pageSize\": \"folio\"")]
    [InlineData("\"typeface\": \"ebGaramond\"", "\"typeface\": \"comicSans\"")]
    [InlineData("\"bodySize\": 11", "\"bodySize\": 40")]
    public void A_format_that_is_no_longer_valid_is_dropped_and_the_rest_kept(string written, string broken)
    {
        Store().Save(new AppSettings(Preferences.Default with { Theme = Theme.Candlelight }, [], LastProject: null, WorkFormat.Default));
        var path = Path.Combine(_folder.Path, JsonSettingsStore.FileName);
        var text = File.ReadAllText(path);
        text.ShouldContain(written);
        File.WriteAllText(path, text.Replace(written, broken, StringComparison.Ordinal));

        var loaded = Store().Load();

        loaded.LastFormat.ShouldBeNull();
        loaded.Preferences.Theme.ShouldBe(Theme.Candlelight);
    }

    private static readonly Guid _ownRain = Guid.Parse("0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b");

    private static Ambience Rainy => new(
        AmbienceId.Builtin("rain-window"),
        new Typing(TypingSound.Mechanical, 0.35, muted: false),
        [new Ambient(AmbienceId.Builtin("fire"), 0.8), new Ambient(AmbienceId.OwnFile(_ownRain), 0.25)],
        0.7,
        ambientMuted: true,
        dimOthers: true,
        SessionGoal.Minutes(45));

    private static AppSettings WithRain() =>
        AppSettings.Empty with
        {
            Preferences = Preferences.Default with { Ambience = Rainy },
            Own = [new OwnAmbience(_ownRain, OwnAmbienceKind.Sound, "lluvia en el tejado.ogg", $"{_ownRain:D}.ogg")],
        };

    [Fact]
    public void The_ambience_and_the_own_files_survive_a_round_trip()
    {
        Store().Save(WithRain());

        var loaded = Store().Load();

        loaded.Preferences.Ambience.ShouldBe(Rainy);
        loaded.OwnAmbience.ShouldBe(WithRain().OwnAmbience);
        var text = File.ReadAllText(Path.Combine(_folder.Path, JsonSettingsStore.FileName));
        text.ShouldContain("\"sound\": \"mechanical\"");
        text.ShouldContain("\"kind\": \"minutes\"");
    }

    [Fact]
    public void A_goal_of_nothing_has_no_amount()
    {
        Store().Save(AppSettings.Empty);

        File.ReadAllText(Path.Combine(_folder.Path, JsonSettingsStore.FileName)).ShouldContain("\"amount\": null");
        Store().Load().Preferences.Ambience.Goal.ShouldBe(SessionGoal.None);
    }

    [Theory]
    [InlineData("\"background\": \"builtin:rain-window\"", "\"background\": \"https://example.com/fondo.jpg\"")]
    [InlineData("\"sound\": \"mechanical\"", "\"sound\": \"harp\"")]
    [InlineData("\"volume\": 0.35", "\"volume\": 3.5")]
    [InlineData("\"ambientVolume\": 0.7", "\"ambientVolume\": -1")]
    [InlineData("\"amount\": 45", "\"amount\": 4500")]
    [InlineData("\"kind\": \"minutes\"", "\"kind\": \"pages\"")]
    public void A_broken_ambience_value_falls_back_on_its_own(string written, string broken)
    {
        Store().Save(WithRain());
        var path = Path.Combine(_folder.Path, JsonSettingsStore.FileName);
        var text = File.ReadAllText(path);
        text.ShouldContain(written);
        File.WriteAllText(path, text.Replace(written, broken, StringComparison.Ordinal));

        var loaded = Store().Load().Preferences.Ambience;

        loaded.ShouldNotBe(Rainy);
        loaded.Ambients.Count.ShouldBe(2);
        loaded.DimOthers.ShouldBeTrue();
    }

    [Fact]
    public void A_repeated_ambient_keeps_its_first_appearance()
    {
        Store().Save(WithRain());
        var path = Path.Combine(_folder.Path, JsonSettingsStore.FileName);
        File.WriteAllText(path, File.ReadAllText(path).Replace("\"id\": \"builtin:fire\"", $"\"id\": \"own:{_ownRain:D}\"", StringComparison.Ordinal));

        Store().Load().Preferences.Ambience.Ambients.ShouldHaveSingleItem().Level.ShouldBe(0.8);
    }

    [Fact]
    public void An_ambience_that_uses_an_unlisted_own_file_stops_using_it()
    {
        Store().Save(WithRain() with { Own = [] });

        Store().Load().Preferences.Ambience.Ambients.ShouldHaveSingleItem().Id.ShouldBe(AmbienceId.Builtin("fire"));
    }

    [Fact]
    public void An_own_file_whose_name_leaves_the_folder_is_dropped()
    {
        Store().Save(WithRain() with { Own = [new OwnAmbience(_ownRain, OwnAmbienceKind.Sound, "lluvia.ogg", "../settings.json")] });

        Store().Load().OwnAmbience.ShouldBeEmpty();
    }

    [Fact]
    public void Settings_written_before_the_ambience_existed_get_the_default_one()
    {
        var store = Store();
        File.WriteAllText(store.FilePath, """
            {
              "version": 1,
              "preferences": { "theme": "candlelight", "outline": "docked", "counterVisible": true, "typewriterScrolling": true },
              "recent": []
            }
            """);

        var loaded = store.Load();

        loaded.Preferences.ShouldBe(Preferences.Default with { Theme = Theme.Candlelight });
        loaded.OwnAmbience.ShouldBeEmpty();
    }

    [Fact]
    public void Saving_creates_the_folder_and_leaves_no_temporary_file()
    {
        var store = new JsonSettingsStore(Path.Combine(_folder.Path, "datos", "app"), _log);

        store.Save(AppSettings.Empty);

        File.Exists(store.FilePath).ShouldBeTrue();
        Directory.GetFiles(Path.GetDirectoryName(store.FilePath)!).ShouldBe([store.FilePath]);
    }

    [Theory]
    [InlineData("no es json")]
    [InlineData("""{ "version": 99, "preferences": null, "lastProject": null, "recent": [] }""")]
    [InlineData("""{ "version": 1, "recent": [{ "path": 3 }] }""")]
    public void An_unreadable_file_is_set_aside_and_the_app_starts_with_defaults(string content)
    {
        var store = Store();
        File.WriteAllText(store.FilePath, content);

        store.Load().ShouldBe(AppSettings.Empty);

        File.Exists(store.FilePath).ShouldBeFalse();
        var aside = Directory.GetFiles(_folder.Path, "settings.unreadable-*.json").ShouldHaveSingleItem();
        File.ReadAllText(aside).ShouldBe(content);
        _log.ToString().ShouldContain("could not be read");
    }

    [Fact]
    public void Unknown_or_missing_values_fall_back_to_the_default_one_by_one()
    {
        var store = Store();
        File.WriteAllText(store.FilePath, """
            {
              "version": 1,
              "preferences": { "theme": "neon", "outline": "floating" },
              "recent": [
                { "path": "", "title": "Sin ruta", "lastOpenedAt": "2026-03-14T09:00:00+00:00" },
                { "path": "obra.rocinante", "title": "Obra", "lastOpenedAt": "2026-03-14T09:00:00+00:00",
                  "place": { "documentId": "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b", "anchor": -4, "head": 2 } }
              ]
            }
            """);

        var loaded = store.Load();

        loaded.Preferences.ShouldBe(Preferences.Default with { Outline = OutlineMode.Floating });
        var recent = loaded.Recent.ShouldHaveSingleItem();
        recent.Title.ShouldBe("Obra");
        recent.Place.ShouldBeNull();
        loaded.LastProject.ShouldBeNull();
    }

    private JsonSettingsStore Store() => new(_folder.Path, _log);
}
