using System.Text;
using Rocinante.Domain.Books;
using Rocinante.Infrastructure.Export;

namespace Rocinante.Infrastructure.Tests.Export;

public sealed class MarkdownWriterTests
{
    private static string Write(Book book, List<int>? progress = null) =>
        Encoding.UTF8.GetString(SampleBooks.Write(new MarkdownWriter(), book, progress));

    [Fact]
    public void Writes_the_cover_the_credits_the_contents_and_the_chapters()
    {
        var progress = new List<int>();
        var text = Write(SampleBooks.Quixote(), progress);

        text.ShouldStartWith("# El ingenioso hidalgo\n\nMiguel de Cervantes\n\n© 1605 Miguel de Cervantes.  \nPrimera edición.\n\n## Índice\n\n1. Capítulo primero\n2. Capítulo 2\n\n## Capítulo primero\n\n");
        text.ShouldContain("En un lugar de la *Mancha*, de cuyo nombre no quiero acordarme[^1].\n\n");
        text.ShouldContain("Tenía **una lanza** y un rocín & más.\\\nÑandú \\<ahí\\>.\n\n");
        text.ShouldContain("* * *\n\n#### Del hidalgo\n\n> Cita de un libro de caballerías.\n>\n");
        text.ShouldContain("- Olla\n- Salpicón\n\n1. Sábados\n\n");
        text.ShouldContain("[^1]: Una región de España.\n\n## Capítulo 2\n\nSegunda salida[^2].\n");
        text.ShouldContain("[^2]: Con Sancho.\n");
        progress.ShouldBe([1, 2]);
    }

    [Fact]
    public void Leaves_out_the_parts_the_writer_takes_away()
    {
        var text = Write(SampleBooks.Quixote(new ExportParts(Cover: false, Credits: false, Contents: false)));

        text.ShouldStartWith("## Capítulo primero\n\n");
        text.ShouldNotContain("Índice");
        text.ShouldNotContain("Primera edición");
    }

    [Fact]
    public void Escapes_what_Markdown_would_read_as_marks()
    {
        MarkdownWriter.Escape("2. dijo *alguien* [nota] _x_ #1").ShouldBe("2\\. dijo \\*alguien\\* \\[nota\\] \\_x\\_ \\#1");
        MarkdownWriter.Escape("- ¿Quién?").ShouldBe("\\- ¿Quién?");
        MarkdownWriter.Inlines([new TextRun(" en cursiva ", TextStyle.Italic | TextStyle.Bold)], 0).ShouldBe(" ***en cursiva*** ");
    }
}
