using System.Text.Json.Nodes;
using Rocinante.Infrastructure.Files;
using Rocinante.Infrastructure.Persistence;
using Rocinante.Infrastructure.Settings;

namespace Rocinante.Sidecar.Tests;

/// <summary>Runs the real core, wired as in production, over a temporary folder.</summary>
internal sealed class ServerHarness : IDisposable
{
    private readonly StringWriter _output = new();
    private readonly Core _core;
    private int _nextId = 1;

    public ServerHarness(string? launchFile = null)
    {
        Folder = Directory.CreateTempSubdirectory("rocinante-sidecar-tests-").FullName;
        var options = new CoreOptions(
            new SqliteProjectFiles(),
            new JsonSettingsStore(PathOf("datos"), Log),
            Clock,
            PathOf("Documentos/Rocinante"),
            launchFile,
            Problems,
            new AmbienceFolder(PathOf("datos")),
            new ChosenFiles());
        _core = new Core(_output, Log, options, Contract);
    }

    public static ProtocolContract Contract { get; } = ProtocolContract.LoadEmbedded();

    public string Folder { get; }

    public ManualClock Clock { get; } = new(new DateTimeOffset(2026, 3, 14, 9, 0, 0, TimeSpan.Zero));

    /// <summary>Problems the interface or the host reported through <c>diagnostics.report</c>.</summary>
    public RecordedProblems Problems { get; } = new();

    /// <summary>What the core wrote to its log.</summary>
    public StringWriter Log { get; } = new();

    /// <summary>Every notification the server has emitted so far.</summary>
    public List<JsonObject> Notifications { get; } = [];

    /// <summary>Every (method, response) pair, to check results against the contract.</summary>
    public List<(string Method, JsonObject Response)> Responses { get; } = [];

    public string PathOf(string name) => Path.Combine(Folder, name);

    /// <summary>Sends a raw line and returns every message the server wrote in reply.</summary>
    public List<JsonObject> SendRaw(string line)
    {
        _output.GetStringBuilder().Clear();
        _core.Handle(line);

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

        var response = SendRaw(request.ToJsonString()).Single(message => message["id"]?.GetValue<int>() == id);
        Responses.Add((method, response));
        return response;
    }

    /// <summary>Sends a request that must succeed and returns its result.</summary>
    public JsonNode? Call(string method, JsonNode? parameters = null)
    {
        var response = Request(method, parameters);
        response["error"].ShouldBeNull($"{method} failed: {response["error"]?.ToJsonString()}");
        return response["result"];
    }

    public void Dispose()
    {
        _core.Dispose();
        Directory.Delete(Folder, recursive: true);
    }
}

/// <summary>Keeps every reported problem, to check what reached the log.</summary>
internal sealed class RecordedProblems : IReportedProblems
{
    public List<(string Source, string Level, string Message, string? Detail)> Reports { get; } = [];

    public void Report(string source, string level, string message, string? detail) =>
        Reports.Add((source, level, message, detail));
}
