namespace Rocinante.Domain;

// Identifiers are UUID v7: unique without coordination and sortable by creation time,
// which keeps SQLite indexes compact and makes "newest first" a plain ORDER BY.

/// <summary>Identifies a project.</summary>
public readonly record struct ProjectId(Guid Value)
{
    public static ProjectId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}

/// <summary>Identifies a document (a chapter or a fragment).</summary>
public readonly record struct DocumentId(Guid Value)
{
    public static DocumentId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}

/// <summary>Identifies a saved version of a document.</summary>
public readonly record struct VersionId(Guid Value)
{
    public static VersionId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}

/// <summary>Identifies a note.</summary>
public readonly record struct NoteId(Guid Value)
{
    public static NoteId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}
