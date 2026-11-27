using System.Globalization;
using System.Text;
using Rocinante.Domain.Books;
using Rocinante.Domain.Formats;

namespace Rocinante.Infrastructure.Export.Pdf;

/// <summary>The inks of the page, those of the paper theme.</summary>
internal enum Ink
{
    Text,
    Soft,
    Faint,
    Rubric,
}

/// <summary>Something drawn on a line, placed from the left of the text and the top of the line.</summary>
internal abstract record Mark;

internal sealed record GlyphsMark(double X, double Baseline, string Text, TextStyle Style, double Size, Ink Ink) : Mark;

internal sealed record RuleMark(double X, double Y, double Width, double Thickness, Ink Ink) : Mark;

internal sealed record FleuronMark(double CenterX, double CenterY, double Width) : Mark;

/// <summary>A line of a block: its height (with the space after it, if it closes the block) and what it draws.</summary>
internal sealed record SetLine(double Height, IReadOnlyList<Mark> Marks);

internal sealed record SetFootnote(int Line, int Number, IReadOnlyList<SetLine> Lines);

/// <summary>A block as the paginator needs it, like <c>MeasuredBlock</c> in the page view.</summary>
internal sealed record SetBlock(double SpaceBefore, IReadOnlyList<SetLine> Lines, bool Unbreakable, bool KeepWithNext, IReadOnlyList<SetFootnote> Footnotes);

/// <summary>
/// Sets the text of the book in lines, at the size and the width of the work, as the page view does: paragraphs
/// broken greedily and justified by their spaces, the first line indented when it follows another paragraph,
/// the drop cap, the titles in small capitals, the quotes, the lists, the scene breaks and the footnotes.
/// </summary>
internal sealed class Typesetter
{
    private const double PointsPerMillimetre = 72 / 25.4;

    private readonly PdfFonts _fonts;
    private readonly WorkFormat _format;
    private readonly Dictionary<(TextStyle, double), double> _spaces = [];

    public Typesetter(PdfFonts fonts, WorkFormat format)
    {
        _fonts = fonts;
        _format = format;
        Size = format.BodySize;
        Line = Size * format.Leading;
        TextWidth = Points(format.PageWidth - format.Margins.Inside - format.Margins.Outside);
        TextHeight = Points(format.PageHeight - format.Margins.Top - format.Margins.Bottom);
        NoteSize = Size * 0.8;
        NoteLine = NoteSize * 1.3;
    }

    public double Size { get; }

    public double Line { get; }

    public double TextWidth { get; }

    public double TextHeight { get; }

    public double NoteSize { get; }

    public double NoteLine { get; }

    /// <summary>How far down the first page of a chapter its title starts.</summary>
    public double ChapterSink => TextHeight * 0.25;

    public static double Points(double millimetres) => millimetres * PointsPerMillimetre;

    public IReadOnlyList<SetBlock> Chapter(BookChapter chapter, string title)
    {
        var blocks = new List<SetBlock>
        {
            Title(title, Size * 1.58, 1.25, TextStyle.Plain, smallCaps: true, spaceBefore: 0, spaceAfter: Size * 1.58 * 2.5),
        };
        foreach (var block in chapter.Blocks)
        {
            blocks.AddRange(Block(block, 0, Ink.Text, quoted: false));
        }

        return blocks;
    }

    /// <summary>Centred lines, as on the cover or at the head of a chapter.</summary>
    public SetBlock Title(string text, double size, double leading, TextStyle style, bool smallCaps, double spaceBefore, double spaceAfter, Ink ink = Ink.Text)
    {
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Select(word => new Word([.. SmallCaps(word, style, size, ink, smallCaps)]))
            .ToList();
        var lines = Break(words, _ => TextWidth, style, size).ToList();
        var height = size * leading;
        var set = lines.Select((line, index) => new SetLine(
            height + (index == lines.Count - 1 ? spaceAfter : 0),
            [.. Place(line, TextWidth, height, size, justify: false, centre: true, offset: 0)])).ToList();
        return new SetBlock(spaceBefore, set, Unbreakable: true, KeepWithNext: true, []);
    }

