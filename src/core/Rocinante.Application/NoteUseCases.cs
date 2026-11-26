using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Notes;

namespace Rocinante.Application;

/// <summary>What changes in a note; null leaves that part as it is.</summary>
public sealed record NoteUpdate(DocumentContent? Content = null, bool? Resolved = null, IReadOnlyList<ElementId>? Elements = null);

/// <summary>The notes of the work: loose ideas and the notes of its documents.</summary>
public sealed class NoteUseCases(Workspace workspace, IChangeNotifier notifier, TimeProvider clock)
{
    /// <summary>Every note the writer sees, in the order they were written.</summary>
    public IReadOnlyList<Note> All() => workspace.Session.Notes.ListShown();

    /// <summary>
    /// Creates a note on a document in the work, or a loose idea when <paramref name="documentId"/>
    /// is null, linked with elements in the work.
    /// </summary>
    public Note Create(DocumentId? documentId, DocumentContent content, bool anchored, IReadOnlyList<ElementId> elements, string origin)
    {
        ArgumentNullException.ThrowIfNull(elements);
        if (documentId is { } document)
        {
            workspace.ActiveEntry(document);
        }

        EnsureInWork(elements, []);
        var note = Note.Create(documentId, content, anchored, elements, clock.GetUtcNow());
        Store(note);
        notifier.NotesChanged([note], [], origin);
        return note;
    }

    /// <summary>Changes a note. Changing nothing stores and announces nothing.</summary>
    public Note Update(NoteId id, NoteUpdate update, string origin)
    {
        ArgumentNullException.ThrowIfNull(update);

        var note = Shown(id);
        var now = clock.GetUtcNow();
        var changed = false;
        if (update.Content is { } content)
        {
            changed |= note.Edit(content, now);
        }

        if (update.Resolved is { } resolved)
        {
            changed |= resolved ? note.Resolve(now) : note.Reopen(now);
        }

        if (update.Elements is { } elements)
        {
            EnsureInWork(elements, note.Elements);
            changed |= note.LinkWith(elements, now);
        }

        if (changed)
        {
            Store(note);
            notifier.NotesChanged([note], [], origin);
        }

        return note;
    }

    /// <summary>Sets a note aside, waiting for an undo; it is deleted for good the next time the work is opened.</summary>
    public void Delete(NoteId id, string origin)
    {
        var note = Shown(id);
        note.Delete(clock.GetUtcNow());
        Store(note);
        notifier.NotesChanged([], [note.Id], origin);
    }

    /// <summary>Brings back a note that was set aside.</summary>
    public Note Restore(NoteId id, string origin)
    {
        var note = workspace.Session.Notes.Load(id);
        if (note.DocumentId is { } document)
        {
            workspace.ActiveEntry(document);
        }

        note.Restore();
        Store(note);
        notifier.NotesChanged([note], [], origin);
        return note;
    }

    /// <summary>A note that is shown: not set aside, and not on a document in the trash.</summary>
    private Note Shown(NoteId id)
    {
        var note = workspace.Session.Notes.Load(id);
        if (note.DocumentId is { } document)
        {
            workspace.ActiveEntry(document);
        }

        return note.IsDeleted
            ? throw new DomainException(DomainError.NoteIsDeleted, $"Note {id} is deleted.")
            : note;
    }

    /// <summary>Elements newly linked must be in the work; those already linked may have gone to the trash since.</summary>
    private void EnsureInWork(IReadOnlyList<ElementId> elements, IReadOnlyList<ElementId> alreadyLinked)
    {
        foreach (var element in elements.Except(alreadyLinked))
        {
            workspace.Board.InWork(element);
        }
    }

    private void Store(Note note)
    {
        var session = workspace.Session;
        session.InTransaction(() =>
        {
            session.Notes.Save(note);
            return note;
        });
    }
}
