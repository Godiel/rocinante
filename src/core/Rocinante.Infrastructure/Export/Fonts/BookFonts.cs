using System.Collections.Concurrent;
using Rocinante.Domain.Books;
using Rocinante.Domain.Formats;

namespace Rocinante.Infrastructure.Export.Fonts;

/// <summary>The subset of a typeface a file covers: the Latin alphabet, or the rest of the European letters.</summary>
public enum FontSubset
{
    Latin,
    LatinExt,
}

/// <summary>One style of a typeface: its two subsets, the Latin one first.</summary>
public sealed class FontFace(Typeface typeface, TextStyle style, TrueTypeFont latin, TrueTypeFont latinExt)
{
    public Typeface Typeface { get; } = typeface;

    /// <summary>Only italic and bold count: underlining is drawn.</summary>
    public TextStyle Style { get; } = style;

    public TrueTypeFont Latin { get; } = latin;

    public TrueTypeFont LatinExt { get; } = latinExt;

    /// <summary>The font of the subset that has a character; the Latin one when neither has it.</summary>
    public (TrueTypeFont Font, FontSubset Subset) For(int character) =>
        Latin.Has(character) || !LatinExt.Has(character) ? (Latin, FontSubset.Latin) : (LatinExt, FontSubset.LatinExt);
}

/// <summary>
/// The typefaces of the work as they come with Rocinante: WOFF files from Fontsource, under the SIL Open Font
/// License, embedded in the core. Each style is read once and kept.
/// </summary>
public static class BookFonts
{
    private static readonly ConcurrentDictionary<(Typeface, TextStyle), FontFace> _faces = new();

    /// <summary>The Fontsource package of a typeface, as the files are named.</summary>
    public static string PackageOf(Typeface typeface) => typeface switch
    {
        Typeface.EbGaramond => "eb-garamond",
        Typeface.Literata => "literata",
        Typeface.CrimsonPro => "crimson-pro",
        Typeface.SourceSerif4 => "source-serif-4",
        Typeface.LibreBaskerville => "libre-baskerville",
        _ => "courier-prime",
    };

    /// <summary>The name of a typeface, as Word and the EPUB style sheet call it.</summary>
    public static string FamilyOf(Typeface typeface) => typeface switch
    {
        Typeface.EbGaramond => "EB Garamond",
        Typeface.Literata => "Literata",
        Typeface.CrimsonPro => "Crimson Pro",
        Typeface.SourceSerif4 => "Source Serif 4",
        Typeface.LibreBaskerville => "Libre Baskerville",
        _ => "Courier Prime",
    };

    /// <summary>The style of a typeface: regular, italic, bold or both. Underlining does not change the font.</summary>
    public static FontFace Face(Typeface typeface, TextStyle style)
    {
        var key = (typeface, style & (TextStyle.Bold | TextStyle.Italic));
        return _faces.GetOrAdd(key, static key => new FontFace(
            key.Item1,
            key.Item2,
            TrueTypeFont.FromWoff(Woff(key.Item1, key.Item2, FontSubset.Latin)),
            TrueTypeFont.FromWoff(Woff(key.Item1, key.Item2, FontSubset.LatinExt))));
    }

    /// <summary>The WOFF file of a style and subset, as it is embedded.</summary>
    public static byte[] Woff(Typeface typeface, TextStyle style, FontSubset subset)
    {
        var name = FileOf(typeface, style, subset);
        using var stream = typeof(BookFonts).Assembly.GetManifestResourceStream($"fonts/{name}")
            ?? throw new InvalidOperationException($"The font {name} is not embedded in the core.");
        using var copy = new MemoryStream();
        stream.CopyTo(copy);
        return copy.ToArray();
    }

    /// <summary>The name of the file of a style and subset: <c>eb-garamond-latin-ext-700-italic.woff</c>.</summary>
    public static string FileOf(Typeface typeface, TextStyle style, FontSubset subset) =>
        $"{PackageOf(typeface)}-{(subset == FontSubset.Latin ? "latin" : "latin-ext")}-{(style.HasFlag(TextStyle.Bold) ? 700 : 400)}-{(style.HasFlag(TextStyle.Italic) ? "italic" : "normal")}.woff";
}
