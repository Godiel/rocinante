using Rocinante.Domain.Content;

namespace Rocinante.Domain.Elements;

/// <summary>
/// Something that lives in the work: a character, a place, a plot or another thing the writer names.
/// It has a name, other names it goes by, attributes, a description, maybe an image, and a place on the board.
/// </summary>
public sealed class Element
{
    public const int MaxNameLength = 200;
    public const int MaxOtherKindLength = 60;
    public const int MaxAliases = 50;
    public const int MaxAttributes = 100;

    private Element(
        ElementId id,
        ElementKind kind,
        string? otherKind,
        string name,
        IReadOnlyList<string> aliases,
        IReadOnlyList<ElementAttribute> attributes,
        DocumentContent description,
        BoardPosition position,
        long lastImageVersion,
        bool hasImage,
        DateTimeOffset createdAt,
        DateTimeOffset? deletedAt)
    {
        Id = id;
        Kind = kind;
        OtherKind = otherKind;
        Name = name;
        Aliases = aliases;
        Attributes = attributes;
        Description = description;
        Position = position;
        LastImageVersion = lastImageVersion;
        HasImage = hasImage;
        CreatedAt = createdAt;
        DeletedAt = deletedAt;
    }

    public ElementId Id { get; }

    public ElementKind Kind { get; private set; }

    /// <summary>The kind as the writer names it, only for <see cref="ElementKind.Other"/>; null for the rest.</summary>
    public string? OtherKind { get; private set; }

    public string Name { get; private set; }

    /// <summary>Other names it goes by, in the writer's order, none blank.</summary>
    public IReadOnlyList<string> Aliases { get; private set; }

    public IReadOnlyList<ElementAttribute> Attributes { get; private set; }

    /// <summary>The long text about it, as TipTap JSON like the text of the work.</summary>
    public DocumentContent Description { get; private set; }

    public BoardPosition Position { get; private set; }

    /// <summary>The version of its image, or null without one. The bytes are stored apart.</summary>
    public long? ImageVersion => HasImage ? LastImageVersion : null;

    public bool HasImage { get; private set; }

    /// <summary>
    /// The version of the latest image it had, kept after removing it so the next image never repeats a version
    /// and a copy kept by the UI is never taken for a newer image. 0 if it never had one.
    /// </summary>
    public long LastImageVersion { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    /// <summary>When it went to the trash; null while it is in the work.</summary>
    public DateTimeOffset? DeletedAt { get; internal set; }

    public bool IsDeleted => DeletedAt is not null;

    internal static Element Create(
        ElementKind kind,
        string? otherKind,
        string name,
        IEnumerable<ElementAttribute>? attributes,
        BoardPosition position,
        DateTimeOffset now)
    {
        var element = new Element(
            ElementId.New(now),
            ElementKind.Character,
            otherKind: null,
            NormalizeName(name),
            [],
            NormalizeAttributes(attributes ?? []),
            DocumentContent.Empty,
            position,
            lastImageVersion: 0,
            hasImage: false,
            now,
            deletedAt: null);
        element.ChangeKind(kind, otherKind);
        return element;
    }

    /// <summary>Rebuilds an element from storage, as it was saved.</summary>
    public static Element Rehydrate(
        ElementId id,
        ElementKind kind,
        string? otherKind,
        string name,
        IEnumerable<string> aliases,
        IEnumerable<ElementAttribute> attributes,
        DocumentContent description,
        BoardPosition position,
        long lastImageVersion,
        bool hasImage,
        DateTimeOffset createdAt,
        DateTimeOffset? deletedAt)
    {
        ArgumentNullException.ThrowIfNull(aliases);
        ArgumentNullException.ThrowIfNull(attributes);
        ArgumentNullException.ThrowIfNull(description);

        return new Element(
            id,
            kind,
            kind == ElementKind.Other ? otherKind : null,
            name,
            [.. aliases],
            [.. attributes],
            description,
            position,
            lastImageVersion,
            hasImage,
            createdAt,
            deletedAt);
    }

    public void Rename(string name) => Name = NormalizeName(name);

    /// <summary>Changes what it is. Everything written in it stays; only <see cref="ElementKind.Other"/> keeps a kind name.</summary>
    public void ChangeKind(ElementKind kind, string? otherKind)
    {
        if (!Enum.IsDefined(kind))
        {
            throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown element kind.");
        }

        if (kind != ElementKind.Other)
        {
            Kind = kind;
            OtherKind = null;
            return;
        }

        var trimmed = otherKind?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            throw new DomainException(DomainError.OtherKindRequired, "An element of kind other needs the name of its kind.");
        }

        OtherKind = Names.Bounded(trimmed, MaxOtherKindLength, "The kind of an element");
        Kind = kind;
    }

    /// <summary>Replaces the other names. Spaces around each are trimmed and blank ones dropped.</summary>
    public void SetAliases(IEnumerable<string> aliases)
    {
        ArgumentNullException.ThrowIfNull(aliases);

        var kept = aliases
            .Select(alias => alias?.Trim() ?? string.Empty)
            .Where(alias => alias.Length > 0)
            .Select(alias => Names.Bounded(alias, MaxNameLength, "An alias"))
            .ToList();
        if (kept.Count > MaxAliases)
        {
            throw new ArgumentOutOfRangeException(nameof(aliases), $"An element has at most {MaxAliases} aliases.");
        }

        Aliases = kept;
    }

    public void SetAttributes(IEnumerable<ElementAttribute> attributes) => Attributes = NormalizeAttributes(attributes);

    public void Describe(DocumentContent description)
    {
        ArgumentNullException.ThrowIfNull(description);
        Description = description;
    }

    internal void MoveTo(BoardPosition position) => Position = position;

    /// <summary>Records that it has a new image; the bytes are stored apart under the new version.</summary>
    public void ReplaceImage(DateTimeOffset now)
    {
        LastImageVersion = Math.Max(now.ToUnixTimeMilliseconds(), LastImageVersion + 1);
        HasImage = true;
    }

    public void RemoveImage() => HasImage = false;

    private static string NormalizeName(string name) => Names.Required(name, MaxNameLength, "An element");

    private static List<ElementAttribute> NormalizeAttributes(IEnumerable<ElementAttribute> attributes)
    {
        ArgumentNullException.ThrowIfNull(attributes);

        var list = attributes.ToList();
        return list.Count <= MaxAttributes
            ? list
            : throw new ArgumentOutOfRangeException(nameof(attributes), $"An element has at most {MaxAttributes} attributes.");
    }
}
