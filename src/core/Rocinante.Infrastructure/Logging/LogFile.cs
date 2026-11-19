using System.Globalization;
using Serilog;
using Serilog.Core;
using Serilog.Events;

namespace Rocinante.Infrastructure.Logging;

/// <summary>
/// The app's log: plain text files in <c>logs</c> inside the app data folder, one per day, never
/// more than a few megabytes and kept for two weeks. The core, the interface and the host all
/// write here. What goes in says what failed and where, never the writer's text.
/// </summary>
public static class LogFile
{
    /// <summary>Largest size of one file before a new one is started.</summary>
    public const long MaxFileBytes = 5 * 1024 * 1024;

    /// <summary>How many files are kept: two weeks of daily files.</summary>
    public const int FilesKept = 14;

    private const string Template =
        "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Source}: {Message:lj}{NewLine}{Exception}";

    /// <summary>The folder of the log, inside the app data folder.</summary>
    public static string FolderOf(string dataDirectory) => Path.Combine(dataDirectory, "logs");

    public static Logger Create(string dataDirectory, LogEventLevel minimum = LogEventLevel.Information) =>
        new LoggerConfiguration()
            .MinimumLevel.Is(minimum)
            .Enrich.WithProperty("Source", "core")
            .WriteTo.File(
                Path.Combine(FolderOf(dataDirectory), "rocinante-.log"),
                outputTemplate: Template,
                formatProvider: CultureInfo.InvariantCulture,
                rollingInterval: RollingInterval.Day,
                fileSizeLimitBytes: MaxFileBytes,
                rollOnFileSizeLimit: true,
                retainedFileCountLimit: FilesKept,
                // A crash must not lose the last lines: every event goes to disk at once.
                flushToDiskInterval: null,
                buffered: false)
            .CreateLogger();
}