    private IEnumerable<SetBlock> Block(BookBlock block, double left, Ink ink, bool quoted)
    {
        switch (block)
        {
            case BookParagraph paragraph:
                yield return Paragraph(paragraph, left, ink);
                break;
            case BookHeading heading:
                var (size, style, caps) = heading.Level switch
                {
                    1 => (Size * 1.58, TextStyle.Plain, true),
                    2 => (Size * 1.26, TextStyle.Plain, false),
                    _ => (Size, TextStyle.Italic, false),
                };
                var text = string.Concat(heading.Inlines.OfType<TextRun>().Select(run => run.Text)).Replace('\n', ' ');
                yield return Title(text, size, 1.25, style, caps, size * 1.5, size);
                break;
            case BookQuote quote:
                var first = true;
                foreach (var inner in quote.Blocks.SelectMany(inner => Block(inner, left + (Size * 1.5), Ink.Soft, quoted: true)))
                {
                    yield return first ? inner with { SpaceBefore = Math.Max(inner.SpaceBefore, Size * 0.8) } : inner;
                    first = false;
                }

                break;
            case BookList list:
                for (var index = 0; index < list.Items.Count; index++)
                {
                    var marker = list.Ordered ? string.Create(CultureInfo.InvariantCulture, $"{index + 1}.") : "•";
                    var item = list.Items[index].SelectMany(inner => Block(inner, left + (Size * 1.5), ink, quoted)).ToList();
                    for (var at = 0; at < item.Count; at++)
                    {
                        var set = item[at];
                        if (at == 0 && set.Lines.Count > 0)
                        {
                            var line = set.Lines[0];
                            var width = _fonts.Width(marker, TextStyle.Plain, Size);
                            var baseline = line.Marks.OfType<GlyphsMark>().FirstOrDefault()?.Baseline ?? Line * 0.75;
                            set = set with
                            {
                                Lines = [line with { Marks = [new GlyphsMark(left + (Size * 1.5) - width - (Size * 0.4), baseline, marker, TextStyle.Plain, Size, ink), .. line.Marks] }, .. set.Lines.Skip(1)],
                                SpaceBefore = index == 0 ? Size * 0.8 : 0,
                            };
                        }

                        yield return set;
                    }
                }

                break;
            case BookSceneBreak:
                yield return new SetBlock(Line, [new SetLine(Line * 2, [new FleuronMark(TextWidth / 2, Line / 2, Size * 1.4)])], Unbreakable: true, KeepWithNext: false, []);
                break;
            default:
                break;
        }
    }

    private SetBlock Paragraph(BookParagraph paragraph, double left, Ink ink)
    {
        left += paragraph.Indent * Size * 2;
        var words = Words(paragraph.Inlines, ink);
        var firstIndent = paragraph.Follows && _format.FirstLineIndent ? Size * 1.5 : 0;
        var spaceBefore = paragraph.Follows && !_format.FirstLineIndent ? Size * 0.6 : 0;

        // The drop cap: the first letter, three lines tall, and the first three lines beside it.
        GlyphsMark? drop = null;
        var dropWidth = 0.0;
        if (paragraph.Opens && _format.DropCap && words.Count > 0 && words[0].Pieces[0] is { } head && head.Text.Length > 0 && char.IsLetter(head.Text[0]))
        {
            var letter = head.Text[..1];
            var font = _fonts.Face(head.Style).Latin;
            var capRatio = (double)font.CapHeight / font.UnitsPerEm;
            var dropSize = ((2 * Line) + (capRatio * Size)) / capRatio;
            dropWidth = _fonts.Width(letter, head.Style, dropSize) + (Size * 0.08);
            var baseline = Baseline(Line, Size) + (2 * Line);
            drop = new GlyphsMark(left, baseline, letter, head.Style, dropSize, Ink.Rubric);
            var rest = head with { Text = head.Text[1..], Width = _fonts.Width(head.Text[1..], head.Style, head.Size) };
            words[0] = new Word([rest, .. words[0].Pieces.Skip(1)]);
            firstIndent = 0;
        }

        double WidthOf(int line) =>
            TextWidth - left - (line == 0 ? firstIndent : 0) - (drop is not null && line < 3 ? dropWidth : 0);

        var lines = Break(words, WidthOf, TextStyle.Plain, Size).ToList();
        var set = new List<SetLine>();
        var footnotes = new List<SetFootnote>();
        for (var index = 0; index < lines.Count; index++)
        {
            var offset = left + (index == 0 ? firstIndent : 0) + (drop is not null && index < 3 ? dropWidth : 0);
            var last = index == lines.Count - 1;
            var marks = Place(lines[index], WidthOf(index), Line, Size, _format.Justified && !last && !lines[index].Forced, centre: false, offset).ToList();
            if (index == 0 && drop is not null)
            {
                marks.Insert(0, drop);
            }

            set.Add(new SetLine(Line, marks));
            foreach (var call in lines[index].Words.SelectMany(word => word.Pieces).Select(piece => piece.Call).OfType<FootnoteCall>())
            {
                footnotes.Add(new SetFootnote(index, call.Number, Note(call)));
            }
        }

        // A paragraph shorter than its drop cap still makes room for it.
        while (drop is not null && set.Count < 3)
        {
            set.Add(new SetLine(Line, []));
        }

        return new SetBlock(spaceBefore, set, Unbreakable: false, KeepWithNext: false, footnotes);
    }

