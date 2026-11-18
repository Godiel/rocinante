using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Projects;

namespace Rocinante.Application.Tests;

public sealed class SettingsUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private readonly List<AppFixture> _runs = [];
    private AppFixture _app = new();

    public void Dispose()
    {
        _app.Dispose();
        Enumerable.Reverse(_runs).ToList().ForEach(run => run.Dispose());
    }

    [Fact]
    public void The_first_start_shows_the_welcome_screen_with_default_preferences()
    {
        var start = _app.App.Start(Main);

        start.Project.ShouldBeNull();
        start.Place.ShouldBeNull();
        start.Problem.ShouldBeNull();
        start.Recent.ShouldBeEmpty();
        start.Preferences.ShouldBe(Preferences.Default);
        start.DefaultFolder.ShouldBe(_app.DefaultFolder);
    }

    [Fact]
    public void Quitting_with_a_project_open_reopens_it_where_the_writer_left_off()
    {
        var created = _app.CreateProject();
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        _app.App.SavePlace(new Place(chapter.Id, 12, 20));
        _app.Quit();

        var start = Restart().App.Start(Main);

        start.Project.ShouldNotBeNull().Path.ShouldBe(created.Path);
        start.Place.ShouldBe(new Place(chapter.Id, 12, 20));
        start.Problem.ShouldBeNull();
    }

    [Fact]
    public void Closing_the_project_means_the_next_start_shows_the_welcome_screen()
    {
        _app.CreateProject();
        _app.Projects.Close(Main);

        var start = Restart().App.Start(Main);

        start.Project.ShouldBeNull();
        start.Recent.ShouldHaveSingleItem().Exists.ShouldBeTrue();
    }

    [Fact]
    public void A_project_that_is_gone_is_reported_once_and_then_forgotten()
    {
        var created = _app.CreateProject();
        _app.Quit();
        File.Delete(created.Path);

        var start = Restart().App.Start(Main);

        start.Project.ShouldBeNull();
        start.Problem.ShouldBe(new StartProblem(created.Path, ProjectFileError.NotFound));
        start.Recent.ShouldHaveSingleItem().Exists.ShouldBeFalse();
        _app.Settings.LastProject.ShouldBeNull();
        Restart().App.Start(Main).Problem.ShouldBeNull();
    }

    [Fact]
    public void The_file_the_app_was_launched_with_wins_over_the_last_project()
    {
        var first = _app.CreateProject("primera.rocinante", "Primera");
        var second = _app.CreateProject("segunda.rocinante", "Segunda");
        _app.Quit();

        var start = Restart(launchFile: first.Path).App.Start(Main);

        start.Project.ShouldNotBeNull().Project.Title.ShouldBe("Primera");
        _app.Settings.LastProject.ShouldBe(first.Path);
        second.Path.ShouldNotBe(first.Path);
    }

    [Fact]
    public void A_launch_file_that_cannot_be_opened_does_not_forget_the_last_project()
    {
        var created = _app.CreateProject();
        _app.Quit();
        var letter = _app.PathOf("carta.rocinante");
        File.WriteAllText(letter, "Querido Sancho:");

        var start = Restart(launchFile: letter).App.Start(Main);

        start.Problem.ShouldBe(new StartProblem(letter, ProjectFileError.NotAProject));
        _app.Settings.LastProject.ShouldBe(created.Path);
    }

    [Fact]
    public void Later_windows_get_the_project_already_open_and_the_launch_file_is_used_once()
    {
        var created = _app.CreateProject();
        _app.Quit();
        var restarted = Restart(launchFile: created.Path);
        restarted.App.Start(Main);
        restarted.Notifier.Clear();

        var second = restarted.App.Start("window-1");

        second.Project.ShouldNotBeNull().Path.ShouldBe(created.Path);
        restarted.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void Preferences_change_one_at_a_time_and_are_announced()
    {
        _app.App.UpdatePreferences(new PreferencesChange(Theme: Theme.Candlelight), Main);
        var preferences = _app.App.UpdatePreferences(new PreferencesChange(CounterVisible: false), "window-1");

        preferences.ShouldBe(Preferences.Default with { Theme = Theme.Candlelight, CounterVisible = false });
        _app.Store.Stored.Preferences.ShouldBe(preferences);
        _app.Notifier.Events.ShouldBe(["preferences.changed:main", "preferences.changed:window-1"]);
    }

    [Fact]
    public void Opening_projects_keeps_the_most_recent_first_without_duplicates()
    {
        var first = _app.CreateProject("primera.rocinante", "Primera");
        _app.CreateProject("segunda.rocinante", "Segunda");
        _app.Clock.AdvanceMinutes(5);
        _app.Projects.Open(first.Path, Main);

        var recent = _app.App.Recent();

        recent.Select(entry => entry.Title).ShouldBe(["Primera", "Segunda"]);
        recent[0].LastOpenedAt.ShouldBe(_app.Clock.GetUtcNow());
    }

    [Fact]
    public void Renaming_the_project_renames_it_in_the_recent_list()
    {
        _app.CreateProject();

        _app.Projects.Rename("Don Quijote", Main);

        _app.App.Recent().ShouldHaveSingleItem().Title.ShouldBe("Don Quijote");
    }

    [Fact]
    public void Removing_a_recent_project_never_touches_the_file()
    {
        var created = _app.CreateProject();
        _app.Projects.Close(Main);
        _app.Notifier.Clear();

        _app.App.RemoveRecent(created.Path, Main).ShouldBeEmpty();

        File.Exists(created.Path).ShouldBeTrue();
        _app.Notifier.Events.ShouldBe(["recent.changed:main"]);
    }

    [Fact]
    public void Only_the_last_ten_projects_are_remembered()
    {
        for (var index = 0; index < WriterSettings.MaxRecent + 2; index++)
        {
            _app.CreateProject($"obra-{index}.rocinante", $"Obra {index}");
        }

        var recent = _app.App.Recent();

        recent.Count.ShouldBe(WriterSettings.MaxRecent);
        recent[0].Title.ShouldBe("Obra 11");
        recent[^1].Title.ShouldBe("Obra 2");
    }

    [Fact]
    public void The_place_is_saved_only_when_it_changes()
    {
        _app.CreateProject();
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        _app.App.SavePlace(new Place(chapter.Id, 5, 5));
        var saves = _app.Store.Saves;

        _app.App.SavePlace(new Place(chapter.Id, 5, 5));

        _app.Store.Saves.ShouldBe(saves);
        _app.App.CurrentPlace().ShouldBe(new Place(chapter.Id, 5, 5));
    }

    [Fact]
    public void A_place_in_a_document_sent_to_the_trash_is_not_offered()
    {
        _app.CreateProject();
        var chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main);
        _app.App.SavePlace(new Place(chapter.Id, 1, 1));

        _app.Documents.Delete(chapter.Id, Main);

        _app.App.CurrentPlace().ShouldBeNull();
        Should.Throw<DomainException>(() => _app.App.SavePlace(new Place(chapter.Id, 1, 1))).Error.ShouldBe(DomainError.DocumentIsDeleted);
    }

    [Fact]
    public void Places_need_an_open_project()
    {
        Should.Throw<ProjectNotOpenException>(() => _app.App.CurrentPlace());
    }

    /// <summary>Starts the app again with the settings the previous run left; its files stay until the test ends.</summary>
    private AppFixture Restart(string? launchFile = null)
    {
        _app.Quit();
        _runs.Add(_app);
        _app = new AppFixture(launchFile, _app.Store.Stored);
        return _app;
    }
}
