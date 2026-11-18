using System.Text;
using Rocinante.Sidecar;

// Walking skeleton for feature 001: a JSON-RPC 2.0 server over stdin/stdout.
// stdout carries protocol messages only; diagnostics go to stderr.
if (args.Length != 1)
{
    Console.Error.WriteLine("usage: Rocinante.Sidecar <project-file>");
    return 2;
}

Console.InputEncoding = new UTF8Encoding(false);
var output = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true };

using var store = SkeletonDocumentStore.Open(args[0]);
var server = new JsonRpcServer(output, store, ProtocolContract.LoadEmbedded());

string? line;
while ((line = Console.In.ReadLine()) is not null)
{
    if (line.Length > 0)
    {
        server.Handle(line);
    }
}

return 0;
