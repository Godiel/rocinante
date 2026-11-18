using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
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

public interface INoteRepository
{
    /// <summary>Inserts a new note or updates an existing one.</summary>
    void Save(Note note);

    Note Load(NoteId id);

    /// <summary>Notes of a document, in the order they were written.</summary>
    IReadOnlyList<Note> ListByDocument(DocumentId documentId);

    /// <summary>Deletes a note for good. Returns whether it existed.</summary>
    bool Delete(NoteId id);
}
