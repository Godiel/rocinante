using System.Globalization;

namespace Rocinante.Domain.Books;

/// <summary>
/// What the book carries besides the text of the work: the author as it goes on the cover, the credits page and
/// whether there is a cover image (for EPUB), which is kept apart.
/// </summary>
public sealed record BookDetails
{
    public const int MaxAuthorLength = 200;

    public const int MaxCreditsLength = 2000;

    public static BookDetails Empty { get; } = new();

    /// <summary>A name or a pen name; it may be empty.</summary>
    public string Author { get; private init; } = string.Empty;

    /// <summary>The credits as the author wrote them, or null for the default of <see cref="CreditsFor"/>.</summary>
    public string? Credits { get; private init; }

    /// <summary>The version of the cover image, or null if there is none.</summary>
    public int? CoverVersion { get; private init; }

    /// <summary>The highest cover version there has been, so a new image never repeats one.</summary>
    public int LastCoverVersion { get; private init; }

    public static BookDetails Rehydrate(string author, string? credits, int? coverVersion, int lastCoverVersion) =>
        new() { Author = author, Credits = credits, CoverVersion = coverVersion, LastCoverVersion = lastCoverVersion };

    public BookDetails WithAuthor(string author)
    {
        var trimmed = author?.Trim() ?? string.Empty;
        return trimmed.Length <= MaxAuthorLength
            ? this with { Author = trimmed }
            : throw new DomainException(DomainError.NameRequired, $"An author's name has at most {MaxAuthorLength} characters.");
    }

    /// <summary>Null, blank or the default itself go back to the default.</summary>
    public BookDetails WithCredits(string? credits)
    {
        var trimmed = credits?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return this with { Credits = null };
        }

        return trimmed.Length <= MaxCreditsLength
            ? this with { Credits = trimmed.Replace("\r\n", "\n", StringComparison.Ordinal) }
            : throw new DomainException(DomainError.NoteTextTooLong, $"The credits have at most {MaxCreditsLength} characters.");
    }

    public BookDetails WithCover() =>
        this with { CoverVersion = LastCoverVersion + 1, LastCoverVersion = LastCoverVersion + 1 };

    public BookDetails WithoutCover() => this with { CoverVersion = null };

    /// <summary>The credits that go in the book: the author's, or «© {year} {author}. Todos los derechos reservados.».</summary>
    public string CreditsFor(int year) =>
        Credits ?? (Author.Length > 0
            ? string.Create(CultureInfo.InvariantCulture, $"© {year} {Author}. Todos los derechos reservados.")
            : string.Create(CultureInfo.InvariantCulture, $"© {year}. Todos los derechos reservados."));
}
