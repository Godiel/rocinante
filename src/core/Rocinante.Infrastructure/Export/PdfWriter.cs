using System.Globalization;
using System.Text;
using Rocinante.Application.Ports;
using Rocinante.Domain.Books;
using Rocinante.Infrastructure.Export.Pdf;

namespace Rocinante.Infrastructure.Export;

/// <summary>
/// The book as a PDF ready to print, as the page view shows it: the page, the margins (inside and outside,
/// alternating), the typeface embedded, the size, the leading, the indent, the justification and the drop cap
/// of the work; each chapter on a new page with its title lowered, the footnotes at the foot of their page and
/// the page numbers, from 1 at the first chapter. The cover, the credits and the contents go first, without
/// numbers; the contents carry the page of each chapter. Each chapter is a bookmark.
/// </summary>
public sealed class PdfWriter : IBookWriter
{
    public ExportFormat Format => ExportFormat.Pdf;

    public void Write(Book book, Stream output, Action<int> chapterDone)
    {
        ArgumentNullException.ThrowIfNull(book);
        ArgumentNullException.ThrowIfNull(chapterDone);

        var file = new PdfFile(output);
        var fonts = new PdfFonts(file, book.Format.Typeface);
        var set = new Typesetter(fonts, book.Format);
        var paginator = new Paginator(set.TextHeight, set.ChapterSink, set.NoteLine);
        var chapters = new List<IReadOnlyList<SetBlock>>();
        for (var index = 0; index < book.Chapters.Count; index++)
        {
            var blocks = set.Chapter(book.Chapters[index], MarkdownWriter.TitleOf(book.Chapters[index], index));
            chapters.Add(blocks);
            paginator.Chapter(index, blocks);
            chapterDone(index + 1);
        }

        var body = paginator.Pages;
        var starts = new int[book.Chapters.Count];
        for (var page = body.Count - 1; page >= 0; page--)
        {
            if (body[page].OpensChapter)
            {
                starts[body[page].Chapter] = page + 1;
            }
        }

        var front = FrontMatter(book, set, starts);
        new Pages(file, fonts, set, book).Write(front, body, chapters);
    }

    /// <summary>The pages before the first chapter, each a list of lines from the top of the text.</summary>
    private static List<List<(double Top, SetLine Line)>> FrontMatter(Book book, Typesetter set, int[] starts)
    {
        var pages = new List<List<(double Top, SetLine Line)>>();
        if (book.Parts.Cover)
        {
            var page = new List<(double Top, SetLine Line)>();
            var top = set.ChapterSink;
            foreach (var line in set.Title(book.Title, set.Size * 2, 1.25, TextStyle.Plain, smallCaps: true, 0, set.Size * 4).Lines)
            {
                page.Add((top, line));
                top += line.Height;
            }

            if (book.Author.Length > 0)
            {
                foreach (var line in set.Title(book.Author, set.Size * 1.2, 1.3, TextStyle.Plain, smallCaps: false, 0, 0).Lines)
                {
                    page.Add((top, line));
                    top += line.Height;
                }
            }

            pages.Add(page);
        }

        if (book.Parts.Credits)
        {
            var lines = set.Plain(book.Credits, set.Size * 0.85, Ink.Soft);
            var top = set.TextHeight - lines.Sum(line => line.Height);
            var page = new List<(double Top, SetLine Line)>();
            foreach (var line in lines)
            {
                page.Add((Math.Max(0, top), line));
                top += line.Height;
            }

            pages.Add(page);
        }

        if (book.Parts.Contents && book.Chapters.Count > 0)
        {
            var page = new List<(double Top, SetLine Line)>();
            var top = set.ChapterSink;
            foreach (var line in set.Title("Índice", set.Size * 1.58, 1.25, TextStyle.Plain, smallCaps: true, 0, set.Size * 2).Lines)
            {
                page.Add((top, line));
                top += line.Height;
            }

            for (var index = 0; index < book.Chapters.Count; index++)
            {
                var line = set.ContentsLine(MarkdownWriter.TitleOf(book.Chapters[index], index), starts[index].ToString(CultureInfo.InvariantCulture));
                if (top + line.Height > set.TextHeight)
                {
                    pages.Add(page);
                    page = [];
                    top = 0;
                }

                page.Add((top, line));
                top += line.Height;
            }

            pages.Add(page);
        }

        return pages;
    }

