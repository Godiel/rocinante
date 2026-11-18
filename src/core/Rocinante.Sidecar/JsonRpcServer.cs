using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Rocinante.Sidecar;

/// <summary>
/// Line-delimited JSON-RPC 2.0 dispatcher. Every request is checked against the
/// <see cref="ProtocolContract"/> before it reaches a handler, gets exactly one
/// response, and state changes are broadcast as notifications so every window
/// stays in sync.
/// </summary>
public sealed class JsonRpcServer
{
    private const int ParseError = -32700;
    private const int InvalidRequest = -32600;
    private const int MethodNotFound = -32601;
    private const int InvalidParams = -32602;
    private const int InternalError = -32603;

    private readonly TextWriter _output;
    private readonly SkeletonDocumentStore _store;
    private readonly ProtocolContract _contract;
    private readonly Dictionary<string, Func<JsonNode?, JsonNode?>> _handlers;

    public JsonRpcServer(TextWriter output, SkeletonDocumentStore store, ProtocolContract contract)
    {
        _output = output;
        _store = store;
        _contract = contract;
        _handlers = new()
        {
            ["system.info"] = _ => GetInfo(),
            ["system.ping"] = _ => JsonValue.Create("pong"),
            ["document.get"] = _ => GetDocument(),
            ["document.save"] = SaveDocument,
        };

        var unhandled = contract.Methods.Except(_handlers.Keys).ToList();
        if (unhandled.Count > 0)
        {
            throw new InvalidOperationException($"No handler for contract methods: {string.Join(", ", unhandled)}");
        }
    }

    /// <summary>Handles one line of input and writes the response (and any notifications).</summary>
    public void Handle(string line)
    {
        JsonObject request;
        try
        {
            request = JsonNode.Parse(line) as JsonObject
                ?? throw new JsonException("Message is not a JSON object.");
        }
        catch (JsonException)
        {
            WriteError(null, ParseError, "Parse error");
            return;
        }

        var id = request["id"]?.DeepClone();
        if (!IsString(request["jsonrpc"], "2.0") || !TryGetString(request["method"], out var method))
        {
            WriteError(id, InvalidRequest, "Invalid request");
            return;
        }

        if (!_contract.Defines(method) || !_handlers.TryGetValue(method, out var handler))
        {
            WriteError(id, MethodNotFound, $"Method not found: {method}");
            return;
        }

        var parameters = request["params"];
        if (_contract.ValidateParams(method, parameters) is { } problem)
        {
            WriteError(id, InvalidParams, $"Invalid params: {problem}");
            return;
        }

        try
        {
            Write(new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = handler(parameters) });
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"error handling {method}: {exception}");
            WriteError(id, InternalError, "Internal error");
        }
    }

    private JsonObject GetInfo() => new()
    {
        ["protocolVersion"] = _contract.ProtocolVersion,
        ["coreVersion"] = typeof(JsonRpcServer).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown",
    };

    private JsonObject GetDocument()
    {
        var (content, revision) = _store.Read();
        return new JsonObject
        {
            ["content"] = content is null ? null : JsonNode.Parse(content),
            ["revision"] = revision,
        };
    }

    // Params are already validated against the contract, so their shape is guaranteed.
    private JsonObject SaveDocument(JsonNode? parameters)
    {
        var content = parameters!["content"]!.AsObject();
        var origin = parameters["origin"]!.GetValue<string>();

        var revision = _store.Save(content.ToJsonString());

        Notify("document.changed", new JsonObject
        {
            ["content"] = content.DeepClone(),
            ["revision"] = revision,
            ["origin"] = origin,
        });

        return new JsonObject { ["revision"] = revision };
    }

    private void Notify(string method, JsonObject parameters) =>
        Write(new JsonObject { ["jsonrpc"] = "2.0", ["method"] = method, ["params"] = parameters });

    private void WriteError(JsonNode? id, int code, string message) => Write(new JsonObject
    {
        ["jsonrpc"] = "2.0",
        ["id"] = id,
        ["error"] = new JsonObject { ["code"] = code, ["message"] = message },
    });

    private void Write(JsonObject message) => _output.WriteLine(message.ToJsonString());

    private static bool IsString(JsonNode? node, string expected) =>
        TryGetString(node, out var value) && value == expected;

    private static bool TryGetString(JsonNode? node, out string value)
    {
        if (node is JsonValue jsonValue && jsonValue.TryGetValue(out string? text))
        {
            value = text;
            return true;
        }

        value = string.Empty;
        return false;
    }
}
