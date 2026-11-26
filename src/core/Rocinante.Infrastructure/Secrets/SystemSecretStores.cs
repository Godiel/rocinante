using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;
using Rocinante.Application.Ports;
using Rocinante.Domain;

namespace Rocinante.Infrastructure.Secrets;

/// <summary>The credential store of the system the core runs on.</summary>
public static class SystemSecretStore
{
    /// <param name="service">The name the keys are kept under; tests use their own.</param>
    public static ISecretStore ForThisSystem(string service = "Rocinante") =>
        OperatingSystem.IsWindows() ? new WindowsCredentialStore(service)
        : OperatingSystem.IsMacOS() ? new MacKeychainStore(service)
        : new LinuxSecretToolStore(service);

    internal static DomainException Unavailable(string why) =>
        new(DomainError.SecretStoreUnavailable, $"The system's credential store could not be used: {why}");
}

/// <summary>The Credential Manager of Windows, through advapi32: generic credentials named «Rocinante/provider».</summary>
[SupportedOSPlatform("windows")]
public sealed class WindowsCredentialStore(string service) : ISecretStore
{
    private const int Generic = 1;
    private const int PersistLocalMachine = 2;
    private const int NotFound = 1168;

    public string? Read(string provider)
    {
        if (!NativeMethods.CredReadW(Target(provider), Generic, 0, out var handle))
        {
            var error = Marshal.GetLastPInvokeError();
            return error == NotFound ? null : throw SystemSecretStore.Unavailable($"CredRead failed with {error}.");
        }

        try
        {
            var credential = Marshal.PtrToStructure<Credential>(handle);
            return credential.CredentialBlobSize == 0
                ? string.Empty
                : Marshal.PtrToStringUni(credential.CredentialBlob, (int)credential.CredentialBlobSize / 2);
        }
        finally
        {
            NativeMethods.CredFree(handle);
        }
    }

    public void Write(string provider, string key)
    {
        ArgumentNullException.ThrowIfNull(key);
        var target = Marshal.StringToHGlobalUni(Target(provider));
        var user = Marshal.StringToHGlobalUni(provider);
        var blob = Marshal.StringToHGlobalUni(key);
        try
        {
            var credential = new Credential
            {
                Type = Generic,
                TargetName = target,
                CredentialBlobSize = (uint)Encoding.Unicode.GetByteCount(key),
                CredentialBlob = blob,
                Persist = PersistLocalMachine,
                UserName = user,
            };
            if (!NativeMethods.CredWriteW(ref credential, 0))
            {
                throw SystemSecretStore.Unavailable($"CredWrite failed with {Marshal.GetLastPInvokeError()}.");
            }
        }
        finally
        {
            Marshal.ZeroFreeGlobalAllocUnicode(blob);
            Marshal.FreeHGlobal(user);
            Marshal.FreeHGlobal(target);
        }
    }

    public void Delete(string provider)
    {
        if (!NativeMethods.CredDeleteW(Target(provider), Generic, 0) && Marshal.GetLastPInvokeError() is var error && error != NotFound)
        {
            throw SystemSecretStore.Unavailable($"CredDelete failed with {error}.");
        }
    }

    private string Target(string provider) => $"{service}/{provider}";

    [StructLayout(LayoutKind.Sequential)]
    private struct Credential
    {
        public int Flags;
        public int Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public long LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    private static class NativeMethods
    {
        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CredReadW(string target, int type, int flags, out IntPtr credential);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CredWriteW(ref Credential credential, int flags);

        [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode, ExactSpelling = true)]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool CredDeleteW(string target, int type, int flags);

        [DllImport("advapi32.dll", ExactSpelling = true)]
        [DefaultDllImportSearchPaths(DllImportSearchPath.System32)]
        public static extern void CredFree(IntPtr buffer);
    }
}

/// <summary>A store reached through a command of the system, with the key on its standard input or output.</summary>
public abstract class CommandSecretStore : ISecretStore
{
    public abstract string? Read(string provider);

    public abstract void Write(string provider, string key);

    public abstract void Delete(string provider);

    /// <summary>Runs a command; the key, if any, goes on its standard input and never in its arguments.</summary>
    protected static (int Exit, string Output) Run(string program, IEnumerable<string> arguments, string? input = null)
    {
        var start = new ProcessStartInfo(program)
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var argument in arguments)
        {
            start.ArgumentList.Add(argument);
        }

        try
        {
            using var process = Process.Start(start) ?? throw SystemSecretStore.Unavailable($"{program} did not start.");
            if (input is not null)
            {
                process.StandardInput.Write(input);
            }

            process.StandardInput.Close();
            var output = process.StandardOutput.ReadToEnd();
            process.StandardError.ReadToEnd();
            process.WaitForExit();
            return (process.ExitCode, output);
        }
        catch (System.ComponentModel.Win32Exception)
        {
            throw SystemSecretStore.Unavailable($"{program} is not installed.");
        }
    }
}

/// <summary>The keychain of macOS, through the <c>security</c> command.</summary>
public sealed class MacKeychainStore(string service) : CommandSecretStore
{
    public override string? Read(string provider)
    {
        var (exit, output) = Run("security", ["find-generic-password", "-s", service, "-a", provider, "-w"]);
        return exit == 0 ? output.TrimEnd('\n') : null;
    }

    public override void Write(string provider, string key)
    {
        // security only takes the password as an argument when there is no terminal to ask on; it is visible
        // to other processes of the same user for the instant the command runs.
        var (exit, _) = Run("security", ["add-generic-password", "-U", "-s", service, "-a", provider, "-w", key]);
        if (exit != 0)
        {
            throw SystemSecretStore.Unavailable($"security add-generic-password ended with {exit}.");
        }
    }

    public override void Delete(string provider) =>
        Run("security", ["delete-generic-password", "-s", service, "-a", provider]);
}

/// <summary>The Secret Service of Linux (GNOME Keyring, KWallet), through the <c>secret-tool</c> command.</summary>
public sealed class LinuxSecretToolStore(string service) : CommandSecretStore
{
    public override string? Read(string provider)
    {
        var (exit, output) = Run("secret-tool", ["lookup", "service", service, "provider", provider]);
        return exit == 0 && output.Length > 0 ? output : null;
    }

    public override void Write(string provider, string key)
    {
        var (exit, _) = Run("secret-tool", ["store", $"--label={service} ({provider})", "service", service, "provider", provider], key);
        if (exit != 0)
        {
            throw SystemSecretStore.Unavailable($"secret-tool store ended with {exit}.");
        }
    }

    public override void Delete(string provider) =>
        Run("secret-tool", ["clear", "service", service, "provider", provider]);
}
