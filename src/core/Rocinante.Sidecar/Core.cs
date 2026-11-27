using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Application.Squire;
using Rocinante.Infrastructure.Export;
using Rocinante.Infrastructure.Secrets;
using Rocinante.Infrastructure.Squire;

namespace Rocinante.Sidecar;

/// <summary>What the core needs from the outside world.</summary>
/// <param name="Files">Where projects are created and opened.</param>
/// <param name="Settings">Where the app settings live.</param>
/// <param name="Clock">The time.</param>
/// <param name="DefaultFolder">Where new projects are proposed.</param>
/// <param name="LaunchFile">A project the app was launched with, to open in the first window.</param>
/// <param name="Problems">Where problems seen by the interface and the host are written.</param>
/// <param name="Ambience">Where the copies of the writer's own images and sounds live.</param>
/// <param name="ChosenFiles">Reads the files the writer chooses, such as the image of an element.</param>
/// <param name="Secrets">Where the API keys of the squire are kept; the system's credential store if null.</param>
/// <param name="SquireClient">How the squire talks to its providers; over HTTP if null.</param>
/// <param name="ExportFiles">Where exported books are written; the disk by default.</param>
internal sealed record CoreOptions(
    IProjectFiles Files,
    ISettingsStore Settings,
    TimeProvider Clock,
    string DefaultFolder,
    string? LaunchFile,
    IReportedProblems Problems,
    IAmbienceFolder Ambience,
    IChosenFiles ChosenFiles,
    ISecretStore? Secrets = null,
    ISquireClient? SquireClient = null,
    IExportFiles? ExportFiles = null);

/// <summary>
/// Composition root: wires the use cases to the project files, the clock and the JSON-RPC
/// output. One instance serves every window of the app.
/// </summary>
internal sealed class Core : IDisposable, IWorkGate
{
    private readonly Workspace _workspace = new();
    private readonly JsonRpcServer _server;
    private readonly object _gate = new();
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromMinutes(2) };
    private readonly SquireUseCases _squire;
    private readonly ExportUseCases _export;

    public Core(TextWriter output, TextWriter log, CoreOptions options, ProtocolContract contract)
    {
        ArgumentNullException.ThrowIfNull(options);

        var writer = new MessageWriter(output, _gate);
        var notifier = new JsonRpcNotifier(writer);
        var settings = new WriterSettings(options.Settings);
        var projects = new ProjectUseCases(_workspace, options.Files, settings, notifier, options.Clock);
        var ambience = new AmbienceUseCases(settings, options.Ambience, notifier);
        ambience.Tidy();
        var elements = new ElementUseCases(_workspace, options.ChosenFiles, notifier, options.Clock);
        var threads = new ThreadUseCases(_workspace, elements, notifier, options.Clock);
        var services = new CoreServices(
            projects,
            new DocumentUseCases(_workspace, notifier, options.Clock),
            new VersionUseCases(_workspace, notifier, options.Clock),
            new NoteUseCases(_workspace, notifier, options.Clock),
            new SettingsUseCases(_workspace, projects, ambience, settings, notifier, options.DefaultFolder, options.LaunchFile),
            ambience,
            elements,
            options.Problems,
            _squire = new SquireUseCases(
                _workspace,
                settings,
                options.Secrets ?? SystemSecretStore.ForThisSystem(),
                options.SquireClient ?? new HttpSquireClient(_http),
                elements,
                threads,
                notifier,
                options.Clock,
                this),
            threads,
            _export = new ExportUseCases(
                _workspace,
                [new PdfWriter(), new EpubWriter(), new DocxWriter(), new MarkdownWriter()],
                options.ExportFiles ?? new ExportFiles(),
                notifier,
                options.Clock));

        _server = new JsonRpcServer(writer, contract, CoreMethods.Create(contract, services), log);
    }

    /// <summary>Waits until the squire has read every paragraph it was given; for the tests.</summary>
    internal Task WhenSquireIdle() => _squire.WhenIdle();

    /// <summary>Waits until every export started has ended; for the tests.</summary>
    internal Task WhenExportIdle() => _export.WhenIdle();

    /// <summary>One request at a time, and never at once with what the squire stores.</summary>
    public void Handle(string line)
    {
        lock (_gate)
        {
            _server.Handle(line);
        }
    }

    public T Run<T>(Func<T> work)
    {
        ArgumentNullException.ThrowIfNull(work);
        lock (_gate)
        {
            return work();
        }
    }

    public void Dispose()
    {
        _http.Dispose();
        lock (_gate)
        {
            _workspace.Dispose();
        }
    }
}
