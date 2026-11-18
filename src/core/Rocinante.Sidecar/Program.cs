using System.Text;
using Rocinante.Infrastructure.Persistence;
using Rocinante.Sidecar;

// The Rocinante core: a JSON-RPC 2.0 server over stdin/stdout, started by the Tauri host.
// stdout carries protocol messages only; diagnostics go to stderr. It starts with no project
// open: the UI creates or opens one.
Console.InputEncoding = new UTF8Encoding(false);
var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };

using var core = new Core(output, Console.Error, new SqliteProjectFiles(), TimeProvider.System, ProtocolContract.LoadEmbedded());

string? line;
while ((line = Console.In.ReadLine()) is not null)
{
    if (line.Length > 0)
    {
        core.Handle(line);
    }
}
