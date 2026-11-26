using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;

namespace Rocinante.Application;

/// <summary>One mention of an element: its place among those of the element in its document, and the text around it.</summary>
public sealed record MentionInText(int Ordinal, string Before, string Text, string After);

/// <summary>The mentions of an element in one document.</summary>
public sealed record DocumentMentions(DocumentId DocumentId, IReadOnlyList<MentionInText> Mentions);

/// <summary>Where the first mention of an element is: its document and its place there.</summary>
public sealed record MentionPlace(DocumentId DocumentId, int Ordinal);

/// <summary>Another element mentioned in the same paragraphs, and in how many.</summary>
public sealed record Coincidence(ElementId ElementId, int Paragraphs);

/// <summary>Every mention of an element in the work, document by document in the order of the index.</summary>
public sealed record ElementReferences(
    int Total,
    int Documents,
    MentionPlace? First,
    IReadOnlyList<DocumentMentions> ByDocument,
    IReadOnlyList<Coincidence> Together);

/// <summary>How many times an element is mentioned in the work, and in how many documents.</summary>
public sealed record MentionCount(ElementId ElementId, int Total, int Documents);

/// <summary>
/// Looks through the documents of the work for the mentions of the elements and for the proper names without
/// a ficha. What a document says only changes when its text or the names do, so each is looked through once
/// per revision and set of names, and kept.
/// </summary>
internal sealed class ReferenceIndex
{
    /// <summary>Characters of text kept on each side of a mention.</summary>
    public const int Around = 60;

    private readonly Dictionary<DocumentId, Looked> _documents = [];
    private string _namesKey = string.Empty;
    private MentionFinder _finder = new([]);

    public ElementReferences Of(ElementId element, ElementBoard board, IEnumerable<DocumentId> documents, IDocumentRepository repository)
    {
        UseNames(board);
        var revisions = repository.Revisions();

        var byDocument = new List<DocumentMentions>();
        var together = new Dictionary<ElementId, int>();
        foreach (var documentId in documents)
        {
            var looked = LookAt(documentId, repository, revisions);
            var mentions = looked.Mentions!.Where(found => found.Elements.Contains(element)).ToList();
            if (mentions.Count == 0)
            {
                continue;
            }

            byDocument.Add(new DocumentMentions(
                documentId,
                [.. mentions.Select((found, ordinal) => new MentionInText(ordinal, found.Before, found.Text, found.After))]));

            foreach (var block in mentions.Select(found => found.Block).Distinct())
            {
                var others = looked.Mentions!
                    .Where(found => found.Block == block)
                    .SelectMany(found => found.Elements)
                    .Where(other => other != element)
                    .Distinct();
                foreach (var other in others)
                {
                    together[other] = together.GetValueOrDefault(other) + 1;
                }
            }
        }

        var first = byDocument.Count > 0 ? new MentionPlace(byDocument[0].DocumentId, 0) : null;
        return new ElementReferences(
            byDocument.Sum(document => document.Mentions.Count),
            byDocument.Count,
            first,
            byDocument,
            [.. together
                .OrderByDescending(pair => pair.Value)
                .ThenBy(pair => pair.Key.Value)
                .Select(pair => new Coincidence(pair.Key, pair.Value))]);
    }

    /// <summary>The mentions of every element in the work at once, for the cards of the board.</summary>
    public IReadOnlyList<MentionCount> Counts(ElementBoard board, IEnumerable<DocumentId> documents, IDocumentRepository repository)
    {
        UseNames(board);
        var revisions = repository.Revisions();

        var totals = board.Elements.ToDictionary(element => element.Id, _ => (Total: 0, Documents: 0));
        foreach (var documentId in documents)
        {
            var here = new Dictionary<ElementId, int>();
            foreach (var found in LookAt(documentId, repository, revisions).Mentions!)
            {
                foreach (var element in found.Elements)
                {
                    here[element] = here.GetValueOrDefault(element) + 1;
                }
            }

            foreach (var (element, count) in here)
            {
                if (totals.TryGetValue(element, out var total))
                {
                    totals[element] = (total.Total + count, total.Documents + 1);
                }
            }
        }

        return [.. totals.Select(pair => new MentionCount(pair.Key, pair.Value.Total, pair.Value.Documents))];
    }

