using Rocinante.Domain.Books;
using Rocinante.Domain.Formats;
using Rocinante.Infrastructure.Export.Fonts;

namespace Rocinante.Infrastructure.Tests.Export;

public sealed class BookFontsTests
{
    public static TheoryData<Typeface> Typefaces => [.. Enum.GetValues<Typeface>()];

    [Theory]
    [MemberData(nameof(Typefaces))]
    public void Every_style_of_every_typeface_comes_with_the_core_and_reads_as_TrueType(Typeface typeface)
    {
        foreach (var style in new[] { TextStyle.Plain, TextStyle.Italic, TextStyle.Bold, TextStyle.Bold | TextStyle.Italic })
        {
            var face = BookFonts.Face(typeface, style);

            face.Latin.UnitsPerEm.ShouldBeGreaterThan(0);
            face.Latin.Ascent.ShouldBeGreaterThan(0);
            face.Latin.Descent.ShouldBeLessThan(0);
            BitConverter.ToUInt32([.. face.Latin.Data.Take(4).Reverse()]).ShouldBe(0x00010000u);
            face.Latin.PostScriptName.ShouldNotBeNullOrWhiteSpace();
            if (style.HasFlag(TextStyle.Italic))
            {
                face.Latin.ItalicAngle.ShouldBeLessThanOrEqualTo(0);
            }
        }
    }

    [Theory]
    [MemberData(nameof(Typefaces))]
    public void The_letters_of_Spanish_are_in_the_latin_subset_and_the_rest_of_Europe_in_the_other(Typeface typeface)
    {
        var face = BookFonts.Face(typeface, TextStyle.Plain);

        foreach (var character in "ÁÉÍÓÚÜÑáéíóúüñ¿¡«»—“”‘’…".Select(character => (int)character))
        {
            face.For(character).Subset.ShouldBe(FontSubset.Latin, $"U+{character:X4}");
        }

        face.For('ő').Subset.ShouldBe(FontSubset.LatinExt);
        face.For('Ł').Font.Has('Ł').ShouldBeTrue();
        var space = face.Latin.GlyphOf(' ')!.Value;
        face.Latin.AdvanceOf(space).ShouldBeGreaterThan(0);
        face.Latin.AdvanceOf(face.Latin.GlyphOf('m')!.Value).ShouldBeGreaterThanOrEqualTo(face.Latin.AdvanceOf(space));
    }
}