    /// <summary>The lines of a footnote, at the foot of the page: its number and its text.</summary>
    public IReadOnlyList<SetLine> Note(FootnoteCall call)
    {
        var number = new Piece(string.Create(CultureInfo.InvariantCulture, $"{call.Number}."), TextStyle.Plain, NoteSize, _fonts.Width(string.Create(CultureInfo.InvariantCulture, $"{call.Number}."), TextStyle.Plain, NoteSize), 0, Ink.Rubric, null);
        var words = new List<Word> { new([number]) };
        words.AddRange(call.Text.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(word => new Word([Make(word, TextStyle.Plain, NoteSize, Ink.Text)])));
        return [.. Break(words, _ => TextWidth, TextStyle.Plain, NoteSize).Select(line => new SetLine(NoteLine, [.. Place(line, TextWidth, NoteLine, NoteSize, justify: false, centre: false, offset: 0)]))];
    }

    /// <summary>Lines of plain text aligned to the left, broken at the width of the page: the credits.</summary>
    public IReadOnlyList<SetLine> Plain(string text, double size, Ink ink)
    {
        var height = size * _format.Leading;
        var lines = new List<SetLine>();
        foreach (var paragraph in text.Split('\n'))
        {
            var words = paragraph.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(word => new Word([Make(word, TextStyle.Plain, size, ink)])).ToList();
            var broken = Break(words, _ => TextWidth, TextStyle.Plain, size).ToList();
            lines.AddRange(broken.Count == 0
                ? [new SetLine(height, [])]
                : broken.Select(line => new SetLine(height, [.. Place(line, TextWidth, height, size, justify: false, centre: false, offset: 0)])));
        }

        return lines;
    }

    /// <summary>A line of the contents: the title of a chapter on the left, its page on the right.</summary>
    public SetLine ContentsLine(string title, string page)
    {
        var height = Line * 1.2;
        var baseline = Baseline(height, Size);
        var pageWidth = _fonts.Width(page, TextStyle.Plain, Size);
        var room = TextWidth - pageWidth - (Size * 2);
        var shown = title;
        while (shown.Length > 1 && _fonts.Width(shown, TextStyle.Plain, Size) > room)
        {
            shown = shown[..^2].TrimEnd() + "…";
        }

        return new SetLine(height, [
            new GlyphsMark(0, baseline, shown, TextStyle.Plain, Size, Ink.Text),
            new GlyphsMark(TextWidth - pageWidth, baseline, page, TextStyle.Plain, Size, Ink.Soft),
        ]);
    }

    /// <summary>Where the baseline of a line goes: centred in the line, as CSS does with the leading.</summary>
    public double Baseline(double height, double size)
    {
        var font = _fonts.Face(TextStyle.Plain).Latin;
        var ascent = (double)font.Ascent / font.UnitsPerEm * size;
        var descent = (double)-font.Descent / font.UnitsPerEm * size;
        return ((height - (ascent + descent)) / 2) + ascent;
    }

    private Piece Make(string text, TextStyle style, double size, Ink ink) =>
        new(text, style, size, _fonts.Width(text, style, size), 0, ink, null);

    /// <summary>The words of a paragraph: what goes between spaces, each in pieces of one style.</summary>
    private List<Word> Words(IReadOnlyList<BookInline> inlines, Ink ink)
    {
        var words = new List<Word>();
        var current = new List<Piece>();

        void End(bool forced = false)
        {
            if (current.Count > 0)
            {
                words.Add(new Word([.. current]));
                current = [];
            }

            if (forced)
            {
                words.Add(Word.Break);
            }
        }

        foreach (var inline in inlines)
        {
            switch (inline)
            {
                case TextRun run:
                    var parts = run.Text.Split(' ');
                    for (var index = 0; index < parts.Length; index++)
                    {
                        if (index > 0)
                        {
                            End();
                        }

                        if (parts[index].Length > 0)
                        {
                            current.Add(Make(parts[index], run.Style, Size, ink));
                        }
                    }

                    break;
                case LineBreak:
                    End(forced: true);
                    break;
                case FootnoteCall call:
                    var number = call.Number.ToString(CultureInfo.InvariantCulture);
                    var size = Size * 0.65;
                    current.Add(new Piece(number, TextStyle.Plain, size, _fonts.Width(number, TextStyle.Plain, size) + (Size * 0.05), Size * 0.35, Ink.Rubric, call));
                    break;
                default:
                    break;
            }
        }

        End();
        return words;
    }

