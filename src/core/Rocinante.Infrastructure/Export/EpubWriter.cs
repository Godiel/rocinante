using System.Globalization;
using System.IO.Compression;
using System.Text;
using Rocinante.Application.Ports;
using Rocinante.Domain.Books;
using Rocinante.Infrastructure.Export.Fonts;

namespace Rocinante.Infrastructure.Export;

/// <summary>
/// The book as EPUB 3: a ZIP with the <c>mimetype</c> first and stored, the package with the data of the book,
/// the navigation document, one XHTML file for each chapter with its footnotes, the style sheet of the work and
/// its typeface in WOFF, which the reader may use or not.
/// </summary>
public sealed class EpubWriter : IBookWriter
{
    private const string Folder = "OEBPS/";

    // The ranges of the two Fontsource subsets, so each letter is taken from the file that has it.
    private const string LatinRange =
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";

    private const string LatinExtRange =
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

    private static readonly TextStyle[] _styles = [TextStyle.Plain, TextStyle.Italic, TextStyle.Bold, TextStyle.Bold | TextStyle.Italic];

    public ExportFormat Format => ExportFormat.Epub;

    public void Write(Book book, Stream output, Action<int> chapterDone)
    {
        ArgumentNullException.ThrowIfNull(book);
        ArgumentNullException.ThrowIfNull(chapterDone);

        using var zip = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true);
        Add(zip, "mimetype", "application/epub+zip", CompressionLevel.NoCompression);
        Add(zip, "META-INF/container.xml", """
            <?xml version="1.0" encoding="UTF-8"?>
            <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
              <rootfiles>
                <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
              </rootfiles>
            </container>
            """);

        var manifest = new List<string>();
        var spine = new List<string>();
        var hasCover = book.Parts.Cover && book.Cover is not null;

        if (hasCover)
        {
            AddBytes(zip, Folder + "images/cover.jpg", book.Cover!.Value.Span);
            manifest.Add("""<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>""");
            Add(zip, Folder + "cover.xhtml", Page(book, "Portada", """<section epub:type="cover" class="cubierta"><img src="images/cover.jpg" alt="Portada"/></section>"""));
            manifest.Add("""<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>""");
            spine.Add("""<itemref idref="cover"/>""");
        }

        if (book.Parts.Cover)
        {
            var author = book.Author.Length > 0 ? $"""<p class="autor">{Xml.Escape(book.Author)}</p>""" : string.Empty;
            Add(zip, Folder + "title.xhtml", Page(book, book.Title, $"""<section epub:type="titlepage" class="portada"><h1 class="titulo">{Xml.Escape(book.Title)}</h1>{author}</section>"""));
            manifest.Add("""<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>""");
            spine.Add("""<itemref idref="title"/>""");
        }

        if (book.Parts.Credits)
        {
            var lines = string.Join("<br/>", book.Credits.Split('\n').Select(Xml.Escape));
            Add(zip, Folder + "credits.xhtml", Page(book, "Créditos", $"""<section epub:type="copyright-page" class="creditos"><p>{lines}</p></section>"""));
            manifest.Add("""<item id="credits" href="credits.xhtml" media-type="application/xhtml+xml"/>""");
            spine.Add("""<itemref idref="credits"/>""");
        }

        Add(zip, Folder + "nav.xhtml", Navigation(book));
        manifest.Add("""<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>""");
        if (book.Parts.Contents)
        {
            spine.Add("""<itemref idref="nav"/>""");
        }

        for (var index = 0; index < book.Chapters.Count; index++)
        {
            var name = $"chapter-{index + 1}";
            Add(zip, $"{Folder}{name}.xhtml", Chapter(book, book.Chapters[index], index));
            manifest.Add($"""<item id="{name}" href="{name}.xhtml" media-type="application/xhtml+xml"/>""");
            spine.Add($"""<itemref idref="{name}"/>""");
            chapterDone(index + 1);
        }

        Add(zip, Folder + "styles/book.css", StyleSheet(book));
        manifest.Add("""<item id="css" href="styles/book.css" media-type="text/css"/>""");
        foreach (var style in _styles)
        {
            foreach (var subset in new[] { FontSubset.Latin, FontSubset.LatinExt })
            {
                var file = BookFonts.FileOf(book.Format.Typeface, style, subset);
                AddBytes(zip, $"{Folder}fonts/{file}", BookFonts.Woff(book.Format.Typeface, style, subset));
                manifest.Add($"""<item id="{Path.GetFileNameWithoutExtension(file)}" href="fonts/{file}" media-type="font/woff"/>""");
            }
        }