    /// <summary>
    /// The threads of the chosen elements through the chapters: how many times each is mentioned in each chapter,
    /// and how many paragraphs of a chapter mention two of them together.
    /// </summary>
    public (IReadOnlyList<FateThread> Threads, IReadOnlyList<ThreadMeeting> Meetings) Threads(
        ElementBoard board, IReadOnlyList<DocumentId> chapters, IReadOnlyList<ElementId> chosen, IDocumentRepository repository)
    {
        UseNames(board);
        var revisions = repository.Revisions();
        var place = chosen.Select((id, index) => (id, index)).ToDictionary(pair => pair.id, pair => pair.index);
        var points = chosen.ToDictionary(id => id, _ => new List<ThreadPoint>());
        var meetings = new List<ThreadMeeting>();

        foreach (var chapter in chapters)
        {
            var mentions = new Dictionary<ElementId, int>();
            var blocks = new Dictionary<int, HashSet<ElementId>>();
            foreach (var found in LookAt(chapter, repository, revisions).Mentions!)
            {
                foreach (var element in found.Elements.Where(place.ContainsKey))
                {
                    mentions[element] = mentions.GetValueOrDefault(element) + 1;
                    if (!blocks.TryGetValue(found.Block, out var here))
                    {
                        blocks[found.Block] = here = [];
                    }

                    here.Add(element);
                }
            }

            foreach (var (element, count) in mentions)
            {
                points[element].Add(new ThreadPoint(chapter, count));
            }

            var pairs = new Dictionary<(ElementId First, ElementId Second), int>();
            foreach (var here in blocks.Values.Where(set => set.Count > 1))
            {
                var ordered = here.OrderBy(element => place[element]).ToList();
                for (var first = 0; first < ordered.Count; first++)
                {
                    for (var second = first + 1; second < ordered.Count; second++)
                    {
                        var pair = (ordered[first], ordered[second]);
                        pairs[pair] = pairs.GetValueOrDefault(pair) + 1;
                    }
                }
            }

            meetings.AddRange(pairs
                .OrderBy(pair => place[pair.Key.First])
                .ThenBy(pair => place[pair.Key.Second])
                .Select(pair => new ThreadMeeting(chapter, pair.Key.First, pair.Key.Second, pair.Value)));
        }

        return ([.. chosen.Select(id => new FateThread(id, points[id]))], meetings);
    }

    /// <summary>The proper names of the work that no element is called and the writer did not dismiss.</summary>
    public IReadOnlyList<NameSuggestion> Suggestions(
        ElementBoard board, IEnumerable<DocumentId> documents, IDocumentRepository repository, IReadOnlySet<string> dismissed)
    {
        UseNames(board);
        var revisions = repository.Revisions();

        var known = new HashSet<string>(dismissed, StringComparer.Ordinal);
        foreach (var element in board.Elements)
        {
            known.Add(MentionFinder.Key(element.Name));
            foreach (var alias in element.Aliases)
            {
                known.Add(MentionFinder.Key(alias));
            }
        }

        return NameSuggester.Suggest(documents.SelectMany(document => LookAt(document, repository, revisions).Names), known);
    }

    private void UseNames(ElementBoard board)
    {
        var elements = board.Elements
            .Select(element => (element.Id, Names: (IReadOnlyList<string>)[element.Name, .. element.Aliases]))
            .ToList();
        var key = string.Join('\u0001', elements.Select(element => $"{element.Id}\u0002{string.Join('\u0002', element.Names)}"));
        if (key == _namesKey)
        {
            return;
        }

        _namesKey = key;
        _finder = new MentionFinder(elements.Select(element => (element.Id, (IEnumerable<string>)element.Names)));
        // The proper names of a text do not depend on the elements, but the mentions do.
        foreach (var documentId in _documents.Keys.ToList())
        {
            _documents[documentId] = _documents[documentId] with { Mentions = null };
        }
    }

    private Looked LookAt(DocumentId documentId, IDocumentRepository repository, IReadOnlyDictionary<DocumentId, long> revisions)
    {
        var revision = revisions.GetValueOrDefault(documentId, -1);
        if (_documents.TryGetValue(documentId, out var known) && known.Revision == revision && known.Mentions is not null)
        {
            return known;
        }

        var content = repository.Load(documentId).Content;
        var names = known?.Revision == revision ? known.Names : NameSuggester.Occurrences(content.Blocks);
        var looked = new Looked(revision, Find(content), names);
        _documents[documentId] = looked;
        return looked;
    }

    private List<Found> Find(DocumentContent content)
    {
        var found = new List<Found>();
        if (_finder.IsEmpty)
        {
            return found;
        }

        for (var block = 0; block < content.Blocks.Count; block++)
        {
            var text = content.Blocks[block];
            foreach (var mention in _finder.Find(text))
            {
                var end = mention.Start + mention.Length;
                found.Add(new Found(
                    mention.Elements,
                    block,
                    Before(text, mention.Start),
                    text.Substring(mention.Start, mention.Length),
                    After(text, end)));
            }
        }

        return found;
    }

    /// <summary>Up to <see cref="Around"/> characters before a mention, starting at a whole word.</summary>
    private static string Before(string block, int start)
    {
        if (start <= Around)
        {
            return block[..start];
        }

        var piece = block[(start - Around)..start];
        var space = piece.IndexOf(' ', StringComparison.Ordinal);
        return space >= 0 ? piece[(space + 1)..] : piece;
    }

    /// <summary>Up to <see cref="Around"/> characters after a mention, ending at a whole word.</summary>
    private static string After(string block, int end)
    {
        if (block.Length - end <= Around)
        {
            return block[end..];
        }

        var piece = block[end..(end + Around)];
        var space = piece.LastIndexOf(' ');
        return space > 0 ? piece[..space] : piece;
    }

    private sealed record Found(IReadOnlyList<ElementId> Elements, int Block, string Before, string Text, string After);

    /// <summary>What a revision of a document says; its mentions are null once the names change.</summary>
    private sealed record Looked(long Revision, List<Found>? Mentions, IReadOnlyList<(string Key, string Written)> Names);
}
