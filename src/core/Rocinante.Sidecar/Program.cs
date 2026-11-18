using System.Text;
using Rocinante.Infrastructure.Persistence;
using Rocinante.Infrastructure.Settings;
using Rocinante.Sidecar;

// The Rocinante core: a JSON-RPC 2.0 server over stdin/stdout, started by the Tauri host.
// stdout carries protocol messages only; diagnostics go to stderr.
//
//   rocinante-core [--data-dir <folder>] [--open <project.rocinante>]
//
// --data-dir  where the app keeps its settings (the host passes its app data folder).
// --open      a project the app was launched with, opened by the first window.
var arguments = CommandLine.Parse(args);
if (arguments is null)
{
    Console.Error.WriteLine("usage: rocinante-core [--data-dir <folder>] [--open <project.rocinante>]");
    return 2;
}

Console.InputEncoding = new UTF8Encoding(false);
var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };

var dataDirectory = arguments.DataDirectory
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Rocinante");
var defaultFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Rocinante");
var options = new CoreOptions(
    new SqliteProjectFiles(),
    new JsonSettingsStore(dataDirectory, Console.Error),
    TimeProvider.System,
    defaultFolder,
    arguments.OpenFile);

using var core = new Core(output, Console.Error, options, ProtocolContract.LoadEmbedded());

string? line;
while ((line = Console.In.ReadLine()) is not null)
{
    if (line.Length > 0)
    {
        core.Handle(line);
    }
}

return 0;
