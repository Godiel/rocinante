namespace Rocinante.Sidecar;

/// <summary>Arguments of the core process.</summary>
internal sealed record CommandLine(string? DataDirectory, string? OpenFile, bool KeysInMemory = false)
{
    /// <summary>Reads <c>--data-dir</c>, <c>--open</c> and <c>--keys-in-memory</c>. Returns null if anything else is passed.</summary>
    public static CommandLine? Parse(IReadOnlyList<string> args)
    {
        string? dataDirectory = null;
        string? openFile = null;
        var keysInMemory = false;

        for (var index = 0; index < args.Count; index++)
        {
            var value = index + 1 < args.Count ? args[index + 1] : null;
            switch (args[index])
            {
                case "--data-dir" when value is not null:
                    dataDirectory = value;
                    index++;
                    break;
                case "--open" when value is not null:
                    openFile = value;
                    index++;
                    break;
                case "--keys-in-memory":
                    keysInMemory = true;
                    break;
                default:
                    return null;
            }
        }

        return new CommandLine(dataDirectory, openFile, keysInMemory);
    }
}