    /// <summary>Draws the pages and writes the file around them.</summary>
    private sealed class Pages(PdfFile file, PdfFonts fonts, Typesetter set, Book book)
    {
        private readonly double _width = Typesetter.Points(book.Format.PageWidth);
        private readonly double _height = Typesetter.Points(book.Format.PageHeight);
        private readonly double _top = Typesetter.Points(book.Format.Margins.Top);
        private readonly double _bottom = Typesetter.Points(book.Format.Margins.Bottom);
        private readonly double _inside = Typesetter.Points(book.Format.Margins.Inside);
        private readonly double _outside = Typesetter.Points(book.Format.Margins.Outside);

        public void Write(
            List<List<(double Top, SetLine Line)>> front,
            IReadOnlyList<SetPage> body,
            List<IReadOnlyList<SetBlock>> chapters)
        {
            file.Start();
            var catalog = file.Reserve();
            var tree = file.Reserve();
            var resources = file.Reserve();
            var info = file.Reserve();
            var outlines = file.Reserve();
            var kids = new List<int>();

            var physical = 0;
            foreach (var page in front)
            {
                physical++;
                var content = new StringBuilder();
                foreach (var (top, line) in page)
                {
                    Draw(content, line, Left(physical), _top + top);
                }

                kids.Add(WritePage(tree, resources, content));
            }

            var firstOfChapter = new int[chapters.Count];
            for (var index = 0; index < body.Count; index++)
            {
                physical++;
                var page = body[index];
                var blocks = chapters[page.Chapter];
                var left = Left(physical);
                var content = new StringBuilder();
                var y = _top + (page.OpensChapter ? set.ChapterSink : 0);
                for (var slice = 0; slice < page.Slices.Count; slice++)
                {
                    var (block, from, to) = (page.Slices[slice].Block, page.Slices[slice].From, page.Slices[slice].To);
                    // The space before a block is dropped when it opens the page.
                    if (slice > 0 && from == 0)
                    {
                        y += blocks[block].SpaceBefore;
                    }

                    for (var line = from; line < to; line++)
                    {
                        Draw(content, blocks[block].Lines[line], left, y);
                        y += blocks[block].Lines[line].Height;
                    }
                }

                if (page.Notes.Count > 0)
                {
                    var notesHeight = set.NoteLine + page.Notes.Sum(note => Enumerable.Range(note.From, note.To - note.From).Sum(line => note.Note.Lines[line].Height));
                    var top = _top + set.TextHeight - notesHeight;
                    Draw(content, new SetLine(set.NoteLine, [new RuleMark(0, set.NoteLine / 2, set.TextWidth * 0.3, 0.4, Ink.Faint)]), left, top);
                    top += set.NoteLine;
                    foreach (var note in page.Notes)
                    {
                        for (var line = note.From; line < note.To; line++)
                        {
                            Draw(content, note.Note.Lines[line], left, top);
                            top += note.Note.Lines[line].Height;
                        }
                    }
                }

                var number = (index + 1).ToString(CultureInfo.InvariantCulture);
                var numberWidth = fonts.Width(number, TextStyle.Plain, set.Size);
                var baseline = _height - (_bottom / 2) + (set.Size * 0.35);
                Glyphs(content, new GlyphsMark(0, 0, number, TextStyle.Plain, set.Size, Ink.Soft), left + ((set.TextWidth - numberWidth) / 2), _height - baseline);

                var id = WritePage(tree, resources, content);
                kids.Add(id);
                if (page.OpensChapter)
                {
                    firstOfChapter[page.Chapter] = id;
                }
            }

            fonts.WriteAll();
            var fontList = string.Join(' ', fonts.Resources.Select(font => $"/{font.Name} {font.Id} 0 R"));
            file.Object(resources, $"<< /Font << {fontList} >> /ProcSet [/PDF /Text] >>");
            file.Object(tree, string.Create(CultureInfo.InvariantCulture, $"<< /Type /Pages /Kids [{string.Join(' ', kids.Select(kid => $"{kid} 0 R"))}] /Count {kids.Count} /MediaBox [0 0 {PdfFile.Number(_width)} {PdfFile.Number(_height)}] >>"));
            WriteOutlines(outlines, firstOfChapter);
            var date = book.Date.UtcDateTime.ToString("'D:'yyyyMMddHHmmss'Z'", CultureInfo.InvariantCulture);
            var author = book.Author.Length > 0 ? $" /Author {PdfFile.Text(book.Author)}" : string.Empty;
            file.Object(info, $"<< /Title {PdfFile.Text(book.Title)}{author} /Producer (Rocinante) /CreationDate ({date}) >>");
            var outlineEntry = firstOfChapter.Length > 0 ? $" /Outlines {outlines} 0 R /PageMode /UseOutlines" : string.Empty;
            file.Object(catalog, $"<< /Type /Catalog /Pages {tree} 0 R{outlineEntry} /Lang (es-ES) /ViewerPreferences << /DisplayDocTitle true >> >>");
            file.Finish(catalog, info);

        }

