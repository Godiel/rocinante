using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;

namespace Rocinante.Sidecar.Tests;

/// <summary>Runs a real <see cref="JsonRpcServer"/> over a temporary project file.</summary>
internal sealed class ServerHarness : IDisposable
{
    private readonly string _directory;
    private readonly SkeletonDocumentStore _store;
    private readonly StringWriter _output = new();
    private readonly JsonRpcServer _server;
    private int _nextId = 1;

    public ServerHarness()
    {
        _directory = Path.Combine(Path.GetTempPath(), "rocinante-tests", Guid.NewGuid().ToString("N"));
        ProjectPath = Path.Combine(_directory, "test.rocinante");
        _store = SkeletonDocumentStore.Open(ProjectPath);
        _server = new JsonRpcServer(_output, _store, Contract);
    }

    public static ProtocolContract Contract { get; } = ProtocolContract.LoadEmbedded();

    public string ProjectPath { get; }

    /// <summary>Every notification the server has emitted so far.</summary>
    public List<JsonObject> Notifications { get; } = [];

    /// <summary>Sends a raw line and returns every message the server wrote in reply.</summary>
    public List<JsonObject> SendRaw(string line)
    {
        _output.GetStringBuilder().Clear();
        _server.Handle(line);

        var messages = _output.ToString()
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(text => JsonNode.Parse(text)!.AsObject())
            .ToList();
        Notifications.AddRange(messages.Where(message => message["id"] is null && message["method"] is not null));
        return messages;
    }

    /// <summary>Sends a request and returns its response (notifications are recorded apart).</summary>
    public JsonObject Request(string method, JsonNode? parameters = null)
    {
        var id = _nextId++;
        var request = new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id, ["method"] = method };
        if (parameters is not null)
        {
            request["params"] = parameters.DeepClone();
        }

        return SendRaw(request.ToJsonString()).Single(message => message["id"]?.GetValue<int>() == id);
    }

    public void Dispose()
    {
        _store.Dispose();
        SqliteConnection.ClearAllPools();
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, recursive: true);
        }
    }
}
