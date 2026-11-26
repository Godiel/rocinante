using System.Text.Json.Nodes;
using Rocinante.Domain.Content;
using Rocinante.Domain.Formats;

namespace Rocinante.Domain.Books;

/// <summary>How a piece of text is set: in italics, in bold, underlined.</summary>
[Flags]
public enum TextStyle
{
    Plain = 0,
    Italic = 1,
    Bold = 2,
    Underline = 4,
}

/// <summary>Something inside a paragraph: text, a line break or the call of a footnote.</summary>
public abstract record BookInline;

public sealed record TextRun(string Text, TextStyle Style) : BookInline;

public sealed record LineBreak : BookInline
{
    public static LineBreak Instance { get; } = new();
}

/// <summary>The call of a footnote, numbered from 1 in each chapter, with its text.</summary>
public sealed record FootnoteCall(int Number, string Text) : BookInline;

/// <summary>A block of a chapter.</summary>
public abstract record BookBlock;

/// <summary>
/// A paragraph. <see cref="Follows"/> says it comes right after another paragraph, so the format may indent its
/// first line; <see cref="Opens"/> says it is the first of its chapter, where a drop cap goes.
/// </summary>
public sealed record BookParagraph(IReadOnlyList<BookInline> Inlines, int Indent, bool Follows, bool Opens) : BookBlock;

/// <summary>A title inside the text, of level 1 to 3.</summary>
public sealed record BookHeading(int Level, IReadOnlyList<BookInline> Inlines) : BookBlock;

public sealed record BookQuote(IReadOnlyList<BookBlock> Blocks) : BookBlock;

/// <summary>A list; each item is the blocks inside it.</summary>
public sealed record BookList(bool Ordered, IReadOnlyList<IReadOnlyList<BookBlock>> Items) : BookBlock;

public sealed record BookSceneBreak : BookBlock
{
    public static BookSceneBreak Instance { get; } = new();
}

public sealed record BookChapter(string Title, IReadOnlyList<BookBlock> Blocks)
{
    /// <summary>The footnotes of the chapter in reading order.</summary>
    public IEnumerable<FootnoteCall> Footnotes => Book.CallsIn(Blocks);
}

/// <summary>The formats a book is written in.</summary>
public enum ExportFormat
{
    Pdf,
    Epub,
    Docx,
    Markdown,
}

/// <summary>The parts a book carries besides the chapters.</summary>
public sealed record ExportParts(bool Cover, bool Credits, bool Contents)
{
    public static ExportParts All { get; } = new(true, true, true);
}

