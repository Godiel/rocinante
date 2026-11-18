using Rocinante.Application.Settings;

namespace Rocinante.Application.Ports;

/// <summary>Where the app settings live between sessions.</summary>
public interface ISettingsStore
{
    /// <summary>The stored settings, or <see cref="AppSettings.Empty"/> when there are none or they cannot be read.</summary>
    AppSettings Load();

    /// <summary>Replaces the stored settings. A crash while saving leaves the previous ones intact.</summary>
    void Save(AppSettings settings);
}
