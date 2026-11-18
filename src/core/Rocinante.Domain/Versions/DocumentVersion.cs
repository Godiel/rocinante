using Rocinante.Domain.Content;

namespace Rocinante.Domain.Versions;

/// <summary>A full snapshot of a document's text at a point in time. Versions never change.</summary>
public sealed class DocumentVersion
{
    public const int MaxNameLength = 120;

    private DocumentVersion(VersionId id, DocumentId documentId, VersionKind kind, string? name, DateTimeOffset createdAt, DocumentContent content)
    {
        Id = id;
        DocumentId = documentId;
        Kind = kind;
        Name = name;
        CreatedAt = createdAt;
        Content = content;
    }

    public VersionId Id { get; }

    public DocumentId DocumentId { get; }

    public VersionKind Kind { get; }

    /// <summary>The name the writer gave it, if any. Only manual versions have one.</summary>
    public string? Name { get; }

    public DateTimeOffset CreatedAt { get; }

    public DocumentContent Content { get; }

    /// <summary>Rebuilds a version from storage.</summary>
    public static DocumentVersion Rehydrate(VersionId id, DocumentId documentId, VersionKind kind, string? name, DateTimeOffset createdAt, DocumentContent content) =>
        new(id, documentId, kind, name, createdAt, content);

    internal static DocumentVersion Capture(DocumentId documentId, VersionKind kind, string? name, DateTimeOffset now, DocumentContent content) =>
        new(VersionId.New(now), documentId, kind, NormalizeName(name), now, content);

    private static string? NormalizeName(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length <= MaxNameLength
            ? trimmed
            : throw new DomainException(
                DomainError.VersionNameTooLong,
                $"A version name cannot exceed {MaxNameLength} characters.");
    }
}
