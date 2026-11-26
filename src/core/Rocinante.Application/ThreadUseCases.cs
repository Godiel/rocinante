using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Threads;

namespace Rocinante.Application;

/// <summary>A chapter where an element is mentioned, and how many times.</summary>
public sealed record ThreadPoint(DocumentId DocumentId, int Mentions);

/// <summary>The thread of an element: the chapters where it is mentioned, in reading order.</summary>
public sealed record FateThread(ElementId ElementId, IReadOnlyList<ThreadPoint> Points);

/// <summary>Two elements mentioned in the same paragraphs of a chapter, and in how many.</summary>
public sealed record ThreadMeeting(DocumentId DocumentId, ElementId First, ElementId Second, int Paragraphs);

/// <summary>The threads of the chosen elements through the chapters of the work.</summary>
public sealed record ThreadsView(
    IReadOnlyList<ElementId> Chosen,
    IReadOnlyList<DocumentEntry> Chapters,
    IReadOnlyList<FateThread> Threads,
    IReadOnlyList<ThreadMeeting> Meetings,
    IReadOnlyList<Milestone> Milestones);

/// <summary>
/// The threads of fate: where each chosen element is through the chapters, whom it meets, and what happens to
/// it. What the text says comes from the index of mentions; the milestones are the writer's.
/// </summary>
public sealed class ThreadUseCases(Workspace workspace, ElementUseCases elements, IChangeNotifier notifier, TimeProvider clock)
{
    /// <summary>The characters shown until the writer chooses: the ones mentioned the most.</summary>
    public const int ShownAtFirst = 5;

    public const int MaxChosen = 50;

    public ThreadsView Get()
    {
        var board = workspace.Board;
        var chapters = workspace.Project.Chapters;
        var chosen = Chosen();
        var (threads, meetings) = elements.Index.Threads(
            board, [.. chapters.Select(chapter => chapter.Id)], chosen, workspace.Session.Documents);

        var shown = chosen.ToHashSet();
        var order = Places(chapters);
        var milestones = workspace.Session.Threads.Milestones()
            .Where(milestone => shown.Contains(milestone.ElementId) && order.ContainsKey(milestone.DocumentId))
            .OrderBy(milestone => order[milestone.DocumentId])
            .ThenBy(milestone => milestone.Block)
            .ThenBy(milestone => milestone.CreatedAt)
            .ToList();
        return new ThreadsView(chosen, chapters, threads, meetings, milestones);
    }

    /// <summary>The elements shown, in order; until the writer chooses, the characters mentioned the most.</summary>
    public IReadOnlyList<ElementId> Chosen()
    {
        var board = workspace.Board;
        if (workspace.Session.Threads.Chosen() is { } chosen)
        {
            return [.. chosen.Where(id => board.Elements.Any(element => element.Id == id))];
        }

        var mentions = elements.BoardMentions().ToDictionary(count => count.ElementId, count => count.Total);
        return [.. board.Elements
            .Where(element => element.Kind == ElementKind.Character)
            .OrderByDescending(element => mentions.GetValueOrDefault(element.Id))
            .ThenBy(element => element.Name, StringComparer.CurrentCultureIgnoreCase)
            .Take(ShownAtFirst)
            .Select(element => element.Id)];
    }

    public void Choose(IReadOnlyList<ElementId> chosen, string origin)
    {
        ArgumentNullException.ThrowIfNull(chosen);
        if (chosen.Count > MaxChosen)
        {
            throw new ArgumentException($"At most {MaxChosen} elements are shown in the threads.", nameof(chosen));
        }

        var board = workspace.Board;
        foreach (var id in chosen)
        {
            board.InWork(id);
        }

        var session = workspace.Session;
        var kept = chosen.Distinct().ToList();
        session.InTransaction(() =>
        {
            session.Threads.Choose(kept);
            return kept;
        });
        notifier.ThreadsChanged(kept, origin);
    }

    /// <summary>
    /// Marks what happens to an element at a paragraph of a document, given by its text. If the text is not yet in
    /// what was saved of the document, the next save finds it.
    /// </summary>
    public Milestone Mark(ElementId element, DocumentId document, string paragraph, string text, string origin)
    {
        ArgumentNullException.ThrowIfNull(paragraph);
        workspace.Board.InWork(element);
        workspace.ActiveEntry(document);

        var session = workspace.Session;
        var blocks = session.Documents.Load(document).Content.Blocks;
        var now = clock.GetUtcNow();
        var milestone = ParagraphFinder.Find(blocks, paragraph, 0) is { } place
            ? Milestone.Create(element, document, blocks[place], place, text, now)
            : Milestone.Create(element, document, paragraph, 0, text, now);

        session.InTransaction(() =>
        {
            session.Threads.Save(milestone);
            return milestone;
        });
        notifier.MilestonesChanged([milestone], [], origin);
        return milestone;
    }

    public Milestone Rename(MilestoneId id, string text, string origin)
    {
        var milestone = Find(id);
        milestone.Rename(text);
        var session = workspace.Session;
        session.InTransaction(() =>
        {
            session.Threads.Save(milestone);
            return milestone;
        });
        notifier.MilestonesChanged([milestone], [], origin);
        return milestone;
    }

    public void Remove(MilestoneId id, string origin)
    {
        Find(id);
        var session = workspace.Session;
        session.InTransaction(() =>
        {
            session.Threads.Delete(id);
            return id;
        });
        notifier.MilestonesChanged([], [id], origin);
    }

    /// <summary>The place of each chapter in reading order, to tell when a relationship holds.</summary>
    public Func<DocumentId, int?> ChapterAt()
    {
        var order = Places(workspace.Project.Chapters);
        return id => order.TryGetValue(id, out var place) ? place : null;
    }

    private Milestone Find(MilestoneId id) =>
        workspace.Session.Threads.Milestones().FirstOrDefault(milestone => milestone.Id == id)
        ?? throw new DomainException(DomainError.MilestoneNotFound, $"Milestone {id} does not exist.");

    private static Dictionary<DocumentId, int> Places(IReadOnlyList<DocumentEntry> chapters) =>
        chapters.Select((chapter, place) => (chapter.Id, place)).ToDictionary(pair => pair.Id, pair => pair.place);
}

/// <summary>
/// After a document is saved, each of its milestones looks for its paragraph again: as the text changes little
/// by little, it follows it.
/// </summary>
internal static class MilestoneReconciliation
{
    public static List<Milestone> Apply(IProjectSession session, DocumentId documentId, IReadOnlyList<string> blocks)
    {
        var moved = new List<Milestone>();
        foreach (var milestone in session.Threads.Milestones().Where(milestone => milestone.DocumentId == documentId))
        {
            if (milestone.Follow(blocks))
            {
                session.Threads.Save(milestone);
                moved.Add(milestone);
            }
        }

        return moved;
    }
}
