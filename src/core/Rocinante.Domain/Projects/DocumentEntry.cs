namespace Rocinante.Domain.Projects;

/// <summary>
/// A document as the project index sees it: its kind, title and place. The text itself lives in
/// <see cref="Documents.Document"/>, so reordering the index never loads the whole work.
/// </summary>
public sealed class DocumentEntry
{
    private DocumentEntry(DocumentId id, DocumentKind kind, string title, int position, DateTimeOffset createdAt, DateTimeOffset? deletedAt)
    {
        Id = id;
        Kind = kind;
        Title = title;
        Position = position;
        CreatedAt = createdAt;
        DeletedAt = deletedAt;
    }

    public DocumentId Id { get; }

    public DocumentKind Kind { get; internal set; }

    public string Title { get; internal set; }

    /// <summary>Zero-based place among the documents of its kind. In the trash, the place it had.</summary>
    public int Position { get; internal set; }

    public DateTimeOffset CreatedAt { get; }

    /// <summary>When it went to the trash; <see langword="null"/> while it is in the work.</summary>
    public DateTimeOffset? DeletedAt { get; internal set; }

    public bool IsDeleted => DeletedAt is not null;

    /// <summary>Rebuilds an entry from storage.</summary>
    public static DocumentEntry Rehydrate(DocumentId id, DocumentKind kind, string title, int position, DateTimeOffset createdAt, DateTimeOffset? deletedAt) =>
        new(id, kind, title, position, createdAt, deletedAt);

    internal static DocumentEntry Create(DocumentKind kind, string title, DateTimeOffset now) =>
        new(DocumentId.New(now), kind, Titles.Normalize(title), position: 0, now, deletedAt: null);
}
