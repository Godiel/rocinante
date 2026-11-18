using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Rocinante.Domain.Content;

/// <summary>
/// The text of a document, as the TipTap JSON the editor produces. The domain treats it as
/// opaque except to count it and to find the note anchors it contains.
/// </summary>
public sealed class DocumentContent : IEquatable<DocumentContent>
{
    /// <summary>Node or mark type the editor uses to anchor a note; its <c>noteId</c> attribute names the note.</summary>
    public const string NoteAnchorType = "noteAnchor";

    private const string EmptyJson = """{"type":"doc","content":[{"type":"paragraph"}]}""";

    private readonly JsonObject _root;

    private DocumentContent(string json, JsonObject root)
    {
        Json = json;
        _root = root;
        (Statistics, NoteAnchors) = Analyze(root);
    }

    /// <summary>A document with a single empty paragraph, as a new chapter starts.</summary>
    public static DocumentContent Empty { get; } = Parse(EmptyJson);

    /// <summary>The JSON exactly as received, ready to store.</summary>
    public string Json { get; }

    public TextStatistics Statistics { get; }

    /// <summary>Notes anchored somewhere in this text.</summary>
    public IReadOnlySet<NoteId> NoteAnchors { get; }

    /// <summary>Parses editor JSON. Throws <see cref="DomainError.InvalidContent"/> if it is not a TipTap document.</summary>
    public static DocumentContent Parse(string json)
    {
        ArgumentNullException.ThrowIfNull(json);

        JsonNode? root;
        try
        {
            root = JsonNode.Parse(json);
        }
        catch (JsonException exception)
        {
            throw new DomainException(DomainError.InvalidContent, $"Content is not valid JSON: {exception.Message}");
        }

        if (root is not JsonObject document || TypeOf(document) != "doc")
        {
            throw new DomainException(DomainError.InvalidContent, "Content must be a TipTap document of type \"doc\".");
        }

        return new DocumentContent(json, document);
    }

    /// <summary>Two contents are equal when their JSON trees are, regardless of formatting or key order.</summary>
    public bool Equals(DocumentContent? other) =>
        other is not null && (ReferenceEquals(this, other) || JsonNode.DeepEquals(_root, other._root));

    public override bool Equals(object? obj) => Equals(obj as DocumentContent);

    public override int GetHashCode() => Statistics.GetHashCode();

    private static string? TypeOf(JsonObject node) =>
        node["type"] is JsonValue value && value.TryGetValue(out string? type) ? type : null;

    private static (TextStatistics, IReadOnlySet<NoteId>) Analyze(JsonObject root)
    {
        var analysis = new Analysis();
        analysis.Visit(root, block: null);
        return (analysis.Statistics, analysis.Anchors);
    }

    /// <summary>Single pass over the tree that counts text blocks and collects note anchors.</summary>
    private sealed class Analysis
    {
        public TextStatistics Statistics { get; private set; } = TextStatistics.Zero;

        public HashSet<NoteId> Anchors { get; } = [];

        public void Visit(JsonObject node, StringBuilder? block)
        {
            var type = TypeOf(node);
            CollectAnchor(node, type);

            switch (type)
            {
                case "text":
                    block?.Append(node["text"] is JsonValue text && text.TryGetValue(out string? value) ? value : null);
                    CollectMarkAnchors(node);
                    return;
                case "hardBreak":
                    block?.Append('\n');
                    return;
            }

            if (node["content"] is not JsonArray children)
            {
                return;
            }

            // A node with inline children is a text block: it counts as one paragraph.
            if (children.OfType<JsonObject>().Any(IsInline))
            {
                var text = new StringBuilder();
                VisitAll(children, text);
                Count(text.ToString());
            }
            else
            {
                VisitAll(children, block);
            }
        }

        private static bool IsInline(JsonObject node) => TypeOf(node) is "text" or "hardBreak";

        private void VisitAll(JsonArray children, StringBuilder? block)
        {
            foreach (var child in children.OfType<JsonObject>())
            {
                Visit(child, block);
            }
        }

        private void CollectMarkAnchors(JsonObject textNode)
        {
            if (textNode["marks"] is not JsonArray marks)
            {
                return;
            }

            foreach (var mark in marks.OfType<JsonObject>())
            {
                CollectAnchor(mark, TypeOf(mark));
            }
        }

        private void CollectAnchor(JsonObject nodeOrMark, string? type)
        {
            if (type == NoteAnchorType
                && nodeOrMark["attrs"]?["noteId"] is JsonValue value
                && value.TryGetValue(out string? id)
                && Guid.TryParse(id, out var guid))
            {
                Anchors.Add(new NoteId(guid));
            }
        }

        private void Count(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return;
            }

            var characters = new StringInfo(text.Replace("\n", string.Empty, StringComparison.Ordinal))
                .LengthInTextElements;
            Statistics += new TextStatistics(CountWords(text), characters, Paragraphs: 1);
        }

        private static int CountWords(string text)
        {
            var words = 0;
            var inWord = false;
            var wordHasLetter = false;

            foreach (var character in text)
            {
                if (IsSeparator(character))
                {
                    words += inWord && wordHasLetter ? 1 : 0;
                    inWord = false;
                    wordHasLetter = false;
                    continue;
                }

                inWord = true;
                wordHasLetter |= char.IsLetterOrDigit(character);
            }

            return words + (inWord && wordHasLetter ? 1 : 0);
        }

        // Spanish dialogue glues the em dash to the word: "—Ven —dijo—." has two words.
        private static bool IsSeparator(char character) =>
            char.IsWhiteSpace(character) || character is '—' or '–';
    }
}
