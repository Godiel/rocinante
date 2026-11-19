using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Rocinante.Sidecar;

/// <summary>Writes JSON-RPC messages, one per line. stdout carries protocol messages only.</summary>
internal sealed class MessageWriter(TextWriter output)
{
    public void Result(JsonNode? id, JsonNode? result) =>
        Write(new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = result });

    public void Error(JsonNode? id, int code, string message, string? reason = null)
    {
        var error = new JsonObject { ["code"] = code, ["message"] = message };
        if (reason is not null)
        {
            error["data"] = new JsonObject { ["reason"] = reason };
        }

        Write(new JsonObject { ["jsonrpc"] = "2.0", ["id"] = id, ["error"] = error });
    }

    public void Notification(string method, JsonNode? parameters) =>
        Write(new JsonObject { ["jsonrpc"] = "2.0", ["method"] = method, ["params"] = parameters });

    // The messages travel over a pipe, never into HTML: accented letters and symbols go as they
    // are instead of \uXXXX, which keeps a chapter in Spanish compact and readable in logs.
    private static readonly JsonSerializerOptions _options = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    private void Write(JsonObject message) => output.WriteLine(message.ToJsonString(_options));
}
