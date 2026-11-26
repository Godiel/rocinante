using Rocinante.Application.Settings;
using Rocinante.Application.Squire;
using Rocinante.Infrastructure.Files;
using Rocinante.Infrastructure.Persistence;
using Rocinante.Infrastructure.Settings;

namespace Rocinante.Application.Tests;

/// <summary>The use cases wired as in the core, over a temporary folder.</summary>
internal sealed class AppFixture : IDisposable
{
    public const string Main = "main";

    private readonly Workspace _workspace = new();

    public AppFixture(string? launchFile = null, AppSettings? settings = null)
    {
        Folder = Directory.CreateTempSubdirectory("rocinante-app-tests-").FullName;
        Store = new MemorySettingsStore(settings);
        Settings = new WriterSettings(Store);
        var files = new SqliteProjectFiles();
        Projects = new ProjectUseCases(_workspace, files, Settings, Notifier, Clock);
        Documents = new DocumentUseCases(_workspace, Notifier, Clock);
        Versions = new VersionUseCases(_workspace, Notifier, Clock);
        Notes = new NoteUseCases(_workspace, Notifier, Clock);
        Ambience = new AmbienceUseCases(Settings, new AmbienceFolder(PathOf("datos")), Notifier);
        Elements = new ElementUseCases(_workspace, new ChosenFiles(), Notifier, Clock);
        Squire = new SquireUseCases(_workspace, Settings, Secrets, SquireClient, Elements, Notifier, Clock, new ImmediateGate());
        App = new SettingsUseCases(_workspace, Projects, Ambience, Settings, Notifier, DefaultFolder, launchFile);
    }

    public string Folder { get; }

    public string DefaultFolder => System.IO.Path.Combine(Folder, "Documentos", "Rocinante");

    public ManualClock Clock { get; } = new(new DateTimeOffset(2026, 3, 14, 9, 0, 0, TimeSpan.Zero));

    public RecordingNotifier Notifier { get; } = new();

    public MemorySettingsStore Store { get; }

    public WriterSettings Settings { get; }

    public ProjectUseCases Projects { get; }

    public DocumentUseCases Documents { get; }

    public VersionUseCases Versions { get; }

    public NoteUseCases Notes { get; }

    public AmbienceUseCases Ambience { get; }

    public ElementUseCases Elements { get; }

    public SettingsUseCases App { get; }

    public MemorySecretStore Secrets { get; } = new();

    public FakeSquireClient SquireClient { get; } = new();

    public SquireUseCases Squire { get; }

    public string PathOf(string name) => System.IO.Path.Combine(Folder, name);

    /// <summary>Creates a project and forgets the announcements it produced.</summary>
    public ProjectSnapshot CreateProject(string name = "obra.rocinante", string title = "El ingenioso hidalgo")
    {
        var snapshot = Projects.Create(PathOf(name), title, format: null, Main);
        Notifier.Clear();
        return snapshot;
    }

    /// <summary>Closes the workspace as quitting the app does: without forgetting the last project.</summary>
    public void Quit() => _workspace.Close();

    public void Dispose()
    {
        _workspace.Dispose();
        Directory.Delete(Folder, recursive: true);
    }
}
