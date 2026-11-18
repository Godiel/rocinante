using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;

namespace Rocinante.Application.Ports;

/// <summary>
/// Announces every change to all windows, so they stay in sync. <c>origin</c> is the window that
/// asked for the change: it already shows it and may ignore the announcement.
/// </summary>
public interface IChangeNotifier
{
    /// <summary>A project was created, opened or saved under a new path.</summary>
    void ProjectOpened(ProjectSnapshot project, string origin);

    /// <summary>The title or the index of the open project changed.</summary>
    void ProjectChanged(ProjectSnapshot project, string origin);

    void ProjectClosed(string origin);

    void DocumentChanged(Document document, TextStatistics work, string origin);

    void VersionsChanged(DocumentId documentId, string origin);

    void NotesChanged(DocumentId documentId, IReadOnlyList<Note> notes, string origin);
}
