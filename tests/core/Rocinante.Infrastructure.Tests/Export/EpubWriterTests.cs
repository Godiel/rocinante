using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using Rocinante.Domain.Books;
using Rocinante.Infrastructure.Export;

namespace Rocinante.Infrastructure.Tests.Export;

public sealed class EpubWriterTests
{
    private static readonly XNamespace _opf = "http://www.idpf.org/2007/opf";
    private static readonly XNamespace _xhtml = "http://www.w3.org/1999/xhtml";

    private static ZipArchive Open(byte[] epub) => new(new MemoryStream(epub), ZipArchiveMode.Read);

    private static string Text(ZipArchive zip, string name)
    {
        using var reader = new StreamReader(zip.GetEntry(name).ShouldNotBeNull($"{name} is in the book").Open(), Encoding.UTF8);
        return reader.ReadToEnd();
    }

    [Fact]
    public void Starts_with_the_mimetype_stored_as_EPUB_asks()
    {
        var epub = SampleBooks.Write(new EpubWriter(), SampleBooks.Quixote());

        Encoding.ASCII.GetString(epub, 0, 4).ShouldBe("PK\u0003\u0004");
        BitConverter.ToUInt16(epub, 8).ShouldBe((ushort)0, "stored, not compressed");
        BitConverter.ToUInt16(epub, 28).ShouldBe((ushort)0, "no extra field");
        Encoding.ASCII.GetString(epub, 30, 8).ShouldBe("mimetype");
        Encoding.ASCII.GetString(epub, 38, 20).ShouldBe("application/epub+zip");
    }

    [Fact]
    public void Has_a_package_with_the_data_of_the_book_and_every_file_in_its_manifest()
    {
        var progress = new List<int>();
        using var zip = Open(SampleBooks.Write(new EpubWriter(), SampleBooks.Quixote(cover: new byte[] { 0xFF, 0xD8, 0xFF }), progress));

        XDocument.Parse(Text(zip, "META-INF/container.xml")).Root!.ToString().ShouldContain("OEBPS/content.opf");
        var package = XDocument.Parse(Text(zip, "OEBPS/content.opf")).Root!;
        package.Attribute("version")!.Value.ShouldBe("3.0");
        var metadata = package.Element(_opf + "metadata")!;
        metadata.ToString().ShouldContain("El ingenioso hidalgo");
        metadata.ToString().ShouldContain("Miguel de Cervantes");
        metadata.ToString().ShouldContain("urn:uuid:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b");
        metadata.ToString().ShouldContain("2026-11-26T10:00:00Z");

        var items = package.Element(_opf + "manifest")!.Elements(_opf + "item").ToList();
        foreach (var item in items)
        {
            zip.GetEntry("OEBPS/" + item.Attribute("href")!.Value).ShouldNotBeNull(item.Attribute("href")!.Value);
        }

        items.Single(item => item.Attribute("properties")?.Value == "nav").Attribute("href")!.Value.ShouldBe("nav.xhtml");
        items.Single(item => item.Attribute("properties")?.Value == "cover-image").Attribute("media-type")!.Value.ShouldBe("image/jpeg");
        items.Count(item => item.Attribute("media-type")!.Value == "font/woff").ShouldBe(8);
        package.Element(_opf + "spine")!.Elements().Select(item => item.Attribute("idref")!.Value)
            .ShouldBe(["cover", "title", "credits", "nav", "chapter-1", "chapter-2"]);
        progress.ShouldBe([1, 2]);
    }

    [Fact]
    public void Each_chapter_is_well_formed_XHTML_with_its_footnotes_and_the_contents_link_to_them()
    {
        using var zip = Open(SampleBooks.Write(new EpubWriter(), SampleBooks.Quixote()));

        var first = XDocument.Parse(Text(zip, "OEBPS/chapter-1.xhtml"));
        var body = first.Root!.Element(_xhtml + "body")!.ToString();
        body.ShouldContain("Capítulo primero");
        body.ShouldContain("<em>Mancha</em>");
        body.ShouldContain("<strong>una lanza</strong>");
        body.ShouldContain("<u>un rocín</u>");
        body.ShouldContain("&amp; más.<br />Ñandú &lt;ahí&gt;.");
        body.ShouldContain("href=\"#nota-1\"");
        body.ShouldContain("Una región de España.");
        body.ShouldContain("<hr class=\"escena\" />");
        body.ShouldContain("<blockquote>");
        body.ShouldContain("<ol>");
        body.ShouldContain("class=\"sigue\"");
        XDocument.Parse(Text(zip, "OEBPS/chapter-2.xhtml")).Root!.ToString().ShouldContain("Capítulo 2");

        var navigation = XDocument.Parse(Text(zip, "OEBPS/nav.xhtml")).Root!.ToString();
        navigation.ShouldContain("epub:type=\"toc\"");
        navigation.ShouldContain("href=\"chapter-2.xhtml\"");
        Text(zip, "OEBPS/styles/book.css").ShouldContain("font-family: \"EB Garamond\", serif;");
    }

    [Fact]
    public void Leaves_out_the_parts_the_writer_takes_away_but_keeps_the_navigation_the_reader_needs()
    {
        using var zip = Open(SampleBooks.Write(new EpubWriter(), SampleBooks.Quixote(new ExportParts(false, false, false), cover: new byte[] { 1 })));

        zip.GetEntry("OEBPS/title.xhtml").ShouldBeNull();
        zip.GetEntry("OEBPS/credits.xhtml").ShouldBeNull();
        zip.GetEntry("OEBPS/images/cover.jpg").ShouldBeNull();
        zip.GetEntry("OEBPS/nav.xhtml").ShouldNotBeNull();
        var spine = XDocument.Parse(Text(zip, "OEBPS/content.opf")).Root!.Element(_opf + "spine")!;
        spine.Elements().Select(item => item.Attribute("idref")!.Value).ShouldBe(["chapter-1", "chapter-2"]);
    }
}
