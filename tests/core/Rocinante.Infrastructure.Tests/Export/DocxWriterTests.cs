using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using Rocinante.Domain.Books;
using Rocinante.Domain.Formats;
using Rocinante.Infrastructure.Export;

namespace Rocinante.Infrastructure.Tests.Export;

public sealed class DocxWriterTests
{
    private static readonly XNamespace _w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    private static ZipArchive Open(Book book, List<int>? progress = null) =>
        new(new MemoryStream(SampleBooks.Write(new DocxWriter(), book, progress)), ZipArchiveMode.Read);

    private static XDocument Part(ZipArchive zip, string name)
    {
        using var reader = new StreamReader(zip.GetEntry(name).ShouldNotBeNull(name).Open(), Encoding.UTF8);
        return XDocument.Parse(reader.ReadToEnd());
    }

    private static string Text(XElement element) => string.Concat(element.Descendants(_w + "t").Select(text => text.Value));

    [Fact]
    public void Every_part_is_there_and_well_formed()
    {
        var progress = new List<int>();
        using var zip = Open(SampleBooks.Quixote(), progress);

        foreach (var name in new[]
        {
            "[Content_Types].xml", "_rels/.rels", "word/_rels/document.xml.rels", "word/document.xml", "word/styles.xml",
            "word/settings.xml", "word/footnotes.xml", "word/numbering.xml", "word/footer1.xml", "docProps/core.xml",
        })
        {
            Part(zip, name).Root.ShouldNotBeNull(name);
        }

        Part(zip, "docProps/core.xml").Root!.ToString().ShouldContain("Miguel de Cervantes");
        Part(zip, "word/settings.xml").Root!.Element(_w + "updateFields").ShouldNotBeNull();
        Part(zip, "word/settings.xml").Root!.Element(_w + "mirrorMargins").ShouldNotBeNull();
        progress.ShouldBe([1, 2]);
    }

    [Fact]
    public void Each_chapter_is_a_section_of_the_page_and_margins_of_the_work_with_its_title_as_a_heading()
    {
        var format = WorkFormat.Default;
        using var zip = Open(SampleBooks.Quixote());
        var body = Part(zip, "word/document.xml").Root!.Element(_w + "body")!;

        var sections = body.Descendants(_w + "sectPr").ToList();
        sections.Count.ShouldBe(3, "the front matter and each chapter");
        foreach (var section in sections)
        {
            section.Element(_w + "pgSz")!.Attribute(_w + "w")!.Value.ShouldBe(DocxWriter.Twips(format.PageWidth).ToString(System.Globalization.CultureInfo.InvariantCulture));
            section.Element(_w + "pgMar")!.Attribute(_w + "left")!.Value.ShouldBe(DocxWriter.Twips(format.Margins.Inside).ToString(System.Globalization.CultureInfo.InvariantCulture));
        }

        sections[0].Element(_w + "footerReference").ShouldBeNull();
        sections[1].Element(_w + "footerReference").ShouldNotBeNull();
        sections[1].Element(_w + "pgNumType")!.Attribute(_w + "start")!.Value.ShouldBe("1");
        body.Elements().Last().Name.ShouldBe(_w + "sectPr");

        var headings = body.Elements(_w + "p")
            .Where(paragraph => paragraph.Descendants(_w + "pStyle").Any(style => style.Attribute(_w + "val")!.Value == "Heading1"))
            .Select(Text)
            .ToList();
        headings.ShouldBe(["Capítulo primero", "Capítulo 2"]);
    }

    [Fact]
    public void Keeps_the_styles_the_lists_the_scene_breaks_and_real_footnotes()
    {
        using var zip = Open(SampleBooks.Quixote());
        var body = Part(zip, "word/document.xml").Root!.Element(_w + "body")!;
        var text = body.ToString();

        Text(body).ShouldContain("En un lugar de la Mancha, de cuyo nombre no quiero acordarme.");
        text.ShouldContain("<w:i />");
        text.ShouldContain("<w:b />");
        text.ShouldContain("<w:u w:val=\"single\" />");
        Text(body).ShouldContain("un rocín & más.");
        Text(body).ShouldContain("Ñandú <ahí>.");
        text.ShouldContain("❦");
        body.Descendants(_w + "numPr").Count().ShouldBe(3);
        body.Descendants(_w + "footnoteReference").Select(reference => reference.Attribute(_w + "id")!.Value).ShouldBe(["1", "2"]);

        var notes = Part(zip, "word/footnotes.xml").Root!.Elements(_w + "footnote").ToList();
        notes.Select(note => note.Attribute(_w + "id")!.Value).ShouldBe(["-1", "0", "1", "2"]);
        Text(notes[2]).ShouldBe(" Una región de España.");
        Part(zip, "word/numbering.xml").Root!.Elements(_w + "num").Count().ShouldBe(2);
    }

    [Fact]
    public void The_front_matter_carries_the_cover_the_credits_and_a_contents_field_or_nothing()
    {
        using (var zip = Open(SampleBooks.Quixote()))
        {
            var body = Part(zip, "word/document.xml").Root!.Element(_w + "body")!;
            Text(body).ShouldStartWith("El ingenioso hidalgoMiguel de Cervantes© 1605 Miguel de Cervantes.Primera edición.ÍndiceCapítulo primeroCapítulo 2");
            body.Descendants(_w + "instrText").First().Value.ShouldContain("TOC");
        }

        using (var bare = Open(SampleBooks.Quixote(new ExportParts(false, false, false))))
        {
            var body = Part(bare, "word/document.xml").Root!.Element(_w + "body")!;
            Text(body).ShouldStartWith("Capítulo primero");
            body.Descendants(_w + "sectPr").Count().ShouldBe(2);
        }
    }
}
