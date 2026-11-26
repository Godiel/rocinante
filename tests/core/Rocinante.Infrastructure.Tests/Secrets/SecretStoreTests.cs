using Rocinante.Domain;
using Rocinante.Infrastructure.Secrets;

namespace Rocinante.Infrastructure.Tests.Secrets;

/// <summary>
/// The real credential store of the system the tests run on, under a name of its own so nothing of the
/// writer's is touched. Where the store cannot be used (a Linux without secret-tool, a locked keychain on a
/// build machine), the test says so and is skipped.
/// </summary>
public sealed class SecretStoreTests : IDisposable
{
    private readonly string _service = $"Rocinante-pruebas-{Guid.NewGuid():N}";

    public void Dispose()
    {
        try
        {
            SystemSecretStore.ForThisSystem(_service).Delete("openai");
        }
        catch (DomainException)
        {
            // Nothing to clean where the store is not there.
        }
    }

    [Fact]
    public void Keeps_reads_and_forgets_the_key_of_a_provider()
    {
        var store = SystemSecretStore.ForThisSystem(_service);
        try
        {
            store.Write("openai", "sk-prueba-ñ-1");
        }
        catch (DomainException exception) when (exception.Error == DomainError.SecretStoreUnavailable)
        {
            Assert.Skip("The credential store of this system cannot be used here.");
        }

        store.Read("openai").ShouldBe("sk-prueba-ñ-1");
        store.Write("openai", "sk-prueba-2");
        store.Read("openai").ShouldBe("sk-prueba-2");
        store.Read("gemini").ShouldBeNull();

        store.Delete("openai");
        store.Read("openai").ShouldBeNull();
        store.Delete("openai");
    }
}
