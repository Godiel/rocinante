using System.Globalization;
using System.IO.Compression;
using System.Text;
using Rocinante.Application.Ports;
using Rocinante.Domain.Books;
using Rocinante.Domain.Formats;
using Rocinante.Infrastructure.Export.Fonts;

namespace Rocinante.Infrastructure.Export;

/// <summary>
/// The book as Word (Office Open XML). The page, the margins (mirrored, inside and outside), the typeface, the
/// size, the leading, the indent and the justification of the work go into the styles; each chapter is a
/// section of its own, which starts a page and carries the page number at its foot. The footnotes are numbered
/// through the whole book: restarting them in each section is not read the same by Word and LibreOffice. The cover, the credits and the contents go first, in a section without numbers. The contents is a
/// field Word fills in with the page numbers when the file is opened.
/// </summary>
public sealed class DocxWriter : IBookWriter
{
    private const string Main = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private const string Relationships = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

    public ExportFormat Format => ExportFormat.Docx;

    public void Write(Book book, Stream output, Action<int> chapterDone)
    {
        ArgumentNullException.ThrowIfNull(book);
        ArgumentNullException.ThrowIfNull(chapterDone);

        var document = new Document(book);
        var body = document.Body(chapterDone);

        using var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);
        Add(zip, "[Content_Types].xml", """
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
              <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
              <Default Extension="xml" ContentType="application/xml"/>
              <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
              <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
              <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
              <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
              <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
              <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
              <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
            </Types>
            """);
        Add(zip, "_rels/.rels", $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rId1" Type="{Relationships}/officeDocument" Target="word/document.xml"/>
              <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
            </Relationships>
            """);
        Add(zip, "word/_rels/document.xml.rels", $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
              <Relationship Id="rIdStyles" Type="{Relationships}/styles" Target="styles.xml"/>
              <Relationship Id="rIdSettings" Type="{Relationships}/settings" Target="settings.xml"/>
              <Relationship Id="rIdFootnotes" Type="{Relationships}/footnotes" Target="footnotes.xml"/>
              <Relationship Id="rIdNumbering" Type="{Relationships}/numbering" Target="numbering.xml"/>
              <Relationship Id="rIdFooter" Type="{Relationships}/footer" Target="footer1.xml"/>
            </Relationships>
            """);
        Add(zip, "word/document.xml", $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:document xmlns:w="{Main}" xmlns:r="{Relationships}">
            <w:body>
            {body}
            </w:body>
            </w:document>
            """);
        Add(zip, "word/styles.xml", Styles(book.Format));
        Add(zip, "word/settings.xml", $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:settings xmlns:w="{Main}">
              <w:mirrorMargins/>
              <w:defaultTabStop w:val="708"/>
              <w:updateFields w:val="true"/>
              <w:footnotePr><w:footnote w:id="-1"/><w:footnote w:id="0"/></w:footnotePr>
              <w:compat><w:doNotExpandShiftReturn/><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>
            </w:settings>
            """);
        Add(zip, "word/footnotes.xml", document.Footnotes());
        Add(zip, "word/numbering.xml", document.Numbering());
        Add(zip, "word/footer1.xml", $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:ftr xmlns:w="{Main}" xmlns:r="{Relationships}">
              <w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
            </w:ftr>
            """);
        var creator = book.Author.Length > 0 ? $"<dc:creator>{Xml.Escape(book.Author)}</dc:creator>" : string.Empty;
        var created = book.Date.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
        Add(zip, "docProps/core.xml", $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
              <dc:title>{Xml.Escape(book.Title)}</dc:title>{creator}
              <dc:language>es-ES</dc:language>
              <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
            </cp:coreProperties>
            """);
    }

    /// <summary>Millimetres in twentieths of a point.</summary>
    internal static int Twips(double millimetres) => (int)Math.Round(millimetres / 25.4 * 1440);

    private static string Number(double value) => value.ToString("0", CultureInfo.InvariantCulture);

    private static string Styles(WorkFormat format)
    {
        var family = Xml.Escape(BookFonts.FamilyOf(format.Typeface));
        var size = format.BodySize;
        double Em(double em) => em * size * 20;
        var halfPoints = (int)Math.Round(size * 2);
        var line = Number(format.Leading * 240);
        var justify = format.Justified ? "both" : "left";
        var follows = format.FirstLineIndent
            ? $"""<w:ind w:firstLine="{Number(Em(1.5))}"/>"""
            : $"""<w:spacing w:before="{Number(Em(0.6))}"/>""";
        var textHeight = format.PageHeight - format.Margins.Top - format.Margins.Bottom;
        var sink = Number(Twips(textHeight * 0.25));
        string Size(double em) => Number(Math.Round(halfPoints * em));

        return $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:styles xmlns:w="{Main}">
              <w:docDefaults>
                <w:rPrDefault><w:rPr><w:rFonts w:ascii="{family}" w:hAnsi="{family}" w:cs="{family}" w:eastAsia="{family}"/><w:sz w:val="{halfPoints}"/><w:szCs w:val="{halfPoints}"/><w:lang w:val="es-ES"/></w:rPr></w:rPrDefault>
                <w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="{line}" w:lineRule="auto"/></w:pPr></w:pPrDefault>
              </w:docDefaults>
              <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:widowControl/><w:jc w:val="{justify}"/></w:pPr></w:style>
              <w:style w:type="paragraph" w:styleId="Texto"><w:name w:val="Texto"/><w:basedOn w:val="Normal"/><w:qFormat/></w:style>
              <w:style w:type="paragraph" w:styleId="TextoSigue"><w:name w:val="Texto que sigue"/><w:basedOn w:val="Texto"/><w:pPr>{follows}</w:pPr></w:style>
              <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Texto"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="{sink}" w:after="{Number(Em(2.5))}" w:line="300" w:lineRule="auto"/><w:jc w:val="center"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:smallCaps/><w:sz w:val="{Size(1.58)}"/><w:szCs w:val="{Size(1.58)}"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Texto"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="{Number(Em(1.5))}" w:after="{Number(Em(1))}" w:line="300" w:lineRule="auto"/><w:jc w:val="center"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:smallCaps/><w:sz w:val="{Size(1.58)}"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Texto"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="{Number(Em(1.5))}" w:after="{Number(Em(1))}" w:line="300" w:lineRule="auto"/><w:jc w:val="center"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:sz w:val="{Size(1.26)}"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:next w:val="Texto"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="{Number(Em(1.5))}" w:after="{Number(Em(1))}"/><w:jc w:val="center"/><w:outlineLvl w:val="3"/></w:pPr><w:rPr><w:i/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="Cita"><w:name w:val="Cita"/><w:basedOn w:val="Texto"/><w:pPr><w:spacing w:before="{Number(Em(0.4))}" w:after="{Number(Em(0.4))}"/><w:ind w:left="{Number(Em(1.5))}"/></w:pPr></w:style>
              <w:style w:type="paragraph" w:styleId="Lista"><w:name w:val="Lista"/><w:basedOn w:val="Texto"/><w:pPr><w:jc w:val="left"/></w:pPr></w:style>
              <w:style w:type="paragraph" w:styleId="Escena"><w:name w:val="Separador de escena"/><w:basedOn w:val="Normal"/><w:next w:val="Texto"/><w:pPr><w:keepNext/><w:spacing w:before="{Number(Em(format.Leading))}" w:after="{Number(Em(format.Leading))}"/><w:jc w:val="center"/></w:pPr></w:style>
              <w:style w:type="paragraph" w:styleId="Portada"><w:name w:val="Título de la obra"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="{sink}" w:after="{Number(Em(2))}" w:line="300" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr><w:rPr><w:smallCaps/><w:sz w:val="{Size(2)}"/><w:szCs w:val="{Size(2)}"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="Autor"><w:name w:val="Autor"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:sz w:val="{Size(1.2)}"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="Creditos"><w:name w:val="Créditos"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="{Size(0.85)}"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="TituloIndice"><w:name w:val="Título del índice"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="{sink}" w:after="{Number(Em(2))}"/><w:jc w:val="center"/></w:pPr><w:rPr><w:smallCaps/><w:sz w:val="{Size(1.58)}"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:basedOn w:val="Normal"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9000"/></w:tabs><w:spacing w:before="{Number(Em(0.3))}"/><w:jc w:val="left"/></w:pPr></w:style>
              <w:style w:type="paragraph" w:styleId="FootnoteText"><w:name w:val="footnote text"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr><w:rPr><w:sz w:val="{Size(0.8)}"/><w:szCs w:val="{Size(0.8)}"/></w:rPr></w:style>
              <w:style w:type="character" w:styleId="FootnoteReference"><w:name w:val="footnote reference"/><w:rPr><w:vertAlign w:val="superscript"/></w:rPr></w:style>
              <w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:jc w:val="center"/></w:pPr></w:style>
            </w:styles>
            """;
    }

    private static void Add(ZipArchive zip, string name, string text)
    {
        var entry = zip.CreateEntry(name, CompressionLevel.Optimal);
        entry.LastWriteTime = new DateTimeOffset(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);
        using var stream = entry.Open();
        stream.Write(new UTF8Encoding(false).GetBytes(text));
    }

    /// <summary>The body of the document, written once, with the footnotes and the lists it needs.</summary>
    private sealed class Document(Book book)
    {
        private readonly StringBuilder _footnotes = new();
        private readonly List<bool> _lists = [];
        private int _footnote;

        public string Body(Action<int> chapterDone)
        {
            var body = new StringBuilder();
            var parts = book.Parts;
            var front = parts.Cover || parts.Credits || (parts.Contents && book.Chapters.Count > 0);

            if (parts.Cover)
            {
                body.Append(Paragraph("Portada", Text(book.Title)));
                if (book.Author.Length > 0)
                {
                    body.Append(Paragraph("Autor", Text(book.Author)));
                }
            }

            if (parts.Credits)
            {
                var lines = string.Join("<w:r><w:br/></w:r>", book.Credits.Split('\n').Select(Text));
                body.Append(parts.Cover ? PageBreak() : string.Empty).Append(Paragraph("Creditos", lines));
            }

            if (parts.Contents && book.Chapters.Count > 0)
            {
                if (parts.Cover || parts.Credits)
                {
                    body.Append(PageBreak());
                }

                body.Append(Paragraph("TituloIndice", Text("Índice")));
                for (var index = 0; index < book.Chapters.Count; index++)
                {
                    var title = Text(MarkdownWriter.TitleOf(book.Chapters[index], index));
                    var begin = index == 0
                        ? """<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \o "1-1" \h \z \u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>"""
                        : string.Empty;
                    var end = index == book.Chapters.Count - 1 ? """<w:r><w:fldChar w:fldCharType="end"/></w:r>""" : string.Empty;
                    body.Append(Paragraph("TOC1", begin + title + end));
                }
            }

            if (front)
            {
                body.Append(CultureInfo.InvariantCulture, $"""<w:p><w:pPr><w:sectPr>{Section(numbered: false, restart: false)}</w:sectPr></w:pPr></w:p>""");
            }

            for (var index = 0; index < book.Chapters.Count; index++)
            {
                var chapter = book.Chapters[index];
                body.Append(Paragraph("Heading1", Text(MarkdownWriter.TitleOf(chapter, index))));
                foreach (var block in chapter.Blocks)
                {
                    Block(body, block, quoted: false);
                }

                var section = Section(numbered: true, restart: index == 0);
                body.Append(index < book.Chapters.Count - 1 ? $"""<w:p><w:pPr><w:sectPr>{section}</w:sectPr></w:pPr></w:p>""" : $"<w:sectPr>{section}</w:sectPr>");
                chapterDone(index + 1);
            }

            if (book.Chapters.Count == 0)
            {
                body.Append(CultureInfo.InvariantCulture, $"<w:sectPr>{Section(numbered: false, restart: false)}</w:sectPr>");
            }

            return body.ToString();
        }

        public string Footnotes() => $"""
            <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
            <w:footnotes xmlns:w="{Main}" xmlns:r="{Relationships}">
              <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
              <w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
            {_footnotes}
            </w:footnotes>
            """;

        public string Numbering()
        {
            var numbers = new StringBuilder();
            for (var index = 0; index < _lists.Count; index++)
            {
                numbers.Append(CultureInfo.InvariantCulture, $"""<w:num w:numId="{index + 1}"><w:abstractNumId w:val="{(_lists[index] ? 2 : 1)}"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="1"/></w:lvlOverride></w:num>""");
            }

            return $"""
                <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
                <w:numbering xmlns:w="{Main}">
                  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="283"/></w:pPr></w:lvl></w:abstractNum>
                  <w:abstractNum w:abstractNumId="2"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="567" w:hanging="340"/></w:pPr></w:lvl></w:abstractNum>
                  {numbers}
                </w:numbering>
                """;
        }

        private string Section(bool numbered, bool restart)
        {
            var format = book.Format;
            var margins = format.Margins;
            var footer = numbered ? """<w:footerReference w:type="default" r:id="rIdFooter"/>""" : string.Empty;
            var start = restart ? """<w:pgNumType w:start="1"/>""" : string.Empty;
            return $"""{footer}<w:type w:val="nextPage"/><w:pgSz w:w="{Twips(format.PageWidth)}" w:h="{Twips(format.PageHeight)}"/><w:pgMar w:top="{Twips(margins.Top)}" w:right="{Twips(margins.Outside)}" w:bottom="{Twips(margins.Bottom)}" w:left="{Twips(margins.Inside)}" w:header="{Twips(margins.Top / 2)}" w:footer="{Twips(margins.Bottom / 2)}" w:gutter="0"/>{start}""";
        }

        private void Block(StringBuilder body, BookBlock block, bool quoted)
        {
            switch (block)
            {
                case BookParagraph paragraph:
                    var style = quoted ? "Cita" : paragraph.Follows ? "TextoSigue" : "Texto";
                    var indent = paragraph.Indent > 0
                        ? string.Create(CultureInfo.InvariantCulture, $"""<w:ind w:left="{(int)(paragraph.Indent * 2 * book.Format.BodySize * 20)}"/>""")
                        : string.Empty;
                    body.Append(Paragraph(style, Inlines(paragraph.Inlines), indent));
                    break;
                case BookHeading heading:
                    body.Append(Paragraph($"Heading{heading.Level + 1}", Inlines(heading.Inlines)));
                    break;
                case BookQuote quote:
                    foreach (var inner in quote.Blocks)
                    {
                        Block(body, inner, quoted: true);
                    }

                    break;
                case BookList list:
                    _lists.Add(list.Ordered);
                    var numbering = string.Create(CultureInfo.InvariantCulture, $"""<w:numPr><w:ilvl w:val="0"/><w:numId w:val="{_lists.Count}"/></w:numPr>""");
                    foreach (var item in list.Items)
                    {
                        foreach (var inline in item.SelectMany(Flatten))
                        {
                            body.Append(Paragraph("Lista", Inlines(inline), numbering));
                        }
                    }

                    break;
                case BookSceneBreak:
                    body.Append(Paragraph("Escena", Text("❦")));
                    break;
                default:
                    break;
            }
        }

        /// <summary>The lines of text of a block inside a list item, one paragraph each.</summary>
        private static IEnumerable<IReadOnlyList<BookInline>> Flatten(BookBlock block) => block switch
        {
            BookParagraph paragraph => [paragraph.Inlines],
            BookHeading heading => [heading.Inlines],
            BookQuote quote => quote.Blocks.SelectMany(Flatten),
            BookList list => list.Items.SelectMany(item => item).SelectMany(Flatten),
            _ => [],
        };

        private string Inlines(IReadOnlyList<BookInline> inlines)
        {
            var runs = new StringBuilder();
            foreach (var inline in inlines)
            {
                switch (inline)
                {
                    case TextRun run:
                        var properties = new StringBuilder();
                        if (run.Style.HasFlag(TextStyle.Bold))
                        {
                            properties.Append("<w:b/><w:bCs/>");
                        }

                        if (run.Style.HasFlag(TextStyle.Italic))
                        {
                            properties.Append("<w:i/><w:iCs/>");
                        }

                        if (run.Style.HasFlag(TextStyle.Underline))
                        {
                            properties.Append("""<w:u w:val="single"/>""");
                        }

                        runs.Append(properties.Length > 0 ? $"<w:r><w:rPr>{properties}</w:rPr>" : "<w:r>")
                            .Append("<w:t xml:space=\"preserve\">").Append(Xml.Escape(run.Text)).Append("</w:t></w:r>");
                        break;
                    case LineBreak:
                        runs.Append("<w:r><w:br/></w:r>");
                        break;
                    case FootnoteCall call:
                        var id = ++_footnote;
                        runs.Append(CultureInfo.InvariantCulture, $"""<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="{id}"/></w:r>""");
                        _footnotes.Append(CultureInfo.InvariantCulture, $"""  <w:footnote w:id="{id}"><w:p><w:pPr><w:pStyle w:val="FootnoteText"/></w:pPr><w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteRef/></w:r><w:r><w:t xml:space="preserve"> {Xml.Escape(call.Text)}</w:t></w:r></w:p></w:footnote>""").Append('\n');
                        break;
                    default:
                        break;
                }
            }

            return runs.ToString();
        }

        private static string Text(string text) => $"<w:r><w:t xml:space=\"preserve\">{Xml.Escape(text)}</w:t></w:r>";

        private static string PageBreak() => """<w:p><w:r><w:br w:type="page"/></w:r></w:p>""";

        private static string Paragraph(string style, string runs, string properties = "") =>
            $"""<w:p><w:pPr><w:pStyle w:val="{style}"/>{properties}</w:pPr>{runs}</w:p>""" + "\n";
    }
}
