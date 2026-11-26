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

/// <summary>Every mention of an element in the work, document by document in the order of the index.</summary>
public sealed record ElementReferences(int Total, int Documents, MentionPlace? First, IReadOnlyList<DocumentMentions> ByDocument);

/// <summary>
/// Finds the mentions of the elements in the documents of the work. What a document says only changes when
/// its text or the names do, so each is looked through once per revision and set of names, and kept.
/// </summary>
internal sealed class ReferenceIndex
{
    /// <summary>Characters of text kept on each side of a mention.</summary>
    public const int Around = 60;

    private readonly Dictionary<DocumentId, (long Revision, IReadOnlyList<Found> Mentions)> _documents = [];
    private string _namesKey = string.Empty;
    private MentionFinder _finder = new([]);

    public ElementReferences Of(ElementId element, ElementBoard board, IEnumerable<DocumentId> documents, IDocumentRepository repository)
    {
        UseNames(board);

        var byDocument = new List<DocumentMentions>();
        foreach (var documentId in documents)
        {
            var mentions = MentionsIn(documentId, repository)
                .Where(found => found.Elements.Contains(element))
                .Select((found, ordinal) => new MentionInText(ordinal, found.Before, found.Text, found.After))
                .ToList();
            if (mentions.Count > 0)
            {
                byDocument.Add(new DocumentMentions(documentId, mentions));
            }
        }

        var first = byDocument.Count > 0 ? new MentionPlace(byDocument[0].DocumentId, 0) : null;
        return new ElementReferences(byDocument.Sum(document => document.Mentions.Count), byDocument.Count, first, byDocument);
    }

    /// <summary>Forgets what it found, as when another work opens.</summary>
    public void Clear()
    {
        _documents.Clear();
        _namesKey = string.Empty;
        _finder = new MentionFinder([]);
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
        _documents.Clear();
    }

    private IReadOnlyList<Found> MentionsIn(DocumentId documentId, IDocumentRepository repository)
    {
        var document = repository.Load(documentId);
        if (_documents.TryGetValue(documentId, out var known) && known.Revision == document.Revision)
        {
            return known.Mentions;
        }

        var mentions = Find(document.Content);
        _documents[documentId] = (document.Revision, mentions);
        return mentions;
    }

    private List<Found> Find(DocumentContent content)
    {
        var found = new List<Found>();
        if (_finder.IsEmpty)
        {
            return found;
        }

        foreach (var block in content.Blocks)
        {
            foreach (var mention in _finder.Find(block))
            {
                var end = mention.Start + mention.Length;
                found.Add(new Found(
                    mention.Elements,
                    Before(block, mention.Start),
                    block.Substring(mention.Start, mention.Length),
                    After(block, end)));
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

    private sealed record Found(IReadOnlyList<ElementId> Elements, string Before, string Text, string After);
}
