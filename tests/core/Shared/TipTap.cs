using System.Text.Json.Nodes;

namespace Rocinante.Tests.Shared;

/// <summary>TipTap JSON as the editor would send it.</summary>
internal static class TipTap
{
    public static string Paragraphs(params string[] paragraphs) =>
        Doc([.. paragraphs.Select(text => Paragraph(new JsonObject { ["type"] = "text", ["text"] = text }))]);

    /// <summary>One paragraph whose text carries the anchor of a note.</summary>
    public static string Anchored(string text, Guid noteId) =>
        Doc(Paragraph(new JsonObject
        {
            ["type"] = "text",
            ["text"] = text,
            ["marks"] = new JsonArray(new JsonObject
            {
                ["type"] = "noteAnchor",
                ["attrs"] = new JsonObject { ["noteId"] = noteId.ToString() },
            }),
        }));

    private static JsonObject Paragraph(JsonObject text) =>
        new() { ["type"] = "paragraph", ["content"] = new JsonArray(text) };

    private static string Doc(params JsonNode[] blocks) =>
        new JsonObject { ["type"] = "doc", ["content"] = new JsonArray(blocks) }.ToJsonString();
}
