using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Elements;
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

    /// <summary>
    /// Notes changed, and only these: <paramref name="notes"/> are shown as they are now, and
    /// <paramref name="removed"/> stopped being shown (set aside, or gone with their document to the trash).
    /// </summary>
    void NotesChanged(IReadOnlyList<Note> notes, IReadOnlyList<NoteId> removed, string origin);

    void PreferencesChanged(Preferences preferences, string origin);

    void RecentChanged(IReadOnlyList<RecentProjectView> recent, string origin);

    /// <summary>Elements, relationships or kinds of relationship of the open work changed.</summary>
    void ElementsChanged(ElementsChange change, string origin);

    /// <summary>The writer added or removed one of their own images or sounds.</summary>
    void AmbienceChanged(IReadOnlyList<OwnAmbienceView> own, string origin);
}

/// <summary>
/// What changed among the elements, and only that. <see cref="Elements"/> are now in the work and <see cref="Trash"/>
/// went to the trash; <see cref="Details"/> carries whole elements when more than their summary changed.
/// </summary>
public sealed record ElementsChange(
    IReadOnlyList<Element> Elements,
    IReadOnlyList<Element> Trash,
    IReadOnlyList<Element> Details,
    IReadOnlyList<Relationship> Relationships,
    IReadOnlyList<RelationshipId> RemovedRelationships,
    IReadOnlyList<RelationshipKind> OwnKinds)
{
    public static ElementsChange None { get; } = new([], [], [], [], [], []);
}
