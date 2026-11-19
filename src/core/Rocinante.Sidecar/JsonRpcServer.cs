using System.Text.Json;
using System.Text.Json.Nodes;
using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Sidecar;

/// <summary>
/// Line-delimited JSON-RPC 2.0 dispatcher. Every request is checked against the
/// <see cref="ProtocolContract"/> before it reaches a handler and gets exactly one response.
/// Expected failures (a broken rule, a file that is not a project) come back with a code and a
/// <c>data.reason</c> the UI turns into a message in Spanish; anything else is an internal error.
/// </summary>
internal sealed class JsonRpcServer
{
    private const int ParseError = -32700;
    private const int InvalidRequest = -32600;
    private const int MethodNotFound = -32601;
    private const int InvalidParams = -32602;
    private const int InternalError = -32603;
    private const int ProjectNotOpen = -32001;
    private const int RuleViolated = -32002;
    private const int ProjectFileProblem = -32003;

    private readonly MessageWriter _writer;
    private readonly ProtocolContract _contract;
    private readonly IReadOnlyDictionary<string, Func<JsonNode?, JsonNode?>> _handlers;
    private readonly TextWriter _log;

    public JsonRpcServer(MessageWriter writer, ProtocolContract contract, IReadOnlyDictionary<string, Func<JsonNode?, JsonNode?>> handlers, TextWriter log)
    {
        _writer = writer;
        _contract = contract;
        _handlers = handlers;
        _log = log;

        var unhandled = contract.Methods.Except(handlers.Keys).ToList();
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
            _writer.Error(null, ParseError, "Parse error");
            return;
        }

        var id = request["id"]?.DeepClone();
        if (!IsString(request["jsonrpc"], "2.0") || !TryGetString(request["method"], out var method))
        {
            _writer.Error(id, InvalidRequest, "Invalid request");
            return;
        }

        if (!_contract.Defines(method) || !_handlers.TryGetValue(method, out var handler))
        {
            _writer.Error(id, MethodNotFound, $"Method not found: {method}");
            return;
        }

        var parameters = request["params"];
        if (_contract.ValidateParams(method, parameters) is { } problem)
        {
            _writer.Error(id, InvalidParams, $"Invalid params: {problem}");
            return;
        }

        try
        {
            _writer.Result(id, handler(parameters));
        }
        catch (ProjectNotOpenException exception)
        {
            _writer.Error(id, ProjectNotOpen, exception.Message, "projectNotOpen");
        }
        catch (DomainException exception)
        {
            _writer.Error(id, RuleViolated, exception.Message, Reason(exception.Error.ToString()));
        }
        catch (ProjectFileException exception)
        {
            _writer.Error(id, ProjectFileProblem, exception.Message, Reason(exception.Error.ToString()));
        }
        catch (Exception exception)
        {
            // Exception messages never carry the writer's text: only ids, paths and SQLite codes.
            _log.WriteLine($"error handling {method}: {exception}");
            _writer.Error(id, InternalError, "Internal error");
        }
    }

    /// <summary>The wire name of an error reason: the enum member in camelCase.</summary>
    internal static string Reason(string name) => char.ToLowerInvariant(name[0]) + name[1..];

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
