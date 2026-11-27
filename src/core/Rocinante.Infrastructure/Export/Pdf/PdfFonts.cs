using System.Globalization;
using System.Text;
using Rocinante.Domain.Books;
using Rocinante.Domain.Formats;
using Rocinante.Infrastructure.Export.Fonts;

namespace Rocinante.Infrastructure.Export.Pdf;

/// <summary>
/// The fonts a PDF uses, each embedded whole as TrueType with Identity-H encoding: a code is a glyph. They are
/// named as they are first used and written at the end, with the widths and the Unicode of the glyphs used, so
/// the text can be searched and copied.
/// </summary>
internal sealed class PdfFonts(PdfFile file, Typeface typeface)
{
    private readonly Dictionary<(TextStyle, FontSubset), Used> _used = [];

    /// <summary>The resource names of the fonts used, for the pages that use them.</summary>
    public IEnumerable<(string Name, int Id)> Resources => _used.Values.Select(used => (used.Name, used.Id));

    public FontFace Face(TextStyle style) => BookFonts.Face(typeface, style);

    /// <summary>
    /// The width of a text in points, at a size, letter by letter in the subset that has each letter.
    /// </summary>
    public double Width(string text, TextStyle style, double size)
    {
        var face = Face(style);
        var width = 0.0;
        foreach (var rune in text.EnumerateRunes())
        {
            var (font, _) = face.For(rune.Value);
            width += font.AdvanceOf(font.GlyphOf(rune.Value) ?? 0) * size / font.UnitsPerEm;
        }

        return width;
    }

    /// <summary>
    /// The operators that show a text at the current point: one <c>Tf</c> and <c>Tj</c> for each run of letters
    /// of the same subset.
    /// </summary>
    public string Show(string text, TextStyle style, double size)
    {
        var face = Face(style);
        var operators = new StringBuilder();
        Used? current = null;
        var hex = new StringBuilder();

        void Flush()
        {
            if (current is not null && hex.Length > 0)
            {
                operators.Append(CultureInfo.InvariantCulture, $"/{current.Name} {PdfFile.Number(size)} Tf <{hex}> Tj ");
                hex.Clear();
            }
        }

        foreach (var rune in text.EnumerateRunes())
        {
            var (font, subset) = face.For(rune.Value);
            var used = Use(face.Style, subset, font);
            if (used != current)
            {
                Flush();
                current = used;
            }

            var glyph = font.GlyphOf(rune.Value) ?? 0;
            used.Glyphs[glyph] = rune.Value;
            hex.Append(glyph.ToString("X4", CultureInfo.InvariantCulture));
        }

        Flush();
        return operators.ToString();
    }

    /// <summary>Writes every font used, with its descriptor, its widths and its map back to Unicode.</summary>
    public void WriteAll()
    {
        foreach (var used in _used.Values)
        {
            var font = used.Font;
            double Scale(int units) => units * 1000.0 / font.UnitsPerEm;
            var name = $"{font.PostScriptName}";
            var descendant = file.Reserve();
            var descriptor = file.Reserve();
            var program = file.Reserve();
            var unicode = file.Reserve();

            file.Object(used.Id, $"<< /Type /Font /Subtype /Type0 /BaseFont /{name} /Encoding /Identity-H /DescendantFonts [{descendant} 0 R] /ToUnicode {unicode} 0 R >>");

            var widths = new StringBuilder();
            foreach (var glyph in used.Glyphs.Keys.Order())
            {
                widths.Append(CultureInfo.InvariantCulture, $"{glyph} [{PdfFile.Number(Scale(font.AdvanceOf(glyph)))}] ");
            }

            file.Object(descendant, $"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /{name} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor {descriptor} 0 R /DW 0 /W [{widths}] /CIDToGIDMap /Identity >>");

            var box = font.BoundingBox;
            var flags = 32 | (used.Style.HasFlag(TextStyle.Italic) ? 64 : 0) | (typeface == Typeface.CourierPrime ? 1 : 0) | 2;
            file.Object(descriptor, string.Create(
                CultureInfo.InvariantCulture,
                $"<< /Type /FontDescriptor /FontName /{name} /Flags {flags} /FontBBox [{PdfFile.Number(Scale(box.XMin))} {PdfFile.Number(Scale(box.YMin))} {PdfFile.Number(Scale(box.XMax))} {PdfFile.Number(Scale(box.YMax))}] /ItalicAngle {PdfFile.Number(font.ItalicAngle)} /Ascent {PdfFile.Number(Scale(font.Ascent))} /Descent {PdfFile.Number(Scale(font.Descent))} /CapHeight {PdfFile.Number(Scale(font.CapHeight))} /StemV {(used.Style.HasFlag(TextStyle.Bold) ? 140 : 80)} /FontFile2 {program} 0 R >>"));
            file.Stream(program, string.Create(CultureInfo.InvariantCulture, $"/Length1 {font.Data.Length}"), font.Data);
            file.Stream(unicode, string.Empty, Encoding.ASCII.GetBytes(ToUnicode(used.Glyphs)));
        }
    }

    private Used Use(TextStyle style, FontSubset subset, TrueTypeFont font)
    {
        if (!_used.TryGetValue((style, subset), out var used))
        {
            used = new Used($"F{_used.Count + 1}", file.Reserve(), font, style);
            _used[(style, subset)] = used;
        }

        return used;
    }

    private static string ToUnicode(SortedDictionary<ushort, int> glyphs)
    {
        var map = new StringBuilder();
        map.Append("/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n");
        map.Append("/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n");
        map.Append("1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n");
        foreach (var chunk in glyphs.Chunk(100))
        {
            map.Append(CultureInfo.InvariantCulture, $"{chunk.Length} beginbfchar\n");
            foreach (var (glyph, character) in chunk)
            {
                var utf16 = Encoding.BigEndianUnicode.GetBytes(char.ConvertFromUtf32(character));
                map.Append(CultureInfo.InvariantCulture, $"<{glyph:X4}> <{Convert.ToHexString(utf16)}>\n");
            }

            map.Append("endbfchar\n");
        }

        map.Append("endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend\n");
        return map.ToString();
    }

    private sealed class Used(string name, int id, TrueTypeFont font, TextStyle style)
    {
        public string Name { get; } = name;

        public int Id { get; } = id;

        public TrueTypeFont Font { get; } = font;

        public TextStyle Style { get; } = style;

        /// <summary>The glyphs shown, with the character each stands for.</summary>
        public SortedDictionary<ushort, int> Glyphs { get; } = [];
    }
}
