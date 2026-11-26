using System.Net;
using System.Text;
using System.Text.Json.Nodes;
using Rocinante.Application.Squire;
using Rocinante.Domain;
using Rocinante.Infrastructure.Squire;

namespace Rocinante.Infrastructure.Tests.Squire;

public sealed class HttpSquireClientTests
{
    private sealed class FakeProvider(HttpStatusCode status, string answer) : HttpMessageHandler
    {
        public HttpRequestMessage? Request { get; private set; }

        public JsonNode? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Request = request;
            if (request.Content is not null)
            {
                Body = JsonNode.Parse(await request.Content.ReadAsStringAsync(cancellationToken));
            }

            return new HttpResponseMessage(status) { Content = new StringContent(answer, Encoding.UTF8, "application/json") };
        }
    }

    private static async Task<(string Answer, FakeProvider Provider)> Ask(SquireConnection connection, string answer, HttpStatusCode status = HttpStatusCode.OK)
    {
        var provider = new FakeProvider(status, answer);
        using var http = new HttpClient(provider);
        var text = await new HttpSquireClient(http).AskAsync(connection, "instrucciones", "pregunta", CancellationToken.None);
        return (text, provider);
    }

    [Fact]
    public async Task Talks_to_Anthropic_with_its_key_and_version()
    {
        var (answer, provider) = await Ask(
            new SquireConnection(SquireProvider.Anthropic, "claude-sonnet-5-5", null, "sk-ant"),
            """{ "content": [{ "type": "text", "text": "{}" }] }""");

        answer.ShouldBe("{}");
        provider.Request!.RequestUri!.ToString().ShouldBe("https://api.anthropic.com/v1/messages");
        provider.Request.Headers.GetValues("x-api-key").ShouldBe(["sk-ant"]);
        provider.Request.Headers.GetValues("anthropic-version").ShouldBe(["2023-06-01"]);
        provider.Body!["system"]!.GetValue<string>().ShouldBe("instrucciones");
        provider.Body["messages"]![0]!["content"]!.GetValue<string>().ShouldBe("pregunta");
    }

    [Theory]
    [InlineData(SquireProvider.OpenAI, null, "https://api.openai.com/v1/chat/completions")]
    [InlineData(SquireProvider.XAI, null, "https://api.x.ai/v1/chat/completions")]
    [InlineData(SquireProvider.Compatible, "http://localhost:8080/v1/", "http://localhost:8080/v1/chat/completions")]
    public async Task Talks_to_OpenAI_and_those_like_it(SquireProvider kind, string? endpoint, string address)
    {
        var (answer, provider) = await Ask(
            new SquireConnection(kind, "modelo", endpoint, "sk-1"),
            """{ "choices": [{ "message": { "role": "assistant", "content": "{\"elements\":[]}" } }] }""");

        answer.ShouldBe("""{"elements":[]}""");
        provider.Request!.RequestUri!.ToString().ShouldBe(address);
        provider.Request.Headers.Authorization!.ToString().ShouldBe("Bearer sk-1");
        provider.Body!["messages"]![0]!["role"]!.GetValue<string>().ShouldBe("system");
    }

    [Fact]
    public async Task Talks_to_Gemini_asking_for_json()
    {
        var (answer, provider) = await Ask(
            new SquireConnection(SquireProvider.Gemini, "gemini-2.5-flash", null, "g-key"),
            """{ "candidates": [{ "content": { "parts": [{ "text": "{}" }] } }] }""");

        answer.ShouldBe("{}");
        provider.Request!.RequestUri!.ToString()
            .ShouldBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
        provider.Request.Headers.GetValues("x-goog-api-key").ShouldBe(["g-key"]);
        provider.Body!["generationConfig"]!["responseMimeType"]!.GetValue<string>().ShouldBe("application/json");
    }

    [Fact]
    public async Task Talks_to_Ollama_on_this_computer_without_a_key()
    {
        var (answer, provider) = await Ask(
            new SquireConnection(SquireProvider.Ollama, "llama3.1", null, null),
            """{ "message": { "role": "assistant", "content": "{}" } }""");

        answer.ShouldBe("{}");
        provider.Request!.RequestUri!.ToString().ShouldBe("http://127.0.0.1:11434/api/chat");
        provider.Request.Headers.Authorization.ShouldBeNull();
        provider.Body!["format"]!.GetValue<string>().ShouldBe("json");
    }

    [Fact]
    public async Task Lists_the_models_of_Ollama_and_none_in_the_cloud()
    {
        var provider = new FakeProvider(HttpStatusCode.OK, """{ "models": [{ "name": "mistral" }, { "name": "llama3.1" }] }""");
        using var http = new HttpClient(provider);
        var client = new HttpSquireClient(http);

        (await client.ModelsAsync(SquireProvider.Ollama, "http://192.168.1.5:11434", CancellationToken.None)).ShouldBe(["llama3.1", "mistral"]);
        provider.Request!.RequestUri!.ToString().ShouldBe("http://192.168.1.5:11434/api/tags");
        (await client.ModelsAsync(SquireProvider.OpenAI, null, CancellationToken.None)).ShouldBeEmpty();
    }

    [Theory]
    [InlineData(HttpStatusCode.Unauthorized, DomainError.SquireRefused)]
    [InlineData(HttpStatusCode.NotFound, DomainError.SquireRefused)]
    [InlineData(HttpStatusCode.TooManyRequests, DomainError.SquireUnavailable)]
    [InlineData(HttpStatusCode.InternalServerError, DomainError.SquireUnavailable)]
    public async Task Says_why_a_provider_failed(HttpStatusCode status, DomainError error)
    {
        var failure = await Should.ThrowAsync<DomainException>(() =>
            Ask(new SquireConnection(SquireProvider.OpenAI, "m", null, "k"), "{}", status));

        failure.Error.ShouldBe(error);
    }

    [Fact]
    public async Task An_answer_without_text_is_a_failure()
    {
        (await Should.ThrowAsync<DomainException>(() =>
            Ask(new SquireConnection(SquireProvider.OpenAI, "m", null, "k"), """{ "choices": [] }""")))
            .Error.ShouldBe(DomainError.SquireUnavailable);
    }
}
