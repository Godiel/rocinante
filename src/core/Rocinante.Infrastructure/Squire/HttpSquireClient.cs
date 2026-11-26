using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Rocinante.Application.Squire;
using Rocinante.Domain;

namespace Rocinante.Infrastructure.Squire;

/// <summary>
/// Talks to the squire's providers over HTTP and JSON, without their SDKs: Anthropic's Messages, the Chat
/// Completions of OpenAI and those like it (xAI, any compatible service), Gemini's generateContent and
/// Ollama's local chat.
/// </summary>
public sealed class HttpSquireClient(HttpClient http) : ISquireClient
{
    public const string OllamaAddress = "http://127.0.0.1:11434";

    public async Task<string> AskAsync(SquireConnection connection, string instructions, string question, CancellationToken cancellation)
    {
        ArgumentNullException.ThrowIfNull(connection);

        using var request = connection.Provider switch
        {
            SquireProvider.Anthropic => Anthropic(connection, instructions, question),
            SquireProvider.Gemini => Gemini(connection, instructions, question),
            SquireProvider.Ollama => Ollama(connection, instructions, question),
            _ => ChatCompletions(connection, instructions, question),
        };
        var answer = await SendAsync(request, cancellation).ConfigureAwait(false);
        var text = connection.Provider switch
        {
            SquireProvider.Anthropic => First(answer["content"])?["text"],
            SquireProvider.Gemini => First(First(answer["candidates"])?["content"]?["parts"])?["text"],
            SquireProvider.Ollama => answer["message"]?["content"],
            _ => First(answer["choices"])?["message"]?["content"],
        };
        return text is JsonValue value && value.TryGetValue(out string? words)
            ? words
            : throw new DomainException(DomainError.SquireUnavailable, "The provider answered without text.");
    }

    public async Task<IReadOnlyList<string>> ModelsAsync(SquireProvider provider, string? endpoint, CancellationToken cancellation)
    {
        if (provider != SquireProvider.Ollama)
        {
            return [];
        }

        using var request = new HttpRequestMessage(HttpMethod.Get, $"{(endpoint ?? OllamaAddress).TrimEnd('/')}/api/tags");
        var answer = await SendAsync(request, cancellation).ConfigureAwait(false);
        return answer["models"] is JsonArray models
            ? [.. models.Select(model => model?["name"]?.GetValue<string>()).OfType<string>().Order(StringComparer.Ordinal)]
            : [];
    }

    /// <summary>The first item of a list in an answer, if there is a list with something in it.</summary>
    private static JsonNode? First(JsonNode? node) => node is JsonArray { Count: > 0 } items ? items[0] : null;

    private static HttpRequestMessage Anthropic(SquireConnection connection, string instructions, string question)
    {
        var request = Post(
            "https://api.anthropic.com/v1/messages",
            new JsonObject
            {
                ["model"] = connection.Model,
                ["max_tokens"] = 2048,
                ["temperature"] = 0,
                ["system"] = instructions,
                ["messages"] = new JsonArray(new JsonObject { ["role"] = "user", ["content"] = question }),
            });
        request.Headers.Add("x-api-key", connection.Key);
        request.Headers.Add("anthropic-version", "2023-06-01");
        return request;
    }

    private static HttpRequestMessage ChatCompletions(SquireConnection connection, string instructions, string question)
    {
        var address = connection.Provider switch
        {
            SquireProvider.OpenAI => "https://api.openai.com/v1",
            SquireProvider.XAI => "https://api.x.ai/v1",
            _ => connection.Endpoint ?? throw new DomainException(DomainError.SquireNotConfigured, "A compatible provider needs its address."),
        };
        var request = Post(
            $"{address.TrimEnd('/')}/chat/completions",
            new JsonObject
            {
                ["model"] = connection.Model,
                ["temperature"] = 0,
                ["messages"] = new JsonArray(
                    new JsonObject { ["role"] = "system", ["content"] = instructions },
                    new JsonObject { ["role"] = "user", ["content"] = question }),
            });
        if (!string.IsNullOrEmpty(connection.Key))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", connection.Key);
        }

        return request;
    }

    private static HttpRequestMessage Gemini(SquireConnection connection, string instructions, string question)
    {
        var request = Post(
            $"https://generativelanguage.googleapis.com/v1beta/models/{Uri.EscapeDataString(connection.Model)}:generateContent",
            new JsonObject
            {
                ["systemInstruction"] = new JsonObject { ["parts"] = new JsonArray(new JsonObject { ["text"] = instructions }) },
                ["contents"] = new JsonArray(new JsonObject
                {
                    ["role"] = "user",
                    ["parts"] = new JsonArray(new JsonObject { ["text"] = question }),
                }),
                ["generationConfig"] = new JsonObject { ["temperature"] = 0, ["responseMimeType"] = "application/json" },
            });
        request.Headers.Add("x-goog-api-key", connection.Key);
        return request;
    }

    private static HttpRequestMessage Ollama(SquireConnection connection, string instructions, string question) =>
        Post(
            $"{(connection.Endpoint ?? OllamaAddress).TrimEnd('/')}/api/chat",
            new JsonObject
            {
                ["model"] = connection.Model,
                ["stream"] = false,
                ["format"] = "json",
                ["options"] = new JsonObject { ["temperature"] = 0 },
                ["messages"] = new JsonArray(
                    new JsonObject { ["role"] = "system", ["content"] = instructions },
                    new JsonObject { ["role"] = "user", ["content"] = question }),
            });

    private static HttpRequestMessage Post(string address, JsonObject body) =>
        new(HttpMethod.Post, address)
        {
            Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"),
        };

    private async Task<JsonNode> SendAsync(HttpRequestMessage request, CancellationToken cancellation)
    {
        HttpResponseMessage response;
        try
        {
            response = await http.SendAsync(request, cancellation).ConfigureAwait(false);
        }
        catch (HttpRequestException exception)
        {
            throw new DomainException(DomainError.SquireUnavailable, $"The provider could not be reached: {exception.HttpRequestError}.");
        }
        catch (TaskCanceledException) when (!cancellation.IsCancellationRequested)
        {
            throw new DomainException(DomainError.SquireUnavailable, "The provider took too long to answer.");
        }

        using (response)
        {
            if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden or HttpStatusCode.BadRequest or HttpStatusCode.NotFound)
            {
                throw new DomainException(DomainError.SquireRefused, $"The provider refused the request ({(int)response.StatusCode}).");
            }

            if (!response.IsSuccessStatusCode)
            {
                throw new DomainException(DomainError.SquireUnavailable, $"The provider answered {(int)response.StatusCode}.");
            }

            var text = await response.Content.ReadAsStringAsync(cancellation).ConfigureAwait(false);
            try
            {
                return JsonNode.Parse(text) ?? throw new DomainException(DomainError.SquireUnavailable, "The provider answered nothing.");
            }
            catch (JsonException)
            {
                throw new DomainException(DomainError.SquireUnavailable, "The provider's answer is not JSON.");
            }
        }
    }
}
