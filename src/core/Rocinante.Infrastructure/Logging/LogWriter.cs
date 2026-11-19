using System.Text;
using Serilog;
using Serilog.Events;

namespace Rocinante.Infrastructure.Logging;

/// <summary>
/// A <see cref="TextWriter"/> whose lines become log events at one level. The parts of the core
/// that report problems only know a writer, so tests can read what they said.
/// </summary>
public sealed class LogWriter(ILogger logger, LogEventLevel level) : TextWriter
{
    private readonly StringBuilder _line = new();

    public override Encoding Encoding => Encoding.UTF8;

    public override void Write(char value)
    {
        if (value == '\n')
        {
            Flush();
        }
        else if (value != '\r')
        {
            _line.Append(value);
        }
    }

    public override void WriteLine(string? value)
    {
        _line.Append(value);
        Flush();
    }

    public override void Flush()
    {
        if (_line.Length == 0)
        {
            return;
        }

        // The text is the message itself, not a template: braces in it are not placeholders.
        logger.Write(level, "{Line:l}", _line.ToString());
        _line.Clear();
    }
}
