using Rocinante.Infrastructure.Logging;
using Serilog.Events;

namespace Rocinante.Infrastructure.Tests.Logging;

public sealed class LogFileTests : IDisposable
{
    private readonly TempFolder _folder = new();

    public void Dispose() => _folder.Dispose();

    private string[] Lines()
    {
        var file = Directory.GetFiles(LogFile.FolderOf(_folder.Path), "rocinante-*.log").ShouldHaveSingleItem();
        return File.ReadAllLines(file);
    }

    /// <summary>The lines without their timestamp.</summary>
    private string[] Events() => [.. Lines().Select(line => line[line.IndexOf('[', StringComparison.Ordinal)..])];

    [Fact]
    public void The_log_lives_in_the_logs_folder_of_the_app_data_with_one_file_per_day()
    {
        using (var log = LogFile.Create(_folder.Path))
        {
            log.Information("Core started");
        }

        Events().ShouldBe(["[INF] core: Core started"]);
        Path.GetFileName(Directory.GetFiles(LogFile.FolderOf(_folder.Path)).Single())
            .ShouldMatch(@"^rocinante-\d{8}\.log$");
    }

    [Fact]
    public void Each_line_written_to_a_log_writer_is_one_event_at_its_level_and_braces_stay_as_they_are()
    {
        using (var log = LogFile.Create(_folder.Path))
        {
            using var writer = new LogWriter(log, LogEventLevel.Warning);
            writer.WriteLine("settings: could not be read ({unexpected end}); starting with defaults.");
            writer.Write("half a line, ");
            writer.Write("finished\r\n");
        }

        Events().ShouldBe(
        [
            "[WRN] core: settings: could not be read ({unexpected end}); starting with defaults.",
            "[WRN] core: half a line, finished",
        ]);
    }

    [Fact]
    public void Below_the_minimum_level_nothing_is_written()
    {
        using (var log = LogFile.Create(_folder.Path, LogEventLevel.Warning))
        {
            log.Information("noise");
            log.Error("Saving failed for document {Id}", "0196a3b2");
        }

        Events().ShouldBe(["[ERR] core: Saving failed for document 0196a3b2"]);
    }
}
