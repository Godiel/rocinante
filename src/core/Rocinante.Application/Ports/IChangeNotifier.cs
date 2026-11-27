using Rocinante.Application.Settings;
using Rocinante.Application.Squire;
using Rocinante.Domain;
using Rocinante.Domain.Books;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Squire;
using Rocinante.Domain.Threads;

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

    /// <summary>The squire changed: its state, new proposals, or proposals no longer waiting.</summary>
    void SquireChanged(SquireState state, IReadOnlyList<Proposal> proposals, IReadOnlyList<ProposalId> removed, string origin);

    /// <summary>The writer's own dictionary changed.</summary>
    void DictionaryChanged(IReadOnlyList<string> words, string origin);

    /// <summary>A suggested name was dismissed: every window asks for the suggestions again.</summary>
    void SuggestionsChanged(string origin);

    /// <summary>The writer chose other elements to show in the threads.</summary>
    void ThreadsChanged(IReadOnlyList<ElementId> chosen, string origin);

    /// <summary>Milestones were made, changed or followed their paragraph, or were removed.</summary>
    void MilestonesChanged(IReadOnlyList<Milestone> milestones, IReadOnlyList<MilestoneId> removed, string origin);

    /// <summary>The author, the credits or the cover of the book changed.</summary>
    void BookChanged(BookDetails details, string origin);

    /// <summary>An export wrote <paramref name="done"/> chapters out of <paramref name="total"/>.</summary>
    void ExportProgress(ExportId id, int done, int total, string origin);

    /// <summary>An export ended: the book is at <paramref name="path"/>, or <paramref name="problem"/> says why it is not.</summary>
    void ExportFinished(ExportId id, string? path, long bytes, DomainError? problem, string origin);

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
