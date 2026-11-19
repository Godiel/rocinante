using Serilog;
using Serilog.Events;

namespace Rocinante.Sidecar;

/// <summary>Where the problems the interface and the host report are written.</summary>
internal interface IReportedProblems
{
    /// <param name="source"><c>interface</c> or <c>host</c>, as the contract names them.</param>
    /// <param name="level"><c>warning</c> or <c>error</c>.</param>
    /// <param name="message">What failed and where; never the writer's text.</param>
    /// <param name="detail">A stack trace or similar, if there is one.</param>
    void Report(string source, string level, string message, string? detail);
}

/// <summary>The problems go to the app's log, marked with who saw them.</summary>
internal sealed class LoggedProblems(ILogger logger) : IReportedProblems
{
    public void Report(string source, string level, string message, string? detail)
    {
        var at = level == "error" ? LogEventLevel.Error : LogEventLevel.Warning;
        var log = logger.ForContext("Source", source);
        if (string.IsNullOrEmpty(detail))
        {
            log.Write(at, "{Message:l}", message);
        }
        else
        {
            log.Write(at, "{Message:l}{NewLine}{Detail:l}", message, Environment.NewLine, detail);
        }
    }
}
