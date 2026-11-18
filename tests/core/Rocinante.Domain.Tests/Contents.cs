using System.Text.Json.Nodes;
using Rocinante.Domain.Content;

namespace Rocinante.Domain.Tests;

/// <summary>Builds TipTap documents the way the editor's getJSON() shapes them.</summary>
internal static class Contents
{
    public static DocumentContent Paragraphs(params string[] paragraphs) => Doc([.. paragraphs.Select(Paragraph)]);

    public static DocumentContent Doc(params JsonNode[] blocks) =>
        DocumentContent.Parse(new JsonObject { ["type"] = "doc", ["content"] = new JsonArray(blocks) }.ToJsonString());

    public static JsonObject Paragraph(string text) => Block("paragraph", Text(text));

    public static JsonObject Block(string type, params JsonNode[] inline) =>
        inline.Length == 0
            ? new JsonObject { ["type"] = type }
            : new JsonObject { ["type"] = type, ["content"] = new JsonArray(inline) };

    public static JsonObject Text(string text, params JsonNode[] marks) =>
        marks.Length == 0
            ? new JsonObject { ["type"] = "text", ["text"] = text }
            : new JsonObject { ["type"] = "text", ["text"] = text, ["marks"] = new JsonArray(marks) };

    public static JsonObject Mark(string type) => new() { ["type"] = type };

    /// <summary>A passage anchor: the note's mark over some text.</summary>
    public static JsonObject AnchorMark(NoteId id) =>
        new() { ["type"] = DocumentContent.NoteAnchorType, ["attrs"] = new JsonObject { ["noteId"] = id.ToString() } };

    /// <summary>A point anchor: an inline node with no text.</summary>
    public static JsonObject AnchorNode(NoteId id) =>
        new() { ["type"] = DocumentContent.NoteAnchorType, ["attrs"] = new JsonObject { ["noteId"] = id.ToString() } };

    public static JsonObject HardBreak() => new() { ["type"] = "hardBreak" };
}
