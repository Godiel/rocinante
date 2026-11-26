using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;

namespace Rocinante.Application;

/// <summary>The parts of an element that change; null leaves a part as it is.</summary>
public sealed record ElementUpdate(
    string? Name = null,
    ElementKind? Kind = null,
    string? OtherKind = null,
    IReadOnlyList<string>? Aliases = null,
    IReadOnlyList<ElementAttribute>? Attributes = null,
    DocumentContent? Description = null);

/// <summary>A kind of relationship to use: one that exists, or the words of a new one of the writer's.</summary>
public sealed record RelationshipKindChoice(RelationshipKindId? Existing, string? Forward = null, string? Inverse = null)
{
    public static RelationshipKindChoice Of(RelationshipKindId kind) => new(kind);

    public static RelationshipKindChoice New(string forward, string? inverse) => new(null, forward, inverse);
}

/// <summary>
/// The elements of the work: creating and changing them, their images, their place on the board, the trash
/// and their relationships. Every change is stored at once and announced to every window.
/// </summary>
public sealed class ElementUseCases(Workspace workspace, IChosenFiles files, IChangeNotifier notifier, TimeProvider clock)
{
    /// <summary>An image the writer chooses may be large: the UI reduces it before it is stored.</summary>
    public const long MaxChosenImageBytes = 30L * 1024 * 1024;

    public const int MaxImageBytes = 2 * 1024 * 1024;

    public const int MaxThumbnailBytes = 200 * 1024;

    public ElementBoard Board() => workspace.Board;

    public Element Get(ElementId id) => workspace.Board.Find(id);

    public Element Create(
        ElementKind kind, string? otherKind, string name, IReadOnlyList<ElementAttribute>? attributes, BoardPosition? position, string origin)
    {
        var element = workspace.ChangeBoard((board, repository) =>
        {
            var created = board.Create(kind, otherKind, name, attributes, position, clock.GetUtcNow());
            repository.Save(created);
            return created;
        });
        notifier.ElementsChanged(ElementsChange.None with { Elements = [element], Details = [element] }, origin);
        return element;
    }

    /// <summary>Changes an element. Changing nothing stores and announces nothing.</summary>
    public Element Update(ElementId id, ElementUpdate update, string origin)
    {
        ArgumentNullException.ThrowIfNull(update);

        var (element, changed) = workspace.ChangeBoard((board, repository) =>
        {
            var target = board.InWork(id);
            var before = Snapshot.Of(target);
            if (update.Name is not null)
            {
                target.Rename(update.Name);
            }

            if (update.Kind is { } kind)
            {
                target.ChangeKind(kind, update.OtherKind);
            }
            else if (update.OtherKind is not null && target.Kind == ElementKind.Other)
            {
                target.ChangeKind(ElementKind.Other, update.OtherKind);
            }

            if (update.Aliases is not null)
            {
                target.SetAliases(update.Aliases);
            }

            if (update.Attributes is not null)
            {
                target.SetAttributes(update.Attributes);
            }

            if (update.Description is not null)
            {
                target.Describe(update.Description);
            }

            var hasChanged = before != Snapshot.Of(target);
            if (hasChanged)
            {
                repository.Save(target);
            }

            return (target, hasChanged);
        });

        if (changed)
        {
            notifier.ElementsChanged(ElementsChange.None with { Elements = [element], Details = [element] }, origin);
        }

        return element;
    }

    /// <summary>Sends an element to the trash; its relationships stop being shown and come back with it.</summary>
    public void Delete(ElementId id, string origin)
    {
        var (element, hidden) = workspace.ChangeBoard((board, repository) =>
        {
            var shown = board.Relationships.Where(relationship => relationship.Touches(id)).Select(relationship => relationship.Id).ToList();
            board.Delete(id, clock.GetUtcNow());
            var deleted = board.Find(id);
            repository.Save(deleted);
            return (deleted, shown);
        });
        notifier.ElementsChanged(ElementsChange.None with { Trash = [element], RemovedRelationships = hidden }, origin);
    }

    public Element Restore(ElementId id, string origin)
    {
        var element = workspace.ChangeBoard((board, repository) =>
        {
            board.Restore(id);
            var restored = board.Find(id);
            repository.Save(restored);
            return restored;
        });
        var shown = workspace.Board.Relationships.Where(relationship => relationship.Touches(id)).ToList();
        notifier.ElementsChanged(ElementsChange.None with { Elements = [element], Details = [element], Relationships = shown }, origin);
        return element;
    }

    /// <summary>Moves cards on the board: all of them or none.</summary>
    public void Move(IReadOnlyList<(ElementId Id, BoardPosition Position)> positions, string origin)
    {
        ArgumentNullException.ThrowIfNull(positions);

        var moved = workspace.ChangeBoard((board, repository) =>
        {
            board.Move(positions);
            var elements = positions.Select(move => board.Find(move.Id)).Distinct().ToList();
            repository.SavePositions(elements);
            return elements;
        });
        notifier.ElementsChanged(ElementsChange.None with { Elements = moved }, origin);
    }

