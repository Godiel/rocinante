using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Squire;

namespace Rocinante.Application.Squire;

/// <summary>Who the squire talks to: the provider, its model, its address if it has one of its own, and the key.</summary>
public sealed record SquireConnection(SquireProvider Provider, string Model, string? Endpoint, string? Key);

public enum SquireProvider
{
    Anthropic,
    OpenAI,
    Gemini,
    XAI,
    Compatible,
    Ollama,
}

/// <summary>Talks to a provider: one question, one answer. Implemented over HTTP in the infrastructure.</summary>
public interface ISquireClient
{
    /// <summary>Asks the model; returns the text of its answer. Throws <c>SquireRefused</c> or <c>SquireUnavailable</c>.</summary>
    Task<string> AskAsync(SquireConnection connection, string instructions, string question, CancellationToken cancellation);

    /// <summary>The models of a local provider; empty for those in the cloud.</summary>
    Task<IReadOnlyList<string>> ModelsAsync(SquireProvider provider, string? endpoint, CancellationToken cancellation);
}

/// <summary>What the squire reads in a paragraph, before the writer decides.</summary>
public sealed record SquireReading(
    IReadOnlyList<ProposedElement> Elements,
    IReadOnlyList<ProposedRelationship> Relationships,
    IReadOnlyList<ProposedDetail> Details)
{
    public static SquireReading Nothing { get; } = new([], [], []);
}

/// <summary>The squire's errand: what it is asked about a paragraph, and how its answer is read.</summary>
public static class SquireAsk
{
    /// <summary>What the model is told to do, always the same.</summary>
    public const string Instructions =
        """
        Eres el escudero de un escritor. Lees un párrafo de su novela y anotas lo que dice el texto, sin inventar nada.
        Responde solo con un objeto JSON, sin explicaciones, con esta forma:
        {"elements":[{"name":"...","kind":"character|place|plot|other","otherKind":null}],
         "relationships":[{"from":"...","to":"...","forward":"...","inverse":null}],
         "attributes":[{"element":"...","name":"...","value":"..."}]}
        - elements: personajes, lugares, tramas u otras cosas con nombre propio que aparecen en el párrafo y NO están entre las fichas que ya existen. Para "other", otherKind dice qué es (objeto, época…).
        - relationships: relaciones que el párrafo afirma entre dos nombres (fichas existentes o nuevas). forward se lee desde "from" ("hijo de"); inverse desde "to" ("padre de"), o null si es la misma ("hermano de").
        - attributes: datos que el párrafo afirma de una ficha ("Pelo": "rojo", "Edad": "cuarenta años").
        Usa los nombres tal como aparecen en el texto o en las fichas. Si no hay nada, devuelve listas vacías.
        """;

    /// <summary>The question about one paragraph, with the fichas the work already has.</summary>
    public static string Question(string paragraph, IEnumerable<Element> elements)
    {
        ArgumentNullException.ThrowIfNull(paragraph);
        ArgumentNullException.ThrowIfNull(elements);

        var question = new StringBuilder("Fichas que ya existen:\n");
        var any = false;
        foreach (var element in elements)
        {
            any = true;
            question.Append("- ").Append(element.Name);
            if (element.Aliases.Count > 0)
            {
                question.Append(" (también ").Append(string.Join(", ", element.Aliases)).Append(')');
            }

            question.Append('\n');
        }

        if (!any)
        {
            question.Append("(ninguna)\n");
        }

        return question.Append("\nPárrafo:\n").Append(paragraph).ToString();
    }

    /// <summary>
    /// Reads the model's answer: the first JSON object in it, and of that, what makes sense. Anything else is
    /// left out: an answer that cannot be read at all reads as nothing.
    /// </summary>
    public static SquireReading Read(string answer)
    {
        ArgumentNullException.ThrowIfNull(answer);

        var start = answer.IndexOf('{', StringComparison.Ordinal);
        var end = answer.LastIndexOf('}');
        if (start < 0 || end <= start)
        {
            return SquireReading.Nothing;
        }

        JsonObject root;
        try
        {
            if (JsonNode.Parse(answer[start..(end + 1)]) is not JsonObject parsed)
            {
                return SquireReading.Nothing;
            }

            root = parsed;
        }
        catch (JsonException)
        {
            return SquireReading.Nothing;
        }

        var elements = Items(root, "elements")
            .Select(item => Text(item, "name") is { } name
                ? new ProposedElement(name, KindOf(Text(item, "kind")), Text(item, "otherKind"))
                : null)
            .OfType<ProposedElement>()
            .Select(element => element.Kind == ElementKind.Other && element.OtherKind is null ? element with { OtherKind = "Otro" } : element)
            .ToList();
        var relationships = Items(root, "relationships")
            .Select(item => (Text(item, "from"), Text(item, "to"), Text(item, "forward")) is (string from, string to, string forward)
                ? new ProposedRelationship(from, to, forward, Text(item, "inverse"))
                : null)
            .OfType<ProposedRelationship>()
            .ToList();
        var details = Items(root, "attributes")
            .Select(item => (Text(item, "element"), Text(item, "name"), Text(item, "value")) is (string element, string name, string value)
                ? new ProposedDetail(element, name, value)
                : null)
            .OfType<ProposedDetail>()
            .ToList();
        return new SquireReading(elements, relationships, details);
    }

    private static IEnumerable<JsonObject> Items(JsonObject root, string name) =>
        root[name] is JsonArray items ? items.OfType<JsonObject>() : [];

    private static string? Text(JsonObject item, string name) =>
        item[name] is JsonValue value && value.TryGetValue(out string? text) && !string.IsNullOrWhiteSpace(text) ? text.Trim() : null;

    private static ElementKind KindOf(string? kind) => kind?.ToLowerInvariant() switch
    {
        "place" => ElementKind.Place,
        "plot" => ElementKind.Plot,
        "other" => ElementKind.Other,
        _ => ElementKind.Character,
    };
}
