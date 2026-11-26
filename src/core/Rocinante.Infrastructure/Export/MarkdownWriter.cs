using System.Text;
using Rocinante.Application.Ports;
using Rocinante.Domain.Books;

namespace Rocinante.Infrastructure.Export;

/// <summary>
/// The book as Markdown: the title and the chapters as headings, italics and bold as marks, scene breaks as
/// rules and the footnotes in the <c>[^1]</c> syntax, numbered through the whole book. Underlining has no mark
/// and goes as plain text.
/// </summary>
public sealed class MarkdownWriter : IBookWriter
{
    public ExportFormat Format => ExportFormat.Markdown;

    public void Write(Book book, Stream output, Action<int> chapterDone)
    {
        ArgumentNullException.ThrowIfNull(book);
        ArgumentNullException.ThrowIfNull(chapterDone);

        using var writer = new StreamWriter(output, new UTF8Encoding(false), leaveOpen: true) { NewLine = "\n" };
        if (book.Parts.Cover)
        {
            writer.WriteLine($"# {Escape(book.Title)}");
            writer.WriteLine();
            if (book.Author.Length > 0)
            {
                writer.WriteLine(Escape(book.Author));
                writer.WriteLine();
            }
        }

        if (book.Parts.Credits)
        {
            writer.WriteLine(string.Join("  \n", book.Credits.Split('\n').Select(Escape)));
            writer.WriteLine();
        }

        if (book.Parts.Contents && book.Chapters.Count > 0)
        {
            writer.WriteLine("## Índice");
            writer.WriteLine();
            for (var index = 0; index < book.Chapters.Count; index++)
            {
                writer.WriteLine($"{index + 1}. {Escape(TitleOf(book.Chapters[index], index))}");
            }

            writer.WriteLine();
        }

        var footnotes = 0;
        for (var index = 0; index < book.Chapters.Count; index++)
        {
            var chapter = book.Chapters[index];
            var first = footnotes;
            writer.WriteLine($"## {Escape(TitleOf(chapter, index))}");
            writer.WriteLine();
            foreach (var block in chapter.Blocks)
            {
                WriteBlock(writer, block, string.Empty, first);
            }

            foreach (var note in chapter.Footnotes)
            {
                writer.WriteLine($"[^{first + note.Number}]: {Escape(note.Text)}");
                footnotes++;
            }

            if (footnotes > first)
            {
                writer.WriteLine();
            }

            chapterDone(index + 1);
        }
    }

    internal static string TitleOf(BookChapter chapter, int index) =>
        string.IsNullOrWhiteSpace(chapter.Title) ? $"Capítulo {index + 1}" : chapter.Title.Trim();

    private static void WriteBlock(StreamWriter writer, BookBlock block, string prefix, int footnotes)
    {
        switch (block)
        {
            case BookParagraph paragraph:
                writer.WriteLine(prefix + Inlines(paragraph.Inlines, footnotes).Replace("\n", "\n" + prefix, StringComparison.Ordinal));
                writer.WriteLine(prefix.TrimEnd());
                break;
            case BookHeading heading:
                writer.WriteLine($"{prefix}{new string('#', heading.Level + 2)} {Inlines(heading.Inlines, footnotes).Replace("\\\n", " ", StringComparison.Ordinal)}");
                writer.WriteLine(prefix.TrimEnd());
                break;
            case BookQuote quote:
                foreach (var inner in quote.Blocks)
                {
                    WriteBlock(writer, inner, prefix + "> ", footnotes);
                }

                break;
            case BookList list:
                for (var index = 0; index < list.Items.Count; index++)
                {
                    var marker = list.Ordered ? $"{index + 1}. " : "- ";
                    var item = string.Concat(list.Items[index].Select(each => BlockText(each, footnotes)));
                    var lines = item.TrimEnd('\n').Split('\n');
                    writer.WriteLine(prefix + marker + lines[0]);
                    foreach (var line in lines.Skip(1))
                    {
                        writer.WriteLine(prefix + new string(' ', marker.Length) + line);
                    }
                }

                writer.WriteLine(prefix.TrimEnd());
                break;
            case BookSceneBreak:
                writer.WriteLine(prefix + "* * *");
                writer.WriteLine(prefix.TrimEnd());
                break;
            default:
                break;
        }
    }

    /// <summary>A block inside a list item, as lines without the item's marker.</summary>
    private static string BlockText(BookBlock block, int footnotes)
    {
        using var stream = new MemoryStream();
        using (var writer = new StreamWriter(stream, new UTF8Encoding(false), leaveOpen: true) { NewLine = "\n" })
        {
            WriteBlock(writer, block, string.Empty, footnotes);
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }

    /// <summary>The text of a paragraph with its marks; the spaces at either end of a styled run stay outside them.</summary>
    internal static string Inlines(IReadOnlyList<BookInline> inlines, int footnotes)
    {
        var text = new StringBuilder();
        foreach (var inline in inlines)
        {
            switch (inline)
            {
                case TextRun run:
                    var mark = (run.Style & (TextStyle.Bold | TextStyle.Italic)) switch
                    {
                        TextStyle.Bold | TextStyle.Italic => "***",
                        TextStyle.Bold => "**",
                        TextStyle.Italic => "*",
                        _ => string.Empty,
                    };
                    var core = run.Text.Trim();
                    if (mark.Length == 0 || core.Length == 0)
                    {
                        text.Append(Escape(run.Text));
                        break;
                    }

                    var lead = run.Text[..(run.Text.Length - run.Text.TrimStart().Length)];
                    var tail = run.Text[run.Text.TrimEnd().Length..];
                    text.Append(lead).Append(mark).Append(Escape(core)).Append(mark).Append(tail);
                    break;
                case LineBreak:
                    text.Append("\\\n");
                    break;
                case FootnoteCall call:
                    text.Append("[^").Append(footnotes + call.Number).Append(']');
                    break;
                default:
                    break;
            }
        }

        return text.ToString();
    }

    /// <summary>Escapes what Markdown would read as a mark: emphasis, links, code and what starts a line.</summary>
    internal static string Escape(string text)
    {
        var escaped = new StringBuilder(text.Length);
        foreach (var character in text)
        {
            if (character is '\\' or '*' or '_' or '`' or '[' or ']' or '<' or '>' or '#')
            {
                escaped.Append('\\');
            }

            escaped.Append(character);
        }

        // A line that starts like a list or a rule is read as one.
        var result = escaped.ToString();
        if (result.Length > 0 && (result[0] is '-' or '+' || (char.IsAsciiDigit(result[0]) && result.TrimStart('0', '1', '2', '3', '4', '5', '6', '7', '8', '9').StartsWith('.'))))
        {
            var dot = result.IndexOf('.', StringComparison.Ordinal);
            result = result[0] is '-' or '+' ? "\\" + result : result[..dot] + "\\" + result[dot..];
        }

        return result;
    }
}
