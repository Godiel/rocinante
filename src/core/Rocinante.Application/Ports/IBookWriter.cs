using Rocinante.Domain.Books;

namespace Rocinante.Application.Ports;

/// <summary>Writes a book in one format. Implemented in the infrastructure, one for each format.</summary>
public interface IBookWriter
{
    ExportFormat Format { get; }

    /// <summary>
    /// Writes the whole book to <paramref name="output"/>, telling <paramref name="chapterDone"/> how many chapters
    /// are done each time one is.
    /// </summary>
    void Write(Book book, Stream output, Action<int> chapterDone);
}
