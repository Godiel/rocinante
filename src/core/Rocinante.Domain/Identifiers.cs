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

/// <summary>Identifies an element of the work: a character, a place, a plot or another thing.</summary>
public readonly record struct ElementId(Guid Value)
{
    public static ElementId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}

/// <summary>Identifies a relationship between two elements.</summary>
public readonly record struct RelationshipId(Guid Value)
{
    public static RelationshipId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}

/// <summary>Identifies a note.</summary>
public readonly record struct NoteId(Guid Value)
{
    public static NoteId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}

/// <summary>Identifies a proposal of the squire.</summary>
public readonly record struct ProposalId(Guid Value)
{
    public static ProposalId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}

/// <summary>Identifies a milestone: something that happens to an element at a paragraph.</summary>
public readonly record struct MilestoneId(Guid Value)
{
    public static MilestoneId New(DateTimeOffset now) => new(Guid.CreateVersion7(now));

    public override string ToString() => Value.ToString();
}