    /// <summary>Reads an image the writer chose, so the UI can reduce it: PNG, JPEG or WebP by its signature, and not too large.</summary>
    public StoredImage ReadImage(string path)
    {
        var full = Path.GetFullPath(path);
        var sample = files.Sample(full, FileSignature.HeadLength);
        var mediaType = FileSignature.ImageMediaType(sample.Head)
            ?? throw new DomainException(DomainError.NotAnImage, "The chosen file is not an accepted image.");
        if (sample.Length > MaxChosenImageBytes)
        {
            throw new DomainException(DomainError.FileTooLarge, $"The chosen image is {sample.Length} bytes, over the limit.");
        }

        return new StoredImage(files.Read(full), mediaType);
    }

    /// <summary>Gives an element its image, already reduced by the UI, and its thumbnail: WebP or JPEG.</summary>
    public Element SetImage(ElementId id, ReadOnlyMemory<byte> image, ReadOnlyMemory<byte> thumbnail, string origin)
    {
        var full = Reduced(image, MaxImageBytes, "image");
        var small = Reduced(thumbnail, MaxThumbnailBytes, "thumbnail");
        var element = workspace.ChangeBoard((board, repository) =>
        {
            var target = board.InWork(id);
            target.ReplaceImage(clock.GetUtcNow());
            repository.Save(target);
            repository.SaveImage(target, full, small);
            return target;
        });
        notifier.ElementsChanged(ElementsChange.None with { Elements = [element] }, origin);
        return element;
    }

    public Element RemoveImage(ElementId id, string origin)
    {
        var element = workspace.ChangeBoard((board, repository) =>
        {
            var target = board.InWork(id);
            target.RemoveImage();
            repository.Save(target);
            repository.RemoveImage(id);
            return target;
        });
        notifier.ElementsChanged(ElementsChange.None with { Elements = [element] }, origin);
        return element;
    }

    /// <summary>The image of an element. One without an image is reported as not found.</summary>
    public StoredImage Image(ElementId id, ImageSize size)
    {
        workspace.Board.Find(id);
        return workspace.Session.Elements.LoadImage(id, size)
            ?? throw new DomainException(DomainError.ElementNotFound, $"Element {id} has no image.");
    }

    /// <summary>Joins two elements, writing down a new kind of the writer's first if the choice asks for one.</summary>
    public Relationship Relate(ElementId from, ElementId to, RelationshipKindChoice kind, string origin)
    {
        ArgumentNullException.ThrowIfNull(kind);

        var (relationship, ownKinds) = workspace.ChangeBoard((board, repository) =>
        {
            var (kindId, created) = Resolve(board, repository, kind);
            var related = board.Relate(from, to, kindId, clock.GetUtcNow());
            repository.Save(related);
            return (related, created);
        });
        notifier.ElementsChanged(ElementsChange.None with { Relationships = [relationship], OwnKinds = ownKinds }, origin);
        return relationship;
    }

    public Relationship ChangeRelationship(RelationshipId id, RelationshipKindChoice kind, string origin)
    {
        ArgumentNullException.ThrowIfNull(kind);

        var (relationship, ownKinds) = workspace.ChangeBoard((board, repository) =>
        {
            var (kindId, created) = Resolve(board, repository, kind);
            var changed = board.ChangeKind(id, kindId);
            repository.Save(changed);
            return (changed, created);
        });
        notifier.ElementsChanged(ElementsChange.None with { Relationships = [relationship], OwnKinds = ownKinds }, origin);
        return relationship;
    }

    public void Unrelate(RelationshipId id, string origin)
    {
        workspace.ChangeBoard((board, repository) =>
        {
            board.Unrelate(id);
            repository.Delete(id);
            return id;
        });
        notifier.ElementsChanged(ElementsChange.None with { RemovedRelationships = [id] }, origin);
    }

    private (RelationshipKindId Kind, IReadOnlyList<RelationshipKind> Created) Resolve(
        ElementBoard board, IElementRepository repository, RelationshipKindChoice choice)
    {
        if (choice.Existing is { } existing)
        {
            return (existing, []);
        }

        var known = board.OwnKinds.Count;
        var kind = board.OwnKind(choice.Forward ?? string.Empty, choice.Inverse, clock.GetUtcNow());
        if (board.OwnKinds.Count == known)
        {
            return (kind.KindId, []);
        }

        repository.Save(kind);
        return (kind.KindId, [kind]);
    }

    private static StoredImage Reduced(ReadOnlyMemory<byte> bytes, int maxBytes, string what)
    {
        var head = bytes.Span[..Math.Min(FileSignature.HeadLength, bytes.Length)];
        var mediaType = FileSignature.ImageMediaType(head) is ("image/webp" or "image/jpeg") and var type
            ? type
            : throw new DomainException(DomainError.NotAnImage, $"A reduced {what} must be WebP or JPEG.");
        return bytes.Length <= maxBytes
            ? new StoredImage(bytes, mediaType)
            : throw new DomainException(DomainError.FileTooLarge, $"The reduced {what} is {bytes.Length} bytes, over the limit.");
    }

    /// <summary>What the writer can see of an element, to tell whether an update changed anything.</summary>
    private sealed record Snapshot(string Name, ElementKind Kind, string? OtherKind, string Aliases, string Attributes, DocumentContent Description)
    {
        public static Snapshot Of(Element element) =>
            new(
                element.Name,
                element.Kind,
                element.OtherKind,
                string.Join('\u0001', element.Aliases),
                string.Join('\u0001', element.Attributes.Select(attribute => $"{attribute.Name}\u0002{attribute.Value}")),
                element.Description);
    }
}
