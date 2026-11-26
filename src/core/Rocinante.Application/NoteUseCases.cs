using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Notes;

namespace Rocinante.Application;

/// <summary>Creating, editing, deleting and listing the notes of a document.</summary>
public sealed class NoteUseCases(Workspace workspace, IChangeNotifier notifier, TimeProvider clock)
{
    public Note Create(DocumentId documentId, string text, bool anchored, string origin)
    {
        workspace.ActiveEntry(documentId);
        var note = Note.Create(documentId, DocumentContent.FromPlainText(text), anchored, [], clock.GetUtcNow());
        return Store(note, origin);
    }

    public Note Update(NoteId id, string text, string origin)
    {
        var note = workspace.Session.Notes.Load(id);
        note.Edit(DocumentContent.FromPlainText(text), clock.GetUtcNow());
        return Store(note, origin);
    }

    public void Delete(NoteId id, string origin)
    {
        var session = workspace.Session;
        var note = session.Notes.Load(id);
        session.InTransaction(() => session.Notes.Delete(id));
        notifier.NotesChanged(note.DocumentId!.Value, session.Notes.ListByDocument(note.DocumentId.Value), origin);
    }

    public IReadOnlyList<Note> List(DocumentId documentId)
    {
        workspace.Project.Find(documentId);
        return workspace.Session.Notes.ListByDocument(documentId);
    }

    private Note Store(Note note, string origin)
    {
        var session = workspace.Session;
        session.InTransaction(() =>
        {
            session.Notes.Save(note);
            return note;
        });
        notifier.NotesChanged(note.DocumentId!.Value, session.Notes.ListByDocument(note.DocumentId.Value), origin);
        return note;
    }
}
