using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Application.Squire;
using Rocinante.Domain;
using Rocinante.Domain.Books;

namespace Rocinante.Application;

/// <summary>Identifies an export while it runs.</summary>
public readonly record struct ExportId(Guid Value)
{
    public override string ToString() => Value.ToString();
}

/// <summary>
/// The book the work is exported as: its author, its credits and its cover, and the export itself. The work is
/// read at once, with the rest of the core; the file is written in the background while the windows go on,
/// with its progress announced chapter by chapter.
/// </summary>
public sealed class ExportUseCases(
    Workspace workspace,
    IEnumerable<IBookWriter> writers,
    IExportFiles files,
    IChangeNotifier notifier,
    TimeProvider clock)
{
    /// <summary>The largest cover the UI may send, already reduced.</summary>
    public const int MaxCoverBytes = 2 * 1024 * 1024;

    private readonly Dictionary<ExportFormat, IBookWriter> _writers = writers.ToDictionary(writer => writer.Format);
    private readonly object _running = new();
    private Task _tail = Task.CompletedTask;

    public BookDetails Details() => workspace.Session.Books.Load();

    /// <summary>Changes the author, the credits, or both; null leaves each as it is.</summary>
    public BookDetails Update(string? author, bool changeCredits, string? credits, string origin)
    {
        var session = workspace.Session;
        var details = session.Books.Load();
        if (author is not null)
        {
            details = details.WithAuthor(author);
        }

        if (changeCredits)
        {
            details = details.WithCredits(credits);
        }

        session.InTransaction(() =>
        {
            session.Books.Save(details);
            return details;
        });
        notifier.BookChanged(details, origin);
        return details;
    }

    public BookDetails SetCover(ReadOnlyMemory<byte> image, string origin)
    {
        var head = image.Span[..Math.Min(FileSignature.HeadLength, image.Length)];
        if (FileSignature.ImageMediaType(head) != "image/jpeg")
        {
            throw new DomainException(DomainError.NotAnImage, "A cover must be a JPEG.");
        }

        if (image.Length > MaxCoverBytes)
        {
            throw new DomainException(DomainError.FileTooLarge, $"The cover is {image.Length} bytes, over the limit.");
        }

        var session = workspace.Session;
        var details = session.Books.Load().WithCover();
        session.InTransaction(() =>
        {
            session.Books.SaveCover(details, image);
            return details;
        });
        notifier.BookChanged(details, origin);
        return details;
    }

    public BookDetails RemoveCover(string origin)
    {
        var session = workspace.Session;
        var details = session.Books.Load().WithoutCover();
        session.InTransaction(() =>
        {
            session.Books.SaveCover(details, null);
            return details;
        });
        notifier.BookChanged(details, origin);
        return details;
    }

    public ReadOnlyMemory<byte> Cover() =>
        workspace.Session.Books.LoadCover()
        ?? throw new DomainException(DomainError.NotAnImage, "The book has no cover image.");

    /// <summary>
    /// Reads the chapters of the work as a book now and writes it to <paramref name="path"/> in the background.
    /// The end is announced with <c>export.finished</c>; nothing is left at the path if it fails.
    /// </summary>
    public ExportId Start(ExportFormat format, ExportParts parts, string path, string origin)
    {
        ArgumentNullException.ThrowIfNull(parts);
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        var writer = _writers.TryGetValue(format, out var found)
            ? found
            : throw new DomainException(DomainError.ExportFailed, $"There is no writer for {format}.");

        var book = Read(parts);
        var id = new ExportId(Guid.CreateVersion7(clock.GetUtcNow()));
        lock (_running)
        {
            _tail = _tail.ContinueWith(_ => Write(id, writer, book, path, origin), TaskScheduler.Default);
        }

        return id;
    }

    /// <summary>Waits until every export started has ended; for the tests.</summary>
    public Task WhenIdle()
    {
        lock (_running)
        {
            return _tail;
        }
    }

    private Book Read(ExportParts parts)
    {
        var session = workspace.Session;
        var project = workspace.Project;
        var details = session.Books.Load();
        var now = clock.GetUtcNow();
        var chapters = project.Chapters
            .Select(entry => Book.ChapterOf(entry.Title, session.Documents.Load(entry.Id).Content))
            .ToList();
        return new Book(
            project.Id.ToString(),
            now,
            project.Title,
            details.Author,
            details.CreditsFor(now.Year),
            details.CoverVersion is not null ? session.Books.LoadCover() : null,
            project.Format,
            parts,
            chapters);
    }

    private void Write(ExportId id, IBookWriter writer, Book book, string path, string origin)
    {
        var total = book.Chapters.Count;
        notifier.ExportProgress(id, 0, total, origin);
        try
        {
            using (var output = files.Begin(path))
            {
                writer.Write(book, output, done => notifier.ExportProgress(id, done, total, origin));
            }

            var bytes = files.Commit(path);
            notifier.ExportFinished(id, path, bytes, null, origin);
        }
#pragma warning disable CA1031 // Whatever goes wrong, the writer is told and nothing is left half written.
        catch (Exception)
#pragma warning restore CA1031
        {
            try
            {
                files.Discard(path);
            }
            catch (IOException)
            {
                // What could not be removed is a hidden file beside the destination, not the book.
            }

            notifier.ExportFinished(id, null, 0, DomainError.ExportFailed, origin);
        }
    }
}
