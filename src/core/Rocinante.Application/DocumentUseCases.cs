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

    /// <summary>Sends a document to the trash; its notes stop being shown until it comes back.</summary>
    public Project Delete(DocumentId id, string origin)
    {
        var project = ChangeIndex(
            project =>
            {
                project.Delete(id, clock.GetUtcNow());
                return project;
            },
            origin);
        var gone = ShownNotes(id);
        if (gone.Count > 0)
        {
            notifier.NotesChanged([], [.. gone.Select(note => note.Id)], origin);
        }

        return project;
    }

    /// <summary>Brings a document back from the trash, with its notes.</summary>
    public Project Restore(DocumentId id, string origin)
    {
        var project = ChangeIndex(
            project =>
            {
                project.Restore(id);
                return project;
            },
            origin);
        var back = ShownNotes(id);
        if (back.Count > 0)
        {
            notifier.NotesChanged(back, [], origin);
        }

        return project;
    }

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
                notifier.NotesChanged(notes, [], origin);
            }
        }

        return new DocumentSaved(document, result.Changed, work, automatic);
    }

    private List<Note> ShownNotes(DocumentId id) =>
        [.. workspace.Session.Notes.ListByDocument(id).Where(note => !note.IsDeleted)];

    private T ChangeIndex<T>(Func<Project, T> change, string origin)
    {
        var result = workspace.ChangeIndex(change);
        notifier.ProjectChanged(workspace.Snapshot(), origin);
        return result;
    }
}

/// <summary>Keeps each note's anchor, and its place among the others, in step with the text it belongs to.</summary>
internal static class NoteReconciliation
{
    /// <summary>
    /// Stores the notes whose anchor changed, set aside or not. Returns those that are shown, or
    /// null if none of them changed.
    /// </summary>
    public static IReadOnlyList<Note>? Apply(IProjectSession session, DocumentId documentId, DocumentContent content)
    {
        var changed = session.Notes.ListByDocument(documentId).Where(note => note.Reconcile(content)).ToList();
        foreach (var note in changed)
        {
            session.Notes.Save(note);
        }

        var shown = changed.Where(note => !note.IsDeleted).ToList();
        return shown.Count > 0 ? shown : null;
    }
}
