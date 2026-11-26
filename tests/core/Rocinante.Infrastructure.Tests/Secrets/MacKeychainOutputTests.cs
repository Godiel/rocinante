using Rocinante.Infrastructure.Secrets;

namespace Rocinante.Infrastructure.Tests.Secrets;

/// <summary>What the keychain of macOS says about a key, read on any system.</summary>
public sealed class MacKeychainOutputTests
{
    [Fact]
    public void Reads_a_plain_key_between_quotes()
    {
        const string Said = "keychain: \"/Users/x/Library/Keychains/login.keychain-db\"\npassword: \"sk-prueba-2\"\n";
        MacKeychainStore.PasswordFrom(Said).ShouldBe("sk-prueba-2");
    }

    [Fact]
    public void Reads_a_key_that_is_not_plain_ascii_from_its_hexadecimal()
    {
        const string Said = "password: 0x736B2D7072756562612DC3B12D31  \"sk-prueba-\\303\\261-1\"\n";
        MacKeychainStore.PasswordFrom(Said).ShouldBe("sk-prueba-ñ-1");
    }

    [Fact]
    public void Keeps_a_key_made_of_hex_digits_as_it_is()
    {
        MacKeychainStore.PasswordFrom("password: \"0x1234abcd\"\n").ShouldBe("0x1234abcd");
    }

    [Fact]
    public void Says_nothing_when_there_is_no_password_line()
    {
        MacKeychainStore.PasswordFrom("keychain: \"login\"\n").ShouldBeNull();
    }
}
