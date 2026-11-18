using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Json.Schema;

namespace Rocinante.Sidecar;

/// <summary>
/// The UI ↔ core protocol, loaded from <c>src/contracts/protocol.json</c> (embedded at build time).
/// It is the single source of truth: incoming params are validated against it, and tests use it
/// to check that every result and notification the core produces conforms.
/// </summary>
public sealed class ProtocolContract
{
    private const string Dialect = "https://json-schema.org/draft/2020-12/schema";

    private readonly Dictionary<string, JsonSchema> _params = [];
    private readonly Dictionary<string, JsonSchema> _results = [];
    private readonly Dictionary<string, JsonSchema> _notifications = [];
    private readonly JsonObject _definitions;

    private ProtocolContract(JsonObject manifest)
    {
        ProtocolVersion = manifest["protocolVersion"]!.GetValue<int>();
        var definitions = manifest["$defs"]!.AsObject();
        _definitions = definitions;
        var options = new BuildOptions { SchemaRegistry = new SchemaRegistry() };

        foreach (var (method, entry) in manifest["methods"]!.AsObject())
        {
            // Methods without params accept only an absent (null) params value.
            var parameters = entry!["params"] ?? new JsonObject { ["type"] = "null" };
            _params[method] = Build(parameters, definitions, options, $"params:{method}");
            _results[method] = Build(entry["result"]!, definitions, options, $"result:{method}");
        }

        foreach (var (notification, entry) in manifest["notifications"]!.AsObject())
        {
            _notifications[notification] =
                Build(entry!["params"]!, definitions, options, $"notification:{notification}");
        }
    }

    /// <summary>Version of the protocol; the UI refuses to talk to a core with a different one.</summary>
    public int ProtocolVersion { get; }

    /// <summary>Names of every method the contract defines.</summary>
    public IReadOnlyCollection<string> Methods => _params.Keys;

    /// <summary>Names of every notification the contract defines.</summary>
    public IReadOnlyCollection<string> Notifications => _notifications.Keys;

    /// <summary>Loads the contract embedded in this assembly.</summary>
    public static ProtocolContract LoadEmbedded()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream("protocol.json")
            ?? throw new InvalidOperationException("The protocol contract is not embedded in the core.");
        return new ProtocolContract(JsonNode.Parse(stream)!.AsObject());
    }

    /// <summary>Whether the contract defines <paramref name="method"/>.</summary>
    public bool Defines(string method) => _params.ContainsKey(method);

    /// <summary>Validates the params of a request. Returns null when valid, or the first problem.</summary>
    public string? ValidateParams(string method, JsonNode? parameters) => Validate(_params[method], parameters);

    /// <summary>Validates a method result. Returns null when valid, or the first problem.</summary>
    public string? ValidateResult(string method, JsonNode? result) => Validate(_results[method], result);

    /// <summary>Validates a notification payload. Returns null when valid, or the first problem.</summary>
    public string? ValidateNotification(string notification, JsonNode? parameters) =>
        Validate(_notifications[notification], parameters);

    /// <summary>Validates a value against one of the shared definitions in <c>$defs</c>.</summary>
    public string? ValidateDefinition(string name, JsonNode? instance)
    {
        var schema = Build(new JsonObject { ["$ref"] = $"#/$defs/{name}" }, _definitions, new BuildOptions { SchemaRegistry = new SchemaRegistry() }, $"definition:{name}");
        return Validate(schema, instance);
    }

    private static JsonSchema Build(JsonNode schema, JsonObject definitions, BuildOptions options, string name)
    {
        var document = schema.DeepClone().AsObject();
        document["$schema"] = Dialect;
        document["$defs"] = definitions.DeepClone();
        return JsonSchema.FromText(document.ToJsonString(), options, new Uri($"urn:rocinante:protocol:{name}"));
    }

    private static string? Validate(JsonSchema schema, JsonNode? instance)
    {
        using var document = JsonDocument.Parse(instance?.ToJsonString() ?? "null");
        var results = schema.Evaluate(document.RootElement, new EvaluationOptions { OutputFormat = OutputFormat.List });
        if (results.IsValid)
        {
            return null;
        }

        // The deepest failing location is the most specific explanation.
        var failure = results.Details?
            .Where(detail => detail.Errors is { Count: > 0 })
            .OrderByDescending(detail => detail.InstanceLocation.ToString().Length)
            .FirstOrDefault();
        if (failure is null)
        {
            return "value does not match the contract";
        }

        var location = failure.InstanceLocation.ToString();
        return $"{(location.Length == 0 ? "/" : location)}: {failure.Errors!.Values.First()}";
    }
}
