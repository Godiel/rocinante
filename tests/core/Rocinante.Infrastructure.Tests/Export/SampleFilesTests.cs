using Rocinante.Application.Ports;
using Rocinante.Infrastructure.Export;

namespace Rocinante.Infrastructure.Tests.Export;

/// <summary>
/// Writes the sample book in every format to the folder in <c>ROCINANTE_EXPORT_SAMPLES</c>, to open them in
/// Word, LibreOffice, a reader or EPUBCheck by hand. Skipped when the variable is not set.
/// </summary>
public sealed class SampleFilesTests
{
    [Fact]
    public void Writes_the_sample_book_in_every_format_when_asked()
    {
        var folder = Environment.GetEnvironmentVariable("ROCINANTE_EXPORT_SAMPLES");
        if (string.IsNullOrEmpty(folder))
        {
            Assert.Skip("Set ROCINANTE_EXPORT_SAMPLES to a folder to write the sample files.");
        }

        Directory.CreateDirectory(folder);
        foreach (var (writer, extension) in new (IBookWriter, string)[]
        {
            (new MarkdownWriter(), "md"), (new EpubWriter(), "epub"), (new DocxWriter(), "docx"),
        })
        {
            File.WriteAllBytes(Path.Combine(folder, $"muestra.{extension}"), SampleBooks.Write(writer, SampleBooks.Quixote()));
        }
    }
}