        /// <summary>Odd pages are on the right: the inside margin on their left.</summary>
        private double Left(int physical) => physical % 2 == 1 ? _inside : _outside;

        private int WritePage(int tree, int resources, StringBuilder content)
        {
            var stream = file.Reserve();
            var page = file.Reserve();
            file.Stream(stream, string.Empty, Encoding.Latin1.GetBytes(content.ToString()));
            file.Object(page, $"<< /Type /Page /Parent {tree} 0 R /Resources {resources} 0 R /Contents {stream} 0 R >>");
            return page;
        }

        private void WriteOutlines(int outlines, int[] firstOfChapter)
        {
            if (firstOfChapter.Length == 0)
            {
                return;
            }

            var items = firstOfChapter.Select(_ => file.Reserve()).ToArray();
            for (var index = 0; index < items.Length; index++)
            {
                var previous = index > 0 ? $" /Prev {items[index - 1]} 0 R" : string.Empty;
                var next = index < items.Length - 1 ? $" /Next {items[index + 1]} 0 R" : string.Empty;
                var title = PdfFile.Text(MarkdownWriter.TitleOf(book.Chapters[index], index));
                file.Object(items[index], $"<< /Title {title} /Parent {outlines} 0 R{previous}{next} /Dest [{firstOfChapter[index]} 0 R /XYZ null null null] >>");
            }

            file.Object(outlines, string.Create(CultureInfo.InvariantCulture, $"<< /Type /Outlines /First {items[0]} 0 R /Last {items[^1]} 0 R /Count {items.Length} >>"));
        }

        private void Draw(StringBuilder content, SetLine line, double left, double top)
        {
            foreach (var mark in line.Marks)
            {
                switch (mark)
                {
                    case GlyphsMark glyphs:
                        Glyphs(content, glyphs, left + glyphs.X, _height - (top + glyphs.Baseline));
                        break;
                    case RuleMark rule:
                        content.Append(CultureInfo.InvariantCulture, $"{Colour(rule.Ink)} rg {N(left + rule.X)} {N(_height - (top + rule.Y) - (rule.Thickness / 2))} {N(rule.Width)} {N(rule.Thickness)} re f\n");
                        break;
                    case FleuronMark fleuron:
                        Fleuron(content, left + fleuron.CenterX, _height - (top + fleuron.CenterY), fleuron.Width);
                        break;
                    default:
                        break;
                }
            }
        }

        private void Glyphs(StringBuilder content, GlyphsMark glyphs, double x, double y) =>
            content.Append(CultureInfo.InvariantCulture, $"BT {Colour(glyphs.Ink)} rg 1 0 0 1 {N(x)} {N(y)} Tm {fonts.Show(glyphs.Text, glyphs.Style, glyphs.Size)}ET\n");

        /// <summary>The hedera of the scene breaks, the same as in the editor, drawn from its 30 × 24 outline.</summary>
        private static void Fleuron(StringBuilder content, double centreX, double centreY, double width)
        {
            var scale = width / 30;
            content.Append(CultureInfo.InvariantCulture, $"q {Colour(Ink.Faint)} rg {Colour(Ink.Faint)} RG {N(scale)} 0 0 {N(-scale)} {N(centreX - (15 * scale))} {N(centreY + (12 * scale))} cm\n");
            content.Append("6 12 m 9.2 5.6 15.6 3 23 4.4 c 21.6 6 20.8 8 20.8 12 c 20.8 16 21.6 18 23 19.6 c 15.6 21 9.2 18.4 6 12 c h f\n");
            content.Append("1.1 w 1 J 6 12 m 4.6 12 3 11.2 2.4 9.6 c 1.9 8.3 2.6 7 3.8 7 c 4.8 7 5.4 7.8 5.1 8.6 c S\nQ\n");
        }

        private static string Colour(Ink ink) => ink switch
        {
            Ink.Soft => "0.373 0.337 0.294",
            Ink.Faint => "0.549 0.506 0.451",
            Ink.Rubric => "0.608 0.173 0.141",
            _ => "0.169 0.149 0.125",
        };

        private static string N(double value) => PdfFile.Number(value);
    }
}
