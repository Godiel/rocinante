using Rocinante.Domain.Books;
using Rocinante.Domain.Content;
using Rocinante.Domain.Formats;

namespace Rocinante.Infrastructure.Tests.Export;

/// <summary>Books to write in each format, from content as the editor makes it.</summary>
internal static class SampleBooks
{
    public const string First = """
        {"type":"doc","content":[
          {"type":"paragraph","content":[{"type":"text","text":"En un lugar de la "},{"type":"text","text":"Mancha","marks":[{"type":"italic"}]},{"type":"text","text":", de cuyo nombre no quiero acordarme"},{"type":"footnote","attrs":{"text":"Una región de España."}},{"type":"text","text":"."}]},
          {"type":"paragraph","content":[{"type":"text","text":"Tenía "},{"type":"text","text":"una lanza","marks":[{"type":"bold"}]},{"type":"text","text":" y "},{"type":"text","text":"un rocín","marks":[{"type":"underline"}]},{"type":"text","text":" & más."},{"type":"hardBreak"},{"type":"text","text":"Ñandú <ahí>."}]},
          {"type":"sceneBreak"},
          {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Del hidalgo"}]},
          {"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Cita de un libro de caballerías."}]}]},
          {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Olla"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Salpicón"}]}]}]},
          {"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Sábados"}]}]}]}
        ]}
        """;

    public const string Second = """
        {"type":"doc","content":[
          {"type":"paragraph","content":[{"type":"text","text":"Segunda salida"},{"type":"footnote","attrs":{"text":"Con Sancho."}},{"type":"text","text":"."}]},
          {"type":"paragraph","content":[{"type":"text","text":"Otro párrafo largo para que la línea se parta en varias, como en un libro de verdad con su texto justificado."}]}
        ]}
        """;

    public static Book Quixote(ExportParts? parts = null, WorkFormat? format = null, ReadOnlyMemory<byte>? cover = null) =>
        new(
            "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b",
            new DateTimeOffset(2026, 11, 26, 10, 0, 0, TimeSpan.Zero),
            "El ingenioso hidalgo",
            "Miguel de Cervantes",
            "© 1605 Miguel de Cervantes.\nPrimera edición.",
            cover,
            format ?? WorkFormat.Default,
            parts ?? ExportParts.All,
            [
                Book.ChapterOf("Capítulo primero", DocumentContent.Parse(First)),
                Book.ChapterOf("", DocumentContent.Parse(Second)),
            ]);

    /// <summary>A long book: <paramref name="chapters"/> chapters of paragraphs of a hundred words.</summary>
    public static Book Long(int chapters, int words, WorkFormat? format = null)
    {
        var vocabulary = "en un lugar de la mancha cuyo nombre no quiero acordarme ha mucho tiempo que vivía hidalgo lanza astillero adarga antigua rocín flaco galgo corredor".Split(' ');
        var list = new List<BookChapter>();
        for (var chapter = 0; chapter < chapters; chapter++)
        {
            var paragraphs = new List<string>();
            for (var paragraph = 0; paragraph * 100 < words; paragraph++)
            {
                var text = string.Join(' ', Enumerable.Range(0, 100).Select(word => vocabulary[(word * 7 + paragraph + chapter) % vocabulary.Length])) + ".";
                paragraphs.Add($$"""{"type":"paragraph","content":[{"type":"text","text":"{{text}}"}]}""");
            }

            list.Add(Book.ChapterOf($"Capítulo {chapter + 1}", DocumentContent.Parse($$"""{"type":"doc","content":[{{string.Join(',', paragraphs)}}]}""")));
        }

        return Quixote(format: format) with { Chapters = list };
    }

    public static byte[] Write(Application.Ports.IBookWriter writer, Book book, List<int>? progress = null)
    {
        using var output = new MemoryStream();
        writer.Write(book, output, done => progress?.Add(done));
        return output.ToArray();
    }
}
