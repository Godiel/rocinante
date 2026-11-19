using Rocinante.Domain;
using Rocinante.Domain.Formats;
using Rocinante.Domain.Projects;

namespace Rocinante.Application.Tests;

public sealed class WorkFormatUseCasesTests : IDisposable
{
    private readonly AppFixture _app = new();

    public void Dispose() => _app.Dispose();

    private static WorkFormat Trade => WorkFormat.Create(
        PageSize.Trade, 152.4, 228.6, new PageMargins(19, 22, 22, 16), Typeface.Literata, 10.5, 1.4, true, true, true);

    private static WorkFormat Pocket => WorkFormat.Create(
        PageSize.Pocket, 110, 170, new PageMargins(14, 18, 16, 12), Typeface.CrimsonPro, 10, 1.3, false, false, false);

    [Fact]
    public void Before_any_work_the_default_format_is_suggested()
    {
        _app.App.Start(AppFixture.Main).SuggestedFormat.ShouldBe(WorkFormat.Default);
    }

    [Fact]
    public void A_work_created_with_a_format_keeps_it_and_suggests_it_for_the_next_one()
    {
        var snapshot = _app.Projects.Create(_app.PathOf("novela.rocinante"), "Novela", Trade, AppFixture.Main);

        snapshot.Project.Format.ShouldBe(Trade);
        _app.Store.Stored.LastFormat.ShouldBe(Trade);
        _app.App.Start(AppFixture.Main).SuggestedFormat.ShouldBe(Trade);
    }

    [Fact]
    public void A_work_created_without_a_format_takes_the_suggestion()
    {
        _app.Projects.Create(_app.PathOf("primera.rocinante"), "Primera", Pocket, AppFixture.Main);

        var second = _app.Projects.Create(_app.PathOf("segunda.rocinante"), "Segunda", format: null, AppFixture.Main);

        second.Project.Format.ShouldBe(Pocket);
    }

    [Fact]
    public void Changing_the_format_saves_it_tells_every_window_and_becomes_the_suggestion()
    {
        var created = _app.CreateProject();
        _app.Notifier.Events.Clear();

        var changed = _app.Projects.SetFormat(Pocket, "window-1");

        changed.Project.Format.ShouldBe(Pocket);
        _app.Notifier.Events.ShouldBe(["project.changed:window-1"]);
        _app.Store.Stored.LastFormat.ShouldBe(Pocket);

        _app.Quit();
        _app.Projects.Open(created.Path, AppFixture.Main).Project.Format.ShouldBe(Pocket);
    }

    [Fact]
    public void Without_an_open_project_the_format_cannot_change()
    {
        Should.Throw<ProjectNotOpenException>(() => _app.Projects.SetFormat(Pocket, AppFixture.Main));
        Should.Throw<ProjectNotOpenException>(() => _app.Projects.Manuscript());
    }

    [Fact]
    public void The_manuscript_is_the_chapters_in_reading_order_without_fragments_or_trash()
    {
        _app.CreateProject();
        var second = _app.Documents.Create(DocumentKind.Chapter, "Capítulo segundo", position: null, AppFixture.Main);
        var first = _app.Documents.Create(DocumentKind.Chapter, "Capítulo primero", position: 0, AppFixture.Main);
        var gone = _app.Documents.Create(DocumentKind.Chapter, "Descartado", position: null, AppFixture.Main);
        _app.Documents.Create(DocumentKind.Fragment, "Molinos", position: null, AppFixture.Main);
        _app.Documents.Save(first.Id, TipTap.Paragraphs("En un lugar de la Mancha"), AppFixture.Main);
        _app.Documents.Delete(gone.Id, AppFixture.Main);

        var manuscript = _app.Projects.Manuscript();

        manuscript.Select(chapter => chapter.Id).ShouldBe([first.Id, second.Id]);
        manuscript[0].Title.ShouldBe("Capítulo primero");
        manuscript[0].Content.Json.ShouldContain("En un lugar de la Mancha");
    }
}
