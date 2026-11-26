using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Versions;

namespace Rocinante.Application.Ports;

/// <summary>The project and its index.</summary>
public interface IProjectRepository
{
    Project Load();

    /// <summary>Saves the title and the whole index; new entries get an empty text.</summary>
    void Save(Project project);
}

/// <summary>The text of each document.</summary>
public interface IDocumentRepository
{
    Document Load(DocumentId id);

    void Save(Document document);

    /// <summary>Counts of every chapter outside the trash.</summary>
    TextStatistics WorkStatistics();
}

/// <summary>A version as listed, without its text.</summary>
public sealed record VersionSummary(VersionId Id, DocumentId DocumentId, VersionKind Kind, string? Name, DateTimeOffset CreatedAt, TextStatistics Statistics)
{
    public static VersionSummary Of(DocumentVersion version)
    {
        ArgumentNullException.ThrowIfNull(version);
        return new(version.Id, version.DocumentId, version.Kind, version.Name, version.CreatedAt, version.Content.Statistics);
    }
}

/// <summary>Versions are only added, never changed.</summary>
public interface IVersionRepository
{
    void Add(DocumentVersion version);

    /// <summary>Versions of a document, newest first.</summary>
    IReadOnlyList<VersionSummary> List(DocumentId documentId);

    DocumentVersion Load(VersionId id);
}

/// <summary>An image as stored: its bytes and their media type (<c>image/webp</c> or <c>image/jpeg</c>).</summary>
public sealed record StoredImage(ReadOnlyMemory<byte> Data, string MediaType);

/// <summary>The image of an element, whole or as the thumbnail its card shows.</summary>
public enum ImageSize
{
    Full,
    Thumbnail,
}

/// <summary>The elements of the work, their relationships, the writer's kinds of relationship and the images.</summary>
public interface IElementRepository
{
    /// <summary>Everything, in the work and in the trash.</summary>
    ElementBoard LoadBoard();

    /// <summary>Inserts a new element or updates one, with its aliases and attributes.</summary>
    void Save(Element element);

    /// <summary>Stores where the cards of <paramref name="elements"/> sit on the board, and nothing else.</summary>
    void SavePositions(IEnumerable<Element> elements);

    /// <summary>Stores the image of an element under its current <see cref="Element.ImageVersion"/>.</summary>
    void SaveImage(Element element, StoredImage image, StoredImage thumbnail);

    void RemoveImage(ElementId id);

    /// <summary>The stored image of an element, or null if it has none.</summary>
    StoredImage? LoadImage(ElementId id, ImageSize size);

    /// <summary>Stores a kind of relationship the writer wrote; storing one already there changes nothing.</summary>
    void Save(RelationshipKind kind);

    /// <summary>Inserts a new relationship or updates its kind.</summary>
    void Save(Relationship relationship);

    void Delete(RelationshipId id);
}

public interface INoteRepository
{
    /// <summary>Inserts a new note or updates an existing one.</summary>
    void Save(Note note);

    /// <summary>A note, shown or set aside.</summary>
    Note Load(NoteId id);

    /// <summary>
    /// The notes the writer sees, in the order they were written: loose ideas and the notes of the
    /// documents in the work, leaving out those set aside and those of documents in the trash.
    /// </summary>
    IReadOnlyList<Note> ListShown();

    /// <summary>Every note of a document, set aside or not, in the order they were written.</summary>
    IReadOnlyList<Note> ListByDocument(DocumentId documentId);

    /// <summary>Deletes a note for good, with its links. Returns whether it existed.</summary>
    bool Delete(NoteId id);

    /// <summary>Deletes for good every note that was set aside. Returns how many there were.</summary>
    int PurgeDeleted();
}
