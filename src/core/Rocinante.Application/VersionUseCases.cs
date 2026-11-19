using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Versions;

namespace Rocinante.Application;

/// <summary>Outcome of restoring a version: the document as it is now, and the version of what it had before.</summary>
public sealed record VersionRestored(Document Document, VersionSummary? Before);

/// <summary>Saving, listing, reading and restoring versions of a document.</summary>
public sealed class VersionUseCases(Workspace workspace, IChangeNotifier notifier, TimeProvider clock)
{
    public VersionSummary Create(DocumentId documentId, string? name, string origin)
    {
        workspace.ActiveEntry(documentId);
        var session = workspace.Session;

        var version = session.InTransaction(() =>
        {
            var document = session.Documents.Load(documentId);
            var version = document.SaveVersion(name, clock.GetUtcNow());
            session.Versions.Add(version);
            session.Documents.Save(document);
            return version;
        });

        notifier.VersionsChanged(documentId, origin);
        return VersionSummary.Of(version);
    }

    public IReadOnlyList<VersionSummary> List(DocumentId documentId)
    {
        workspace.Project.Find(documentId);
        return workspace.Session.Versions.List(documentId);
    }

    public DocumentVersion Get(VersionId id) => workspace.Session.Versions.Load(id);

    /// <summary>Brings back the text of a version; the current text is saved first so nothing is lost.</summary>
    public VersionRestored Restore(VersionId id, string origin)
    {
        var session = workspace.Session;
        var version = session.Versions.Load(id);
        workspace.ActiveEntry(version.DocumentId);

        var (document, before, notes) = session.InTransaction(() =>
        {
            var document = session.Documents.Load(version.DocumentId);
            var before = document.Restore(version, clock.GetUtcNow());
            if (before is null)
            {
                return (document, before, (IReadOnlyList<Note>?)null);
            }

            session.Versions.Add(before);
            session.Documents.Save(document);
            return (document, before, NoteReconciliation.Apply(session, document.Id, document.Content));
        });

        if (before is not null)
        {
            notifier.DocumentChanged(document, session.Documents.WorkStatistics(), origin);
            notifier.VersionsChanged(document.Id, origin);
            if (notes is not null)
            {
                notifier.NotesChanged(document.Id, notes, origin);
            }
        }

        return new VersionRestored(document, before is null ? null : VersionSummary.Of(before));
    }
}
