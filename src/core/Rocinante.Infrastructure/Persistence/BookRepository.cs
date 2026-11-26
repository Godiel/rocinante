using Rocinante.Application.Ports;
using Rocinante.Domain.Books;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores the author, the credits and the cover of the book in the single row of <c>book</c>.</summary>
public sealed class BookRepository(ProjectDatabase database) : IBookRepository
{
    public BookDetails Load()
    {
        using var command = database.Command("SELECT author, credits, cover_version, last_cover_version FROM book WHERE singleton = 1;");
        using var reader = command.ExecuteReader();
        return reader.Read()
            ? BookDetails.Rehydrate(
                reader.GetString(0),
                reader.GetNullableString(1),
                reader.IsDBNull(2) ? null : checked((int)reader.GetInt64(2)),
                checked((int)reader.GetInt64(3)))
            : BookDetails.Empty;
    }

    public void Save(BookDetails details)
    {
        ArgumentNullException.ThrowIfNull(details);

        database.InTransaction(() => database.Execute(
            """
            INSERT INTO book (singleton, author, credits, last_cover_version) VALUES (1, $author, $credits, $last)
            ON CONFLICT (singleton) DO UPDATE SET
                author = excluded.author, credits = excluded.credits, last_cover_version = excluded.last_cover_version;
            """,
            ("$author", details.Author),
            ("$credits", details.Credits),
            ("$last", details.LastCoverVersion)));
    }

    public void SaveCover(BookDetails details, ReadOnlyMemory<byte>? image)
    {
        ArgumentNullException.ThrowIfNull(details);

        database.InTransaction(() =>
        {
            Save(details);
            database.Execute(
                "UPDATE book SET cover = $cover, cover_version = $version WHERE singleton = 1;",
                ("$cover", image?.ToArray()),
                ("$version", image is null ? null : details.CoverVersion));
        });
    }

    public ReadOnlyMemory<byte>? LoadCover()
    {
        using var command = database.Command("SELECT cover FROM book WHERE singleton = 1 AND cover IS NOT NULL;");
        return command.ExecuteScalar() is byte[] cover ? new ReadOnlyMemory<byte>(cover) : (ReadOnlyMemory<byte>?)null;
    }
}
