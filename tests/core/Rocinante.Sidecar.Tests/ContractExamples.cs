using System.Text.Json.Nodes;

namespace Rocinante.Sidecar.Tests;

/// <summary>
/// Example params from <c>src/contracts/examples/&lt;method&gt;.json</c>, shared with the UI tests.
/// </summary>
internal static class ContractExamples
{
    private static readonly string _examplesDirectory = Path.Combine(AppContext.BaseDirectory, "contract", "examples");

    /// <summary>The contract file as it exists in the repository.</summary>
    public static string ProtocolPath { get; } = Path.Combine(AppContext.BaseDirectory, "contract", "protocol.json");

    public static bool Exists(string method) => File.Exists(PathOf(method));

    public static IReadOnlyList<JsonNode> Valid(string method) => Load(method, "valid");

    public static IReadOnlyList<JsonNode> Invalid(string method) => Load(method, "invalid");

    /// <summary>Every (method, example index) pair, for theories.</summary>
    public static TheoryData<string, int> Cases(string kind)
    {
        var data = new TheoryData<string, int>();
        foreach (var method in ServerHarness.Contract.Methods.Where(Exists))
        {
            for (var index = 0; index < Load(method, kind).Count; index++)
            {
                data.Add(method, index);
            }
        }

        return data;
    }

    private static string PathOf(string method) => Path.Combine(_examplesDirectory, $"{method}.json");

    private static List<JsonNode> Load(string method, string kind) =>
        JsonNode.Parse(File.ReadAllText(PathOf(method)))![kind]!.AsArray().Select(node => node!).ToList();
}