/// <summary>
/// The chapters of the work set as a book, the same for every format: each writer only says it its own way.
/// Fragments and the author's notes are not part of it.
/// </summary>
/// <param name="Identifier">Stays the same from one export of the work to the next: the id of the work.</param>
/// <param name="Date">When it was exported, for the credits and the data of the book.</param>
/// <param name="Title">The title of the work.</param>
/// <param name="Author">The author, as on the cover; it may be empty.</param>
/// <param name="Credits">The credits page, already resolved to the default if the author wrote none.</param>
/// <param name="Cover">The cover image, a JPEG, for EPUB; null if there is none.</param>
/// <param name="Format">The format of the work: page, margins, typeface.</param>
/// <param name="Parts">The parts it carries besides the chapters.</param>
/// <param name="Chapters">The chapters in reading order.</param>
public sealed record Book(
    string Identifier,
    DateTimeOffset Date,
    string Title,
    string Author,
    string Credits,
    ReadOnlyMemory<byte>? Cover,
    WorkFormat Format,
    ExportParts Parts,
    IReadOnlyList<BookChapter> Chapters)
{
    public const string Language = "es";

    /// <summary>Reads a chapter from the content the editor wrote.</summary>
    public static BookChapter ChapterOf(string title, DocumentContent content)
    {
        ArgumentNullException.ThrowIfNull(content);
        var root = JsonNode.Parse(content.Json)!.AsObject();
        var reader = new Reader();
        return new BookChapter(title, reader.Blocks(root));
    }

    internal static IEnumerable<FootnoteCall> CallsIn(IEnumerable<BookBlock> blocks)
    {
        foreach (var block in blocks)
        {
            var inlines = block switch
            {
                BookParagraph paragraph => paragraph.Inlines,
                BookHeading heading => heading.Inlines,
                _ => [],
            };
            foreach (var call in inlines.OfType<FootnoteCall>())
            {
                yield return call;
            }

            var inner = block switch
            {
                BookQuote quote => quote.Blocks,
                BookList list => list.Items.SelectMany(item => item),
                _ => [],
            };
            foreach (var call in CallsIn(inner))
            {
                yield return call;
            }
        }
    }

    /// <summary>Walks the editor's tree once, numbering the footnotes as they come.</summary>
    private sealed class Reader
    {
        private int _footnotes;
        private bool _opened;

        public List<BookBlock> Blocks(JsonObject parent)
        {
            var blocks = new List<BookBlock>();
            foreach (var child in Children(parent))
            {
                var previous = blocks.Count > 0 ? blocks[^1] : null;
                if (Block(child, previous) is { } block)
                {
                    blocks.Add(block);
                }
            }

            return blocks;
        }

        private BookBlock? Block(JsonObject node, BookBlock? previous)
        {
            switch (TypeOf(node))
            {
                case "paragraph":
                    var inlines = Inlines(node);
                    if (inlines.Count == 0)
                    {
                        return null;
                    }

                    var opens = !_opened;
                    _opened = true;
                    return new BookParagraph(inlines, IndentOf(node), previous is BookParagraph, opens);
                case "heading":
                    var title = Inlines(node);
                    return title.Count == 0 ? null : new BookHeading(Math.Clamp(IntAttribute(node, "level") ?? 1, 1, 3), title);
                case "blockquote":
                    var quoted = Blocks(node);
                    return quoted.Count == 0 ? null : new BookQuote(quoted);
                case "bulletList":
                case "orderedList":
                    var items = Children(node)
                        .Where(item => TypeOf(item) == "listItem")
                        .Select(item => (IReadOnlyList<BookBlock>)Blocks(item))
                        .Where(item => item.Count > 0)
                        .ToList();
                    return items.Count == 0 ? null : new BookList(TypeOf(node) == "orderedList", items);
                case "sceneBreak":
                    return BookSceneBreak.Instance;
                default:
                    // Something the book does not know is read for its paragraphs.
                    var inside = Blocks(node);
                    return inside.Count == 1 ? inside[0] : inside.Count > 1 ? new BookQuote(inside) : null;
            }
        }

        private List<BookInline> Inlines(JsonObject parent)
        {
            var inlines = new List<BookInline>();
            foreach (var child in Children(parent))
            {
                switch (TypeOf(child))
                {
                    case "text":
                        var text = child["text"] is JsonValue value && value.TryGetValue(out string? words) ? words : null;
                        if (!string.IsNullOrEmpty(text))
                        {
                            var style = StyleOf(child);
                            if (inlines.Count > 0 && inlines[^1] is TextRun last && last.Style == style)
                            {
                                inlines[^1] = last with { Text = last.Text + text };
                            }
                            else
                            {
                                inlines.Add(new TextRun(text, style));
                            }
                        }

                        break;
                    case "hardBreak":
                        inlines.Add(LineBreak.Instance);
                        break;
                    case DocumentContent.FootnoteType:
                        var note = child["attrs"]?["text"] is JsonValue noteText && noteText.TryGetValue(out string? said) ? said.Trim() : string.Empty;
                        if (note.Length > 0)
                        {
                            inlines.Add(new FootnoteCall(++_footnotes, note));
                        }

                        break;
                    default:
                        // Note points and anything else of the author's are not part of the book.
                        break;
                }
            }

            while (inlines.Count > 0 && inlines[^1] is LineBreak)
            {
                inlines.RemoveAt(inlines.Count - 1);
            }

            return inlines.Any(inline => inline is TextRun run && run.Text.Trim().Length > 0 || inline is FootnoteCall)
                ? inlines
                : [];
        }

        private static TextStyle StyleOf(JsonObject text)
        {
            var style = TextStyle.Plain;
            if (text["marks"] is not JsonArray marks)
            {
                return style;
            }

            foreach (var mark in marks.OfType<JsonObject>())
            {
                style |= TypeOf(mark) switch
                {
                    "italic" => TextStyle.Italic,
                    "bold" => TextStyle.Bold,
                    "underline" => TextStyle.Underline,
                    _ => TextStyle.Plain,
                };
            }

            return style;
        }

        private static int IndentOf(JsonObject node) => Math.Clamp(IntAttribute(node, "indent") ?? 0, 0, 4);

        private static int? IntAttribute(JsonObject node, string name) =>
            node["attrs"]?[name] is JsonValue value && value.TryGetValue(out double number) ? (int)number : null;

        private static IEnumerable<JsonObject> Children(JsonObject node) =>
            node["content"] is JsonArray content ? content.OfType<JsonObject>() : [];

        private static string? TypeOf(JsonObject node) =>
            node["type"] is JsonValue value && value.TryGetValue(out string? type) ? type : null;
    }
}
