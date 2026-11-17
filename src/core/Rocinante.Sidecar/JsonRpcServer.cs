using System.Text.Json;
using System.Text.Json.Nodes;

namespace Rocinante.Sidecar;

/// <summary>
/// Line-delimited JSON-RPC 2.0 dispatcher for the walking skeleton.
/// Each request gets exactly one response; state changes are also broadcast
/// as notifications so every window can stay in sync.
/// </summary>
public sealed class JsonRpcServer(TextWriter output, SkeletonDocumentStore store)
{
    private const int ParseError = -32700;
    private const int InvalidRequest = -32600;
    private const int MethodNotFound = -32601;
    private const int InvalidParams = -32602;
    private const int InternalError = -32603;

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
        if (request["method"]?.GetValue<string>() is not { } method)
        {
            WriteError(id, InvalidRequest, "Invalid request");
            return;
        }

        try
        {
            var result = Dispatch(method, request["params"] as JsonObject);
            if (result is null)
            {
                WriteError(id, MethodNotFound, $"Method not found: {method}");
                return;
            }

            Write(new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = result });
        }
        catch (ArgumentException exception)
        {
            WriteError(id, InvalidParams, exception.Message);
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"error handling {method}: {exception}");
            WriteError(id, InternalError, "Internal error");
        }
    }

    private JsonNode? Dispatch(string method, JsonObject? parameters) => method switch
    {
        "system.ping" => JsonValue.Create("pong"),
        "document.get" => GetDocument(),
        "document.save" => SaveDocument(parameters),
        _ => null,
    };

    private JsonObject GetDocument()
    {
        var (content, revision) = store.Read();
        return new JsonObject
        {
            ["content"] = content is null ? null : JsonNode.Parse(content),
            ["revision"] = revision,
        };
    }

    private JsonObject SaveDocument(JsonObject? parameters)
    {
        ArgumentNullException.ThrowIfNull(parameters, "params");
        var content = parameters["content"] as JsonObject
            ?? throw new ArgumentException("'content' must be a TipTap document object.");
        var origin = parameters["origin"]?.GetValue<string>()
            ?? throw new ArgumentException("'origin' is required.");

        var revision = store.Save(content.ToJsonString());

        Write(new JsonObject
        {
            ["jsonrpc"] = "2.0",
            ["method"] = "document.changed",
            ["params"] = new JsonObject
            {
                ["content"] = content.DeepClone(),
                ["revision"] = revision,
                ["origin"] = origin,
            },
        });

        return new JsonObject { ["revision"] = revision };
    }

    private void WriteError(JsonNode? id, int code, string message) => Write(new JsonObject
    {
        ["jsonrpc"] = "2.0",
        ["id"] = id,
        ["error"] = new JsonObject { ["code"] = code, ["message"] = message },
    });

    private void Write(JsonObject message) => output.WriteLine(message.ToJsonString());
}
