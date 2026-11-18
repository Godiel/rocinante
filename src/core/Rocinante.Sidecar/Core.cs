using Rocinante.Application;
using Rocinante.Application.Ports;

namespace Rocinante.Sidecar;

/// <summary>
/// Composition root: wires the use cases to the project files, the clock and the JSON-RPC
/// output. One instance serves every window of the app.
/// </summary>
internal sealed class Core : IDisposable
{
    private readonly Workspace _workspace = new();
    private readonly JsonRpcServer _server;

    public Core(TextWriter output, TextWriter log, IProjectFiles files, TimeProvider clock, ProtocolContract contract)
    {
        var writer = new MessageWriter(output);
        var notifier = new JsonRpcNotifier(writer);
        var services = new CoreServices(
            new ProjectUseCases(_workspace, files, notifier, clock),
            new DocumentUseCases(_workspace, notifier, clock),
            new VersionUseCases(_workspace, notifier, clock),
            new NoteUseCases(_workspace, notifier, clock));

        _server = new JsonRpcServer(writer, contract, CoreMethods.Create(contract, services), log);
    }

    public void Handle(string line) => _server.Handle(line);

    public void Dispose() => _workspace.Dispose();
}