    /// <summary>Lowercase letters as capitals a size smaller, for titles in small capitals.</summary>
    private IEnumerable<Piece> SmallCaps(string word, TextStyle style, double size, Ink ink, bool smallCaps)
    {
        if (!smallCaps)
        {
            yield return Make(word, style, size, ink);
            yield break;
        }

        var run = new StringBuilder();
        bool? lower = null;
        foreach (var character in word)
        {
            var isLower = char.IsLower(character);
            if (lower is not null && isLower != lower && run.Length > 0)
            {
                yield return Make(lower.Value ? run.ToString().ToUpper(CultureInfo.GetCultureInfo("es")) : run.ToString(), style, lower.Value ? size * 0.78 : size, ink);
                run.Clear();
            }

            lower = isLower;
            run.Append(character);
        }

        if (run.Length > 0)
        {
            yield return Make(lower == true ? run.ToString().ToUpper(CultureInfo.GetCultureInfo("es")) : run.ToString(), style, lower == true ? size * 0.78 : size, ink);
        }
    }

    /// <summary>Greedy line breaking: as many words as fit, a forced break ends a line.</summary>
    private IEnumerable<BrokenLine> Break(List<Word> words, Func<int, double> widthOf, TextStyle style, double size)
    {
        var line = new List<Word>();
        var width = 0.0;
        var count = 0;
        foreach (var word in words)
        {
            if (ReferenceEquals(word, Word.Break))
            {
                yield return new BrokenLine([.. line], Forced: true);
                count++;
                line.Clear();
                width = 0;
                continue;
            }

            var space = line.Count > 0 ? SpaceOf(line[^1].Pieces[^1].Style, size) : 0;
            if (line.Count > 0 && width + space + word.Width > widthOf(count))
            {
                yield return new BrokenLine([.. line], Forced: false);
                count++;
                line.Clear();
                width = 0;
                space = 0;
            }

            line.Add(word);
            width += space + word.Width;
        }

        if (line.Count > 0)
        {
            yield return new BrokenLine([.. line], Forced: false);
        }
    }

    /// <summary>The marks of a line, its words placed with their spaces, stretched if justified.</summary>
    private IEnumerable<Mark> Place(BrokenLine line, double width, double height, double size, bool justify, bool centre, double offset)
    {
        if (line.Words.Count == 0)
        {
            yield break;
        }

        var spaces = line.Words.Skip(1).Select((word, index) => SpaceOf(line.Words[index].Pieces[^1].Style, size)).ToList();
        var natural = line.Words.Sum(word => word.Width) + spaces.Sum();
        var extra = justify && spaces.Count > 0 ? Math.Max(0, (width - natural) / spaces.Count) : 0;
        var x = offset + (centre ? Math.Max(0, (width - natural) / 2) : 0);
        var baseline = Baseline(height, size);

        for (var index = 0; index < line.Words.Count; index++)
        {
            if (index > 0)
            {
                var gap = spaces[index - 1] + extra;
                var before = line.Words[index - 1].Pieces[^1];
                var after = line.Words[index].Pieces[0];
                if (before.Style.HasFlag(TextStyle.Underline) && after.Style.HasFlag(TextStyle.Underline))
                {
                    yield return Underline(x, baseline, gap, before.Size, before.Ink);
                }

                x += gap;
            }

            foreach (var piece in line.Words[index].Pieces)
            {
                if (piece.Text.Length > 0)
                {
                    yield return new GlyphsMark(x, baseline - piece.Rise, piece.Text, piece.Style, piece.Size, piece.Ink);
                    if (piece.Style.HasFlag(TextStyle.Underline))
                    {
                        yield return Underline(x, baseline, piece.Width, piece.Size, piece.Ink);
                    }
                }

                x += piece.Width;
            }
        }
    }

    private static RuleMark Underline(double x, double baseline, double width, double size, Ink ink) =>
        new(x, baseline + (size * 0.12), width, size * 0.05, ink);

    private double SpaceOf(TextStyle style, double size)
    {
        var key = (style & (TextStyle.Bold | TextStyle.Italic), size);
        if (!_spaces.TryGetValue(key, out var width))
        {
            width = _fonts.Width(" ", key.Item1, size);
            _spaces[key] = width;
        }

        return width;
    }

    /// <summary>A piece of a word in one style; <see cref="Call"/> marks the call of a footnote.</summary>
    private sealed record Piece(string Text, TextStyle Style, double Size, double Width, double Rise, Ink Ink, FootnoteCall? Call);

    private sealed record Word(IReadOnlyList<Piece> Pieces)
    {
        public static Word Break { get; } = new([]);

        public double Width { get; } = Pieces.Sum(piece => piece.Width);
    }

    private sealed record BrokenLine(IReadOnlyList<Word> Words, bool Forced);
}
