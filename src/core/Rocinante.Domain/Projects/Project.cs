using Rocinante.Domain.Formats;

namespace Rocinante.Domain.Projects;

/// <summary>
/// A work: its title, its format and the index of its documents. Chapters keep the reading order, fragments
/// wait in the drawer, and deleted documents stay in the trash until restored.
/// </summary>
public sealed class Project
{
    private readonly List<DocumentEntry> _chapters = [];
    private readonly List<DocumentEntry> _fragments = [];
    private readonly List<DocumentEntry> _trash = [];

    private Project(ProjectId id, string title, DateTimeOffset createdAt, WorkFormat format)
    {
        Id = id;
        Title = title;
        CreatedAt = createdAt;
        Format = format;
    }

    public ProjectId Id { get; }

    public string Title { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    /// <summary>How the work is set: page, margins and type. A <see cref="WorkFormat"/> is always valid.</summary>
    public WorkFormat Format { get; private set; }

    /// <summary>Chapters in reading order.</summary>
    public IReadOnlyList<DocumentEntry> Chapters => _chapters;

    /// <summary>Fragments in the order the writer keeps them in the drawer.</summary>
    public IReadOnlyList<DocumentEntry> Fragments => _fragments;

    /// <summary>Deleted documents, most recent first.</summary>
    public IReadOnlyList<DocumentEntry> Trash => _trash;

    /// <summary>A new work, with <paramref name="format"/> or the default one.</summary>
    public static Project Create(string title, DateTimeOffset now, WorkFormat? format = null) =>
        new(ProjectId.New(now), Titles.Normalize(title), now, format ?? WorkFormat.Default);

    /// <summary>
    /// Rebuilds a project from storage. Positions are trusted only for their order: gaps and
    /// duplicates are closed up.
    /// </summary>
    public static Project Rehydrate(
        ProjectId id,
        string title,
        DateTimeOffset createdAt,
        IEnumerable<DocumentEntry> entries,
        WorkFormat? format = null)
    {
        ArgumentNullException.ThrowIfNull(entries);

        var project = new Project(id, title, createdAt, format ?? WorkFormat.Default);
        var all = entries.ToList();

        project._chapters.AddRange(Active(all, DocumentKind.Chapter));
        project._fragments.AddRange(Active(all, DocumentKind.Fragment));
        project._trash.AddRange(all.Where(entry => entry.IsDeleted).OrderByDescending(entry => entry.DeletedAt));
        Renumber(project._chapters);
        Renumber(project._fragments);
        return project;

        static IEnumerable<DocumentEntry> Active(List<DocumentEntry> all, DocumentKind kind) =>
            all.Where(entry => !entry.IsDeleted && entry.Kind == kind)
                .OrderBy(entry => entry.Position)
                .ThenBy(entry => entry.CreatedAt);
    }

    public void Rename(string title) => Title = Titles.Normalize(title);

    public void ChangeFormat(WorkFormat format) => Format = format ?? throw new ArgumentNullException(nameof(format));

    /// <summary>Adds a new chapter at <paramref name="index"/>, or at the end.</summary>
    public DocumentEntry AddChapter(string title, DateTimeOffset now, int? index = null) =>
        Add(DocumentKind.Chapter, title, now, index);

    /// <summary>Adds a new fragment to the drawer at <paramref name="index"/>, or at the end.</summary>
    public DocumentEntry AddFragment(string title, DateTimeOffset now, int? index = null) =>
        Add(DocumentKind.Fragment, title, now, index);

    public DocumentEntry Find(DocumentId id) =>
        _chapters.Concat(_fragments).Concat(_trash).FirstOrDefault(entry => entry.Id == id)
        ?? throw new DomainException(DomainError.DocumentNotFound, $"Document {id} is not in this project.");

    public void RenameDocument(DocumentId id, string title) => Find(id).Title = Titles.Normalize(title);

    /// <summary>
    /// Places a document at <paramref name="index"/> among those of <paramref name="kind"/>. This is
    /// both reordering and converting: dragging a fragment into the chapters makes it a chapter,
    /// and its text is untouched.
    /// </summary>
    public void Move(DocumentId id, DocumentKind kind, int index)
    {
        var entry = FindActive(id);
        var source = ListOf(entry.Kind);
        var target = ListOf(kind);

        var maximum = ReferenceEquals(source, target) ? target.Count - 1 : target.Count;
        EnsureInRange(index, maximum);

        source.Remove(entry);
        target.Insert(index, entry);
        entry.Kind = kind;
        Renumber(source);
        Renumber(target);
    }

    /// <summary>Turns a document into the other kind, at the end of its new list.</summary>
    public void Convert(DocumentId id, DocumentKind kind)
    {
        var entry = FindActive(id);
        if (entry.Kind != kind)
        {
            Move(id, kind, ListOf(kind).Count);
        }
    }

    /// <summary>Sends a document to the trash. Its text and versions are kept, so it can be restored.</summary>
    public void Delete(DocumentId id, DateTimeOffset now)
    {
        var entry = FindActive(id);
        var list = ListOf(entry.Kind);

        list.Remove(entry);
        Renumber(list);
        entry.DeletedAt = now;
        _trash.Insert(0, entry);
    }

    /// <summary>Brings a document back from the trash to the place it had, or as close as possible.</summary>
    public void Restore(DocumentId id)
    {
        var entry = Find(id);
        if (!entry.IsDeleted)
        {
            throw new DomainException(DomainError.DocumentIsNotDeleted, $"Document {id} is not in the trash.");
        }

        var list = ListOf(entry.Kind);
        _trash.Remove(entry);
        entry.DeletedAt = null;
        list.Insert(Math.Min(entry.Position, list.Count), entry);
        Renumber(list);
    }

    private DocumentEntry Add(DocumentKind kind, string title, DateTimeOffset now, int? index)
    {
        var list = ListOf(kind);
        var position = index ?? list.Count;
        EnsureInRange(position, list.Count);

        var entry = DocumentEntry.Create(kind, title, now);
        list.Insert(position, entry);
        Renumber(list);
        return entry;
    }

    private DocumentEntry FindActive(DocumentId id)
    {
        var entry = Find(id);
        return entry.IsDeleted
            ? throw new DomainException(DomainError.DocumentIsDeleted, $"Document {id} is in the trash.")
            : entry;
    }

    private List<DocumentEntry> ListOf(DocumentKind kind) => kind switch
    {
        DocumentKind.Chapter => _chapters,
        DocumentKind.Fragment => _fragments,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown document kind."),
    };

    private static void EnsureInRange(int index, int maximum)
    {
        if (index < 0 || index > maximum)
        {
            throw new DomainException(DomainError.PositionOutOfRange, $"Position {index} is outside 0..{maximum}.");
        }
    }

    private static void Renumber(List<DocumentEntry> list)
    {
        for (var position = 0; position < list.Count; position++)
        {
            list[position].Position = position;
        }
    }
}
