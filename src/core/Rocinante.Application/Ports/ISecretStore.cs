namespace Rocinante.Application.Ports;

/// <summary>
/// The system's credential store, for the API keys of the squire's providers: the Credential Manager of
/// Windows, the keychain of macOS or the Secret Service of Linux. A key never goes to the work, to
/// settings.json or to the log. Each method throws <c>SecretStoreUnavailable</c> when the store cannot be used.
/// </summary>
public interface ISecretStore
{
    /// <summary>The key kept for a provider, or null if there is none.</summary>
    string? Read(string provider);

    void Write(string provider, string key);

    /// <summary>Forgets the key of a provider; forgetting one that is not there changes nothing.</summary>
    void Delete(string provider);
}
