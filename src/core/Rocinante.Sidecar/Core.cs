using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;

namespace Rocinante.Sidecar;

/// <summary>What the core needs from the outside world.</summary>
/// <param name="Files">Where projects are created and opened.</param>
/// <param name="Settings">Where the app settings live.</param>
/// <param name="Clock">The time.</param>
/// <param name="DefaultFolder">Where new projects are proposed.</param>
/// <param name="LaunchFile">A project the app was launched with, to open in the first window.</param>
/// <param name="Problems">Where problems seen by the interface and the host are written.</param>
/// <param name="Ambience">Where the copies of the writer's own images and sounds live.</param>
internal sealed record CoreOptions(
    IProjectFiles Files, ISettingsStore Settings, TimeProvider Clock, string DefaultFolder, string? LaunchFile, IReportedProblems Problems, IAmbienceFolder Ambience);

/// <summary>
/// Composition root: wires the use cases to the project files, the clock and the JSON-RPC
/// output. One instance serves every window of the app.
/// </summary>
internal sealed class Core : IDisposable
{
    private readonly Workspace _workspace = new();
    private readonly JsonRpcServer _server;

    public Core(TextWriter output, TextWriter log, CoreOptions options, ProtocolContract contract)
    {
        ArgumentNullException.ThrowIfNull(options);

        var writer = new MessageWriter(output);
        var notifier = new JsonRpcNotifier(writer);
        var settings = new WriterSettings(options.Settings);
        var projects = new ProjectUseCases(_workspace, options.Files, settings, notifier, options.Clock);
        var ambience = new AmbienceUseCases(settings, options.Ambience, notifier);
        ambience.Tidy();
        var services = new CoreServices(
            projects,
            new DocumentUseCases(_workspace, notifier, options.Clock),
            new VersionUseCases(_workspace, notifier, options.Clock),
            new NoteUseCases(_workspace, notifier, options.Clock),
            new SettingsUseCases(_workspace, projects, ambience, settings, notifier, options.DefaultFolder, options.LaunchFile),
            ambience,
            options.Problems);

        _server = new JsonRpcServer(writer, contract, CoreMethods.Create(contract, services), log);
    }

    public void Handle(string line) => _server.Handle(line);

    public void Dispose() => _workspace.Dispose();
}
