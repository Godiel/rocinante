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

    public void Run()
    {
        harness.Call("system.info");
        harness.Call("system.ping");
        harness.Call("app.start", Params(("origin", Main)));
        harness.Call("preferences.update", Params(("changes", JsonNode.Parse("""{ "theme": "candlelight", "outline": "floating" }""")), ("origin", Main)));

        var original = harness.PathOf("quijote.rocinante");
        harness.Call("project.create", Params(("path", original), ("title", "El ingenioso hidalgo"), ("origin", Main)));
        harness.Call("project.get");
        harness.Call("project.rename", Params(("title", "Don Quijote de la Mancha"), ("origin", Main)));

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
