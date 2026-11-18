using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Application.Tests;

/// <summary>The use cases wired as in the core, over a temporary folder.</summary>
internal sealed class AppFixture : IDisposable
{
    public const string Main = "main";

    private readonly Workspace _workspace = new();

    public AppFixture()
    {
        Folder = Directory.CreateTempSubdirectory("rocinante-app-tests-").FullName;
        var files = new SqliteProjectFiles();
        Projects = new ProjectUseCases(_workspace, files, Notifier, Clock);
        Documents = new DocumentUseCases(_workspace, Notifier, Clock);
        Versions = new VersionUseCases(_workspace, Notifier, Clock);
        Notes = new NoteUseCases(_workspace, Notifier, Clock);
    }

    public string Folder { get; }

    public ManualClock Clock { get; } = new(new DateTimeOffset(2026, 3, 14, 9, 0, 0, TimeSpan.Zero));

    public RecordingNotifier Notifier { get; } = new();

    public ProjectUseCases Projects { get; }

    public DocumentUseCases Documents { get; }

    public VersionUseCases Versions { get; }

    public NoteUseCases Notes { get; }

    public string PathOf(string name) => System.IO.Path.Combine(Folder, name);

    /// <summary>Creates a project and forgets the announcements it produced.</summary>
    public ProjectSnapshot CreateProject(string name = "obra.rocinante", string title = "El ingenioso hidalgo")
    {
        var snapshot = Projects.Create(PathOf(name), title, Main);
        Notifier.Clear();
        return snapshot;
    }

    public void Dispose()
    {
        _workspace.Dispose();
        Directory.Delete(Folder, recursive: true);
    }
}
