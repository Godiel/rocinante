using Rocinante.Application.Ports;
using Rocinante.Application.Squire;
using Rocinante.Domain;

namespace Rocinante.Tests.Shared;

/// <summary>A credential store in memory.</summary>
internal sealed class MemorySecretStore : ISecretStore
{
    private readonly Dictionary<string, string> _keys = [];

    public bool Broken { get; set; }

    public string? Read(string provider) => Check()._keys.GetValueOrDefault(provider);

    public void Write(string provider, string key) => Check()._keys[provider] = key;

    public void Delete(string provider) => Check()._keys.Remove(provider);

    private MemorySecretStore Check() =>
        Broken ? throw new DomainException(DomainError.SecretStoreUnavailable, "The store is broken in this test.") : this;
}

/// <summary>A provider that answers what the test tells it, and remembers what it was asked.</summary>
internal sealed class FakeSquireClient : ISquireClient
{
    public string Answer { get; set; } = """{"elements":[],"relationships":[],"attributes":[]}""";

    /// <summary>If set, the provider fails with this.</summary>
    public DomainError? Failure { get; set; }

    public List<(SquireConnection Connection, string Question)> Asked { get; } = [];

    public IReadOnlyList<string> Models { get; set; } = ["llama3.1"];

    public Task<string> AskAsync(SquireConnection connection, string instructions, string question, CancellationToken cancellation)
    {
        Asked.Add((connection, question));
        return Failure is { } error
            ? Task.FromException<string>(new DomainException(error, "The fake provider fails."))
            : Task.FromResult(Answer);
    }

    public Task<IReadOnlyList<string>> ModelsAsync(SquireProvider provider, string? endpoint, CancellationToken cancellation) =>
        Task.FromResult(provider == SquireProvider.Ollama ? Models : []);
}