        Add(zip, Folder + "content.opf", Package(book, manifest, spine));
    }

    private static string Package(Book book, List<string> manifest, List<string> spine)
    {
        var modified = book.Date.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
        var creator = book.Author.Length > 0 ? $"\n    <dc:creator>{Xml.Escape(book.Author)}</dc:creator>" : string.Empty;
        return $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="{Book.Language}">
              <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
                <dc:identifier id="id">urn:uuid:{Xml.Escape(book.Identifier)}</dc:identifier>
                <dc:title>{Xml.Escape(book.Title)}</dc:title>{creator}
                <dc:language>{Book.Language}</dc:language>
                <dc:rights>{Xml.Escape(book.Credits.Replace('\n', ' '))}</dc:rights>
                <meta property="dcterms:modified">{modified}</meta>
              </metadata>
              <manifest>
                {string.Join("\n    ", manifest)}
              </manifest>
              <spine>
                {string.Join("\n    ", spine)}
              </spine>
            </package>
            """;
    }

    private static string Navigation(Book book)
    {
        var items = string.Join(
            "\n      ",
            book.Chapters.Select((chapter, index) => $"""<li><a href="chapter-{index + 1}.xhtml">{Xml.Escape(MarkdownWriter.TitleOf(chapter, index))}</a></li>"""));
        return Page(book, "Índice", $"""
            <nav epub:type="toc" id="toc" class="indice">
              <h1>Índice</h1>
              <ol>
                {items}
              </ol>
            </nav>
            """);
    }

    private static string Chapter(Book book, BookChapter chapter, int index)
    {
        var body = new StringBuilder();
        body.Append("<section epub:type=\"chapter\" class=\"capitulo\">\n");
        body.Append("<h1 class=\"titulo-capitulo\">").Append(Xml.Escape(MarkdownWriter.TitleOf(chapter, index))).Append("</h1>\n");
        foreach (var block in chapter.Blocks)
        {
            Block(body, block, book);
        }

        var notes = chapter.Footnotes.ToList();
        if (notes.Count > 0)
        {
            body.Append("<section class=\"notas\" epub:type=\"footnotes\">\n");
            foreach (var note in notes)
            {
                body.Append(CultureInfo.InvariantCulture, $"""<aside epub:type="footnote" id="nota-{note.Number}"><p><a href="#llamada-{note.Number}">{note.Number}.</a> {Xml.Escape(note.Text)}</p></aside>""").Append('\n');
            }

            body.Append("</section>\n");
        }

        body.Append("</section>");
        return Page(book, MarkdownWriter.TitleOf(chapter, index), body.ToString());
    }

    private static void Block(StringBuilder body, BookBlock block, Book book)
    {
        switch (block)
        {
            case BookParagraph paragraph:
                var classes = new List<string>();
                if (paragraph.Follows)
                {
                    classes.Add("sigue");
                }

                if (paragraph.Opens && book.Format.DropCap)
                {
                    classes.Add("abre");
                }

                if (paragraph.Indent > 0)
                {
                    classes.Add($"sangria-{paragraph.Indent}");
                }

                body.Append(classes.Count > 0 ? $"<p class=\"{string.Join(' ', classes)}\">" : "<p>")
                    .Append(Inlines(paragraph.Inlines))
                    .Append("</p>\n");
                break;
            case BookHeading heading:
                body.Append(CultureInfo.InvariantCulture, $"<h{heading.Level + 1}>").Append(Inlines(heading.Inlines)).Append(CultureInfo.InvariantCulture, $"</h{heading.Level + 1}>\n");
                break;
            case BookQuote quote:
                body.Append("<blockquote>\n");
                foreach (var inner in quote.Blocks)
                {
                    Block(body, inner, book);
                }

                body.Append("</blockquote>\n");
                break;
            case BookList list:
                var tag = list.Ordered ? "ol" : "ul";
                body.Append('<').Append(tag).Append(">\n");
                foreach (var item in list.Items)
                {
                    body.Append("<li>");
                    foreach (var inner in item)
                    {
                        Block(body, inner, book);
                    }

                    body.Append("</li>\n");
                }

                body.Append("</").Append(tag).Append(">\n");
                break;
            case BookSceneBreak:
                body.Append("<hr class=\"escena\"/>\n");
                break;
            default:
                break;
        }
    }

    private static string Inlines(IReadOnlyList<BookInline> inlines)
    {
        var text = new StringBuilder();
        foreach (var inline in inlines)
        {
            switch (inline)
            {
                case TextRun run:
                    var escaped = Xml.Escape(run.Text);
                    if (run.Style.HasFlag(TextStyle.Underline))
                    {
                        escaped = $"<u>{escaped}</u>";
                    }

                    if (run.Style.HasFlag(TextStyle.Bold))
                    {
                        escaped = $"<strong>{escaped}</strong>";
                    }

                    if (run.Style.HasFlag(TextStyle.Italic))
                    {
                        escaped = $"<em>{escaped}</em>";
                    }

                    text.Append(escaped);
                    break;
                case LineBreak:
                    text.Append("<br/>");
                    break;
                case FootnoteCall call:
                    text.Append(CultureInfo.InvariantCulture, $"""<a epub:type="noteref" href="#nota-{call.Number}" id="llamada-{call.Number}" class="llamada">{call.Number}</a>""");
                    break;
                default:
                    break;
            }
        }

        return text.ToString();
    }

    private static string Page(Book book, string title, string body) => $"""
        <?xml version="1.0" encoding="UTF-8"?>
        <!DOCTYPE html>
        <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{Book.Language}" lang="{Book.Language}">
        <head>
          <meta charset="UTF-8"/>
          <title>{Xml.Escape(title.Length > 0 ? title : book.Title)}</title>
          <link rel="stylesheet" type="text/css" href="styles/book.css"/>
        </head>
        <body>
        {body}
        </body>
        </html>
        """;

    private static string StyleSheet(Book book)
    {
        var format = book.Format;
        var family = BookFonts.FamilyOf(format.Typeface);
        var faces = new StringBuilder();
        foreach (var style in _styles)
        {
            foreach (var (subset, range) in new[] { (FontSubset.Latin, LatinRange), (FontSubset.LatinExt, LatinExtRange) })
            {
                faces.Append(CultureInfo.InvariantCulture, $$"""
                    @font-face {
                      font-family: "{{family}}";
                      font-style: {{(style.HasFlag(TextStyle.Italic) ? "italic" : "normal")}};
                      font-weight: {{(style.HasFlag(TextStyle.Bold) ? 700 : 400)}};
                      src: url("../fonts/{{BookFonts.FileOf(format.Typeface, style, subset)}}") format("woff");
                      unicode-range: {{range}};
                    }

                    """);
            }
        }

        var follows = format.FirstLineIndent ? "text-indent: 1.5em;" : "margin-top: 0.6em;";
        return string.Create(CultureInfo.InvariantCulture, $$"""
            {{faces}}
            body {
              font-family: "{{family}}", serif;
              line-height: {{format.Leading:0.##}};
              text-align: {{(format.Justified ? "justify" : "left")}};
              hyphens: auto;
              -epub-hyphens: auto;
            }

            p { margin: 0; text-indent: 0; }
            p.sigue { {{follows}} }
            p.abre::first-letter { float: left; font-size: 3.3em; line-height: 0.85; padding-top: 0.06em; margin-right: 0.08em; }
            .sangria-1 { margin-left: 2em; }
            .sangria-2 { margin-left: 4em; }
            .sangria-3 { margin-left: 6em; }
            .sangria-4 { margin-left: 8em; }

            .titulo-capitulo { margin: 3em 0 2.5em; font-size: 1.58em; font-weight: 400; font-variant: small-caps; text-align: center; page-break-before: always; break-before: page; }
            h2, h3, h4 { margin: 1.5em 0 1em; font-weight: 400; line-height: 1.25; text-align: center; }
            h2 { font-size: 1.58em; font-variant: small-caps; }
            h3 { font-size: 1.26em; }
            h4 { font-size: 1em; font-style: italic; }
            blockquote { margin: 0.8em 0 0.8em 1.5em; }
            ul, ol { margin: 0.8em 0; padding-left: 1.5em; }
            hr.escena { margin: 1em auto; border: 0; text-align: center; height: 1.4em; }
            hr.escena::after { content: "❦"; }

            a.llamada { font-size: 0.65em; vertical-align: super; line-height: 0; text-decoration: none; }
            .notas { margin-top: 2em; font-size: 0.85em; text-align: left; }
            .notas p { margin: 0.4em 0; }

            .cubierta { text-align: center; }
            .cubierta img { max-width: 100%; max-height: 100%; }
            .portada { margin-top: 30%; text-align: center; }
            .portada .titulo { font-size: 2em; font-weight: 400; font-variant: small-caps; }
            .portada .autor { margin-top: 2em; font-size: 1.2em; }
            .creditos { margin-top: 60%; font-size: 0.85em; text-align: left; }
            .indice ol { list-style: none; padding: 0; }
            .indice li { margin: 0.4em 0; }
            """);
    }

    private static void Add(ZipArchive zip, string name, string text, CompressionLevel level = CompressionLevel.Optimal) =>
        AddBytes(zip, name, new UTF8Encoding(false).GetBytes(text), level);

    private static void AddBytes(ZipArchive zip, string name, ReadOnlySpan<byte> data, CompressionLevel level = CompressionLevel.Optimal)
    {
        var entry = zip.CreateEntry(name, level);
        // A fixed time keeps two exports of the same work the same file.
        entry.LastWriteTime = new DateTimeOffset(2000, 1, 1, 0, 0, 0, TimeSpan.Zero);
        using var stream = entry.Open();
        stream.Write(data);
    }
}
