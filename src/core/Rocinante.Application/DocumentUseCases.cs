using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Projects;

namespace Rocinante.Application;

/// <summary>Outcome of saving a document's text.</summary>
public sealed record DocumentSaved(Document Document, bool Changed, TextStatistics Work, VersionSummary? AutomaticVersion);

/// <summary>The index (create, rename, move, delete, restore) and the text of each document.</summary>
public sealed class DocumentUseCases(Workspace workspace, IChangeNotifier notifier, TimeProvider clock)
{
    public DocumentEntry Create(DocumentKind kind, string title, int? position, string origin) =>
        ChangeIndex(
            project => kind == DocumentKind.Chapter
                ? project.AddChapter(title, clock.GetUtcNow(), position)
                : project.AddFragment(title, clock.GetUtcNow(), position),
            origin);

    public DocumentEntry Rename(DocumentId id, string title, string origin) =>
        ChangeIndex(
            project =>
            {
                project.RenameDocument(id, title);
                return project.Find(id);
            },
            origin);

    /// <summary>Reorders a document, or converts it when <paramref name="kind"/> is not its current kind.</summary>
    public Project Move(DocumentId id, DocumentKind kind, int position, string origin) =>
        ChangeIndex(
            project =>
            {
                project.Move(id, kind, position);
                return project;
            },
            origin);

    public Project Delete(DocumentId id, string origin) =>
        ChangeIndex(
            project =>
            {
                project.Delete(id, clock.GetUtcNow());
                return project;
            },
            origin);

    public Project Restore(DocumentId id, string origin) =>
        ChangeIndex(
            project =>
            {
                project.Restore(id);
                return project;
            },
            origin);

    public Document Get(DocumentId id)
    {
        workspace.Project.Find(id);
        return workspace.Session.Documents.Load(id);
    }

    /// <summary>
    /// Saves new text in one transaction with what it brings along: the automatic version if one is
    /// due, and the notes whose anchor appeared or disappeared.
    /// </summary>
    public DocumentSaved Save(DocumentId id, string contentJson, string origin)
    {
        workspace.ActiveEntry(id);
        var content = DocumentContent.Parse(contentJson);
        var session = workspace.Session;

        var (document, result, notes) = session.InTransaction(() =>
        {
            var document = session.Documents.Load(id);
            var result = document.Save(content, clock.GetUtcNow());
            if (!result.Changed)
            {
                return (document, result, (IReadOnlyList<Note>?)null);
            }

            session.Documents.Save(document);
            if (result.AutomaticVersion is { } version)
            {
                session.Versions.Add(version);
            }

            return (document, result, NoteReconciliation.Apply(session, id, content));
        });

        var work = session.Documents.WorkStatistics();
        var automatic = result.AutomaticVersion is { } created ? VersionSummary.Of(created) : null;
        if (result.Changed)
        {
            notifier.DocumentChanged(document, work, origin);
            if (automatic is not null)
            {
                notifier.VersionsChanged(id, origin);
            }

            if (notes is not null)
            {
                notifier.NotesChanged(id, notes, origin);
            }
        }

        return new DocumentSaved(document, result.Changed, work, automatic);
    }

    private T ChangeIndex<T>(Func<Project, T> change, string origin)
    {
        var result = workspace.ChangeIndex(change);
        notifier.ProjectChanged(workspace.Snapshot(), origin);
        return result;
    }
}

/// <summary>Keeps each note's anchored flag in step with the text it belongs to.</summary>
internal static class NoteReconciliation
{
    /// <summary>Stores the notes whose state changed. Returns every note of the document if any did, or null.</summary>
    public static IReadOnlyList<Note>? Apply(IProjectSession session, DocumentId documentId, DocumentContent content)
    {
        var notes = session.Notes.ListByDocument(documentId);
        var changed = notes.Where(note => note.Reconcile(content)).ToList();
        foreach (var note in changed)
        {
            session.Notes.Save(note);
        }

        return changed.Count > 0 ? notes : null;
    }
}
