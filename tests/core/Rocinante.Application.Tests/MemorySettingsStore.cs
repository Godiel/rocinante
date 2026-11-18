using Rocinante.Application.Ports;
using Rocinante.Application.Settings;

namespace Rocinante.Application.Tests;

/// <summary>Settings kept in memory, counting how often they were saved.</summary>
internal sealed class MemorySettingsStore(AppSettings? initial = null) : ISettingsStore
{
    public AppSettings Stored { get; private set; } = initial ?? AppSettings.Empty;

    public int Saves { get; private set; }

    public AppSettings Load() => Stored;

    public void Save(AppSettings settings)
    {
        Stored = settings;
        Saves++;
    }
}
