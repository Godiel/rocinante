using System.Diagnostics;
using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using Rocinante.Domain.Books;
using Rocinante.Domain.Formats;
using Rocinante.Infrastructure.Export;

namespace Rocinante.Infrastructure.Tests.Export;

public sealed partial class PdfWriterTests
{
    private static string Latin(byte[] pdf) => Encoding.Latin1.GetString(pdf);

    /// <summary>The content streams of the file, inflated, in order.</summary>
    private static List<string> Streams(byte[] pdf)
    {
        var text = Latin(pdf);
        var streams = new List<string>();
        foreach (Match match in StreamPattern().Matches(text))
        {
            var length = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
            var start = match.Index + match.Length;
            using var zlib = new ZLibStream(new MemoryStream(pdf, start, length), CompressionMode.Decompress);
            using var reader = new StreamReader(zlib, Encoding.Latin1);
            streams.Add(reader.ReadToEnd());
        }

        return streams;
    }

    [Fact]
    public void Is_a_PDF_whose_table_finds_every_object()
    {
        var progress = new List<int>();
        var pdf = SampleBooks.Write(new PdfWriter(), SampleBooks.Quixote(), progress);
        var text = Latin(pdf);

        text.ShouldStartWith("%PDF-1.7");
        text.TrimEnd().ShouldEndWith("%%EOF");
        var start = long.Parse(StartXref().Match(text).Groups[1].Value, CultureInfo.InvariantCulture);
        text[(int)start..].ShouldStartWith("xref");
        var entries = XrefEntry().Matches(text[(int)start..]);
        var id = 0;
        foreach (Match entry in entries)
        {
            var offset = int.Parse(entry.Groups[1].Value, CultureInfo.InvariantCulture);
            if (entry.Groups[2].Value == "n")
            {
                text[offset..].ShouldStartWith($"{id} 0 obj");
            }

            id++;
        }

        progress.ShouldBe([1, 2]);
    }

    [Fact]
    public void Has_the_front_matter_and_a_page_for_each_chapter_with_its_bookmark_and_its_data()
    {
        var text = Latin(SampleBooks.Write(new PdfWriter(), SampleBooks.Quixote()));

        PagesCount().Match(text).Groups[1].Value.ShouldBe("5", "cover, credits, contents and two chapters");
        text.ShouldContain("/FontFile2");
        text.ShouldContain("/Type /Outlines");
        text.ShouldContain("/Lang (es-ES)");
        text.ShouldContain(PdfText("El ingenioso hidalgo"));
        text.ShouldContain(PdfText("Miguel de Cervantes"));
        text.ShouldContain(PdfText("Capítulo primero"));

        var width = Math.Round(WorkFormat.Default.PageWidth * 72 / 25.4, 3).ToString("0.###", CultureInfo.InvariantCulture);
        text.ShouldContain($"/MediaBox [0 0 {width} ");
    }

    [Fact]
    public void Without_the_parts_it_only_has_the_chapters()
    {
        var text = Latin(SampleBooks.Write(new PdfWriter(), SampleBooks.Quixote(new ExportParts(false, false, false))));

        PagesCount().Match(text).Groups[1].Value.ShouldBe("2");
    }

    [Fact]
    public void Draws_the_text_with_the_fonts_it_embeds_and_maps_back_to_Unicode()
    {
        var streams = Streams(SampleBooks.Write(new PdfWriter(), SampleBooks.Quixote()));

        var unicode = string.Join('\n', streams.Where(stream => stream.Contains("beginbfchar", StringComparison.Ordinal)));
        unicode.ShouldContain("<00D1>", Case.Insensitive, "Ñ");
        unicode.ShouldContain("<00ED>", Case.Insensitive, "í");
        var pages = streams.Where(stream => stream.Contains(" Tj ", StringComparison.Ordinal)).ToList();
        pages.ShouldNotBeEmpty();
        pages.ShouldAllBe(page => page.Contains("BT", StringComparison.Ordinal));
        string.Join('\n', pages).ShouldContain(" re f", Case.Sensitive, "the underline and the rule of the notes");
    }

    [Fact]
    public void A_drop_cap_is_drawn_three_lines_tall_in_the_rubric()
    {
        var format = WorkFormat.Default with { };
        var dropping = WorkFormat.Create(
            format.PageSize, format.PageWidth, format.PageHeight, format.Margins, format.Typeface, format.BodySize, format.Leading,
            format.FirstLineIndent, format.Justified, dropCap: true);
        var streams = Streams(SampleBooks.Write(new PdfWriter(), SampleBooks.Quixote(format: dropping)));

        var sizes = string.Join('\n', streams).Split("Tf").Select(part => part.Split(' ', StringSplitOptions.RemoveEmptyEntries).LastOrDefault())
            .Select(value => double.TryParse(value, CultureInfo.InvariantCulture, out var size) ? size : 0);
        sizes.Max().ShouldBeGreaterThan(format.BodySize * 3);
    }

    [Fact]
    public void Sets_a_long_work_quickly_and_numbers_its_pages()
    {
        var book = SampleBooks.Long(chapters: 8, words: 20_000);
        var watch = Stopwatch.StartNew();
        var pdf = SampleBooks.Write(new PdfWriter(), book);
        watch.Stop();

        var pages = int.Parse(PagesCount().Match(Latin(pdf)).Groups[1].Value, CultureInfo.InvariantCulture);
        pages.ShouldBeGreaterThan(8 * 40);
        watch.Elapsed.ShouldBeLessThan(TimeSpan.FromSeconds(30));
    }

    private static string PdfText(string text) =>
        "<FEFF" + Convert.ToHexString(Encoding.BigEndianUnicode.GetBytes(text)) + ">";

    [GeneratedRegex(@"/Length (\d+) >>\nstream\n")]
    private static partial Regex StreamPattern();

    [GeneratedRegex(@"startxref\n(\d+)")]
    private static partial Regex StartXref();

    [GeneratedRegex(@"(\d{10}) \d{5} ([nf]) \n")]
    private static partial Regex XrefEntry();

    [GeneratedRegex(@"/Type /Pages /Kids \[[^\]]*\] /Count (\d+)")]
    private static partial Regex PagesCount();
}
