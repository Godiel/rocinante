using System.Text;
using Rocinante.Infrastructure.Logging;
using Rocinante.Infrastructure.Persistence;
using Rocinante.Infrastructure.Settings;
using Rocinante.Sidecar;
using Serilog.Events;

// The Rocinante core: a JSON-RPC 2.0 server over stdin/stdout, started by the Tauri host.
// stdout carries protocol messages only; problems go to the log in the app data folder.
//
//   rocinante-core [--data-dir <folder>] [--open <project.rocinante>]
//
// --data-dir  where the app keeps its settings and its log (the host passes its app data folder).
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

using var log = LogFile.Create(dataDirectory);
AppDomain.CurrentDomain.UnhandledException += (_, error) =>
    log.Fatal(error.ExceptionObject as Exception, "The core stopped on an unexpected error");

var options = new CoreOptions(
    new SqliteProjectFiles(),
    new JsonSettingsStore(dataDirectory, new LogWriter(log, LogEventLevel.Warning)),
    TimeProvider.System,
    defaultFolder,
    arguments.OpenFile,
    new LoggedProblems(log),
    new AmbienceFolder(dataDirectory));

var contract = ProtocolContract.LoadEmbedded();
using var core = new Core(output, new LogWriter(log, LogEventLevel.Error), options, contract);
log.Information("Core started: protocol {Protocol}, {Runtime} on {System}", contract.ProtocolVersion, Environment.Version, Environment.OSVersion);

string? line;
while ((line = Console.In.ReadLine()) is not null)
{
    if (line.Length > 0)
    {
        core.Handle(line);
    }
}

log.Information("Core stopped: the host closed its input");
return 0;
