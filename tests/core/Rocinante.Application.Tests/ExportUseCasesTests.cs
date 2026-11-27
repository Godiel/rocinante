using System.Text;
using Rocinante.Domain;
using Rocinante.Domain.Books;
using Rocinante.Domain.Projects;

namespace Rocinante.Application.Tests;

public sealed class ExportUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private static readonly byte[] _jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 0, 0x10, 0x4A, 0x46, 0x49, 0x46, 0, 1];
    private readonly AppFixture _app = new();

    public ExportUseCasesTests()
    {
        _app.CreateProject();
        var first = _app.Documents.Create(DocumentKind.Chapter, "La venta", null, Main).Id;
        var second = _app.Documents.Create(DocumentKind.Chapter, "El camino", null, Main).Id;
        var fragment = _app.Documents.Create(DocumentKind.Fragment, "Suelto", null, Main).Id;
        _app.Documents.Save(first, TipTap.Paragraphs("Antonio llegó a la venta."), Main);
        _app.Documents.Save(second, TipTap.Paragraphs("Claudio siguió el camino."), Main);
        _app.Documents.Save(fragment, TipTap.Paragraphs("Esto no es del libro."), Main);
    }

    public void Dispose() => _app.Dispose();

    private async Task<string> Export(ExportFormat format, string name, ExportParts? parts = null)
    {
        var path = _app.PathOf(name);
        _app.Export.Start(format, parts ?? ExportParts.All, path, Main);
        await _app.Export.WhenIdle();
        return path;
    }

    [Fact]
    public void The_author_and_the_credits_are_kept_in_the_work()
    {
        _app.Export.Details().ShouldBe(BookDetails.Empty);

        _app.Export.Update(" Miguel de Cervantes ", changeCredits: false, null, Main).Author.ShouldBe("Miguel de Cervantes");
        _app.Export.Update(null, changeCredits: true, "Primera edición.", Main).Credits.ShouldBe("Primera edición.");
        _app.Export.Details().Author.ShouldBe("Miguel de Cervantes");
        _app.Export.Update(null, changeCredits: true, null, Main).Credits.ShouldBeNull();
        _app.Notifier.Events.ShouldContain($"book.changed:{Main}");
    }

    [Fact]
    public void A_cover_is_a_JPEG_and_can_be_taken_away()
    {
        _app.Export.SetCover(_jpeg, Main).CoverVersion.ShouldBe(1);
        _app.Export.Cover().ToArray().ShouldBe(_jpeg);
        Should.Throw<DomainException>(() => _app.Export.SetCover("not an image"u8.ToArray(), Main)).Error.ShouldBe(DomainError.NotAnImage);

        _app.Export.RemoveCover(Main).CoverVersion.ShouldBeNull();
        Should.Throw<DomainException>(() => _app.Export.Cover());
    }

    [Fact]
    public async Task The_chapters_are_written_in_the_background_with_their_progress_and_without_the_fragments()
    {
        _app.Export.Update("Miguel de Cervantes", changeCredits: false, null, Main);

        var path = await Export(ExportFormat.Markdown, "libro.md");

        var text = await File.ReadAllTextAsync(path, Encoding.UTF8, TestContext.Current.CancellationToken);
        text.ShouldStartWith("# El ingenioso hidalgo\n\nMiguel de Cervantes\n\n© 2026 Miguel de Cervantes. Todos los derechos reservados.");
        text.ShouldContain("## La venta\n\nAntonio llegó a la venta.");
        text.ShouldContain("## El camino");
        text.ShouldNotContain("Esto no es del libro.");
        _app.Notifier.Progress.Select(step => (step.Done, step.Total)).ShouldBe([(0, 2), (1, 2), (2, 2)]);
        var finished = _app.Notifier.LastExport.ShouldNotBeNull();
        finished.Path.ShouldBe(path);
        finished.Bytes.ShouldBe(new FileInfo(path).Length);
        finished.Problem.ShouldBeNull();
        Directory.GetFiles(_app.Folder, "*.rocinante-export", SearchOption.AllDirectories).ShouldBeEmpty();
    }

    [Theory]
    [InlineData(ExportFormat.Pdf, "libro.pdf", "%PDF")]
    [InlineData(ExportFormat.Epub, "libro.epub", "PK")]
    [InlineData(ExportFormat.Docx, "libro.docx", "PK")]
    public async Task Every_format_writes_its_file(ExportFormat format, string name, string start)
    {
        var path = await Export(format, name);

        Encoding.ASCII.GetString(File.ReadAllBytes(path), 0, start.Length).ShouldBe(start);
        _app.Notifier.LastExport!.Value.Problem.ShouldBeNull();
    }

    [Fact]
    public async Task A_failed_export_says_so_and_leaves_nothing_where_the_book_was_asked_for()
    {
        var folder = _app.PathOf("ocupado");
        await File.WriteAllTextAsync(folder, "un archivo, no una carpeta", TestContext.Current.CancellationToken);

        _app.Export.Start(ExportFormat.Pdf, ExportParts.All, Path.Combine(folder, "libro.pdf"), Main);
        await _app.Export.WhenIdle();

        var finished = _app.Notifier.LastExport.ShouldNotBeNull();
        finished.Path.ShouldBeNull();
        finished.Problem.ShouldBe(DomainError.ExportFailed);
    }

    [Fact]
    public async Task An_existing_file_is_replaced_only_when_the_new_one_is_whole()
    {
        var path = _app.PathOf("libro.md");
        await File.WriteAllTextAsync(path, "antes", TestContext.Current.CancellationToken);

        await Export(ExportFormat.Markdown, "libro.md");

        (await File.ReadAllTextAsync(path, TestContext.Current.CancellationToken)).ShouldContain("Antonio llegó");
    }
}
