using Rocinante.Application.Ports;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Application.Tests;

public sealed class ProjectUseCasesTests : IDisposable
{
    private readonly AppFixture _app = new();

    public void Dispose() => _app.Dispose();

    [Fact]
    public void Creating_a_project_opens_it_and_tells_every_window()
    {
        var path = _app.PathOf("Rocinante/quijote.rocinante");

        var snapshot = _app.Projects.Create(path, "  El ingenioso hidalgo  ", format: null, "window-1");

        snapshot.Path.ShouldBe(Path.GetFullPath(path));
        snapshot.Project.Title.ShouldBe("El ingenioso hidalgo");
        snapshot.Project.CreatedAt.ShouldBe(_app.Clock.GetUtcNow());
        snapshot.Work.Words.ShouldBe(0);
        File.Exists(path).ShouldBeTrue();
        _app.Notifier.Events.ShouldBe(["recent.changed:window-1", "project.opened:window-1"]);
        _app.Projects.Current().Path.ShouldBe(snapshot.Path);
    }

    [Fact]
    public void Without_an_open_project_there_is_nothing_to_show()
    {
        Should.Throw<ProjectNotOpenException>(() => _app.Projects.Current());
        Should.Throw<ProjectNotOpenException>(() => _app.Projects.Close(AppFixture.Main));
    }

    [Fact]
    public void Opening_another_project_closes_the_current_one()
    {
        var first = _app.CreateProject("primera.rocinante", "Primera");
        _app.CreateProject("segunda.rocinante", "Segunda");

        var reopened = _app.Projects.Open(first.Path, AppFixture.Main);

        reopened.Project.Title.ShouldBe("Primera");
        _app.Notifier.Events.ShouldBe(["recent.changed:main", "project.opened:main"]);
        File.Move(_app.PathOf("segunda.rocinante"), _app.PathOf("movida.rocinante"));
    }

    [Fact]
    public void A_file_that_cannot_be_opened_leaves_the_current_project_open()
    {
        _app.CreateProject();

        Should.Throw<ProjectFileException>(() => _app.Projects.Open(_app.PathOf("no-existe.rocinante"), AppFixture.Main))
            .Error.ShouldBe(ProjectFileError.NotFound);

        _app.Projects.Current().Project.Title.ShouldBe("El ingenioso hidalgo");
        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void Renaming_saves_the_title_and_announces_it()
    {
        var created = _app.CreateProject();

        _app.Projects.Rename("Don Quijote de la Mancha", AppFixture.Main).Project.Title.ShouldBe("Don Quijote de la Mancha");

        _app.Notifier.Events.ShouldBe(["recent.changed:main", "project.changed:main"]);
        _app.Projects.Close(AppFixture.Main);
        _app.Projects.Open(created.Path, AppFixture.Main).Project.Title.ShouldBe("Don Quijote de la Mancha");
    }

    [Fact]
    public void A_refused_title_changes_nothing()
    {
        _app.CreateProject();

        Should.Throw<Domain.DomainException>(() => _app.Projects.Rename("   ", AppFixture.Main));

        _app.Projects.Current().Project.Title.ShouldBe("El ingenioso hidalgo");
        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void Save_as_goes_on_working_on_the_copy()
    {
        var original = _app.CreateProject();
        var copyPath = _app.PathOf("copias/quijote-copia.rocinante");

        var copy = _app.Projects.SaveAs(copyPath, AppFixture.Main);
        _app.Projects.Rename("Solo en la copia", AppFixture.Main);

        copy.Path.ShouldBe(Path.GetFullPath(copyPath));
        _app.Notifier.Events.ShouldBe(["recent.changed:main", "project.opened:main", "recent.changed:main", "project.changed:main"]);
        _app.Projects.Open(original.Path, AppFixture.Main).Project.Title.ShouldBe("El ingenioso hidalgo");
        _app.Projects.Open(copyPath, AppFixture.Main).Project.Title.ShouldBe("Solo en la copia");
    }

    [Fact]
    public void Closing_releases_the_file_and_tells_every_window()
    {
        var created = _app.CreateProject();

        _app.Projects.Close("window-2");

        _app.Notifier.Events.ShouldBe(["project.closed:window-2"]);
        Should.Throw<ProjectNotOpenException>(() => _app.Projects.Current());
        File.Move(created.Path, _app.PathOf("archivada.rocinante"));
    }
}
