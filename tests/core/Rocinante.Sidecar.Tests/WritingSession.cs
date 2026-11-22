using System.Text.Json.Nodes;
using static Rocinante.Sidecar.Tests.ContractTests;

namespace Rocinante.Sidecar.Tests;

/// <summary>
/// A writer's day through the protocol, touching every method: create a work, shape its index,
/// write, leave notes, keep versions, copy it and close it. The contract test then checks that
/// every response and notification on the way conforms.
/// </summary>
internal sealed class WritingSession(ServerHarness harness)
{
    private const string Main = "main";
    private const string Other = "window-1";

    private const string Trade = """
        {
          "pageSize": "trade", "pageWidth": 152.4, "pageHeight": 228.6,
          "margins": { "top": 19, "bottom": 22, "inside": 22, "outside": 16 },
          "typeface": "literata", "bodySize": 10.5, "leading": 1.4,
          "firstLineIndent": true, "justified": true, "dropCap": true
        }
        """;

    public void Run()
    {
        harness.Call("system.info");
        harness.Call("system.ping");
        harness.Call("diagnostics.report", Params(("source", "interface"), ("level", "warning"), ("message", "A window started slowly")));
        harness.Call("app.start", Params(("origin", Main)));
        harness.Call("preferences.update", Params(("changes", JsonNode.Parse("""{ "theme": "candlelight", "outline": "floating" }""")), ("origin", Main)));

        // The writer brings a sound of their own, mixes it with the rain, and later takes it away.
        var recording = harness.PathOf("lluvia en el tejado.ogg");
        File.WriteAllBytes(recording, [.. "OggS"u8, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0]);
        var own = Id(harness.Call("ambience.import", Params(("path", recording), ("kind", "sound"), ("origin", Main))));
        harness.Call("preferences.update", Params(("changes", JsonNode.Parse($$"""
            {
              "ambience": {
                "background": "builtin:rain-window",
                "typing": { "sound": "typewriter", "volume": 0.6, "muted": false },
                "ambients": [{ "id": "builtin:rain", "level": 0.8 }, { "id": "own:{{own}}", "level": 0.4 }],
                "ambientVolume": 0.5,
                "ambientMuted": false,
                "dimOthers": true,
                "goal": { "kind": "words", "amount": 500 }
              }
            }
            """)), ("origin", Main)));
        harness.Call("ambience.remove", Params(("id", own), ("origin", Other)));

        var original = harness.PathOf("quijote.rocinante");
        harness.Call("project.create", Params(("path", original), ("title", "El ingenioso hidalgo"), ("origin", Main)));
        harness.Call("project.get");
        harness.Call("project.rename", Params(("title", "Don Quijote de la Mancha"), ("origin", Main)));
        harness.Call("project.setFormat", Params(("format", JsonNode.Parse(Trade)), ("origin", Other)));

        var first = Id(harness.Call("document.create", Params(("kind", "chapter"), ("title", "Capítulo primero"), ("origin", Main))));
        var second = Id(harness.Call("document.create", Params(("kind", "chapter"), ("title", "Capítulo segundo"), ("position", 1), ("origin", Main))));
        var fragment = Id(harness.Call("document.create", Params(("kind", "fragment"), ("title", "Molinos"), ("origin", Other))));
        harness.Call("document.rename", Params(("id", first), ("title", "Que trata de la condición"), ("origin", Main)));
        harness.Call("document.move", Params(("id", fragment), ("kind", "chapter"), ("position", 0), ("origin", Main)));
        harness.Call("document.delete", Params(("id", second), ("origin", Main)));
        harness.Call("document.restore", Params(("id", second), ("origin", Main)));

        var note = Id(harness.Call("note.create", Params(("documentId", first), ("text", "Revisar esta fecha"), ("anchored", true), ("origin", Main))));
        harness.Call("document.save", Params(("id", first), ("content", JsonNode.Parse(TipTap.Anchored("En un lugar de la Mancha", Guid.Parse(note)))), ("origin", Main)));
        harness.Call("document.get", Params(("id", first)));
        harness.Call("project.manuscript");
        harness.Call("place.save", Params(("documentId", first), ("anchor", 5), ("head", 12)));
        harness.Call("place.get");
        var version = Id(harness.Call("version.create", Params(("documentId", first), ("name", "Primer borrador"), ("origin", Main))));

        harness.Clock.AdvanceMinutes(1);
        harness.Call("document.save", Params(("id", first), ("content", JsonNode.Parse(TipTap.Paragraphs("Otro comienzo"))), ("origin", Other)));
        harness.Call("version.list", Params(("documentId", first)));
        harness.Call("version.get", Params(("id", version)));
        harness.Call("version.restore", Params(("id", version), ("origin", Main)));

        harness.Call("note.update", Params(("id", note), ("text", "Revisar la fecha de la batalla"), ("origin", Main)));
        harness.Call("note.list", Params(("documentId", first)));
        harness.Call("note.delete", Params(("id", note), ("origin", Main)));

        harness.Call("project.saveAs", Params(("path", harness.PathOf("copias/quijote-copia.rocinante")), ("origin", Main)));
        harness.Call("project.open", Params(("path", original), ("origin", Main)));
        harness.Call("project.close", Params(("origin", Main)));
        harness.Call("recent.list");
        harness.Call("recent.remove", Params(("path", original), ("origin", Main)));
    }

    private static string Id(JsonNode? result) => result!["id"]!.GetValue<string>();
}
