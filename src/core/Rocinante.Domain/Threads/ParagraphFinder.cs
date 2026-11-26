namespace Rocinante.Domain.Threads;

/// <summary>
/// Finds, among the paragraphs of a document, the one a piece of text was: the same text, or else the paragraph
/// that kept most of its words, the nearest to where it was. A paragraph rewritten little by little is followed;
/// one rewritten whole is not found, rather than taken for another.
/// </summary>
public static class ParagraphFinder
{
    /// <summary>
    /// The share of its words a paragraph has to keep to still be itself: half, so that a paragraph split in two
    /// goes on in the half that kept the most, or the first one.
    /// </summary>
    public const double Kept = 0.5;

    /// <summary>A paragraph of fewer words is only found by its exact text: a few words are in many paragraphs.</summary>
    public const int FewWords = 3;

    /// <summary>The place of the paragraph in <paramref name="blocks"/>, or null if none is it any longer.</summary>
    public static int? Find(IReadOnlyList<string> blocks, string paragraph, int near)
    {
        ArgumentNullException.ThrowIfNull(blocks);
        ArgumentNullException.ThrowIfNull(paragraph);
        var wanted = paragraph.Trim();

        int? exact = null;
        for (var index = 0; index < blocks.Count; index++)
        {
            if (blocks[index].Trim() == wanted && (exact is null || Math.Abs(index - near) < Math.Abs(exact.Value - near)))
            {
                exact = index;
            }
        }

        if (exact is not null)
        {
            return exact;
        }

        var words = Words(wanted);
        if (words.Count < FewWords)
        {
            return null;
        }

        int? best = null;
        var bestScore = 0.0;
        for (var index = 0; index < blocks.Count; index++)
        {
            var other = Words(blocks[index]);
            if (other.Count == 0)
            {
                continue;
            }

            var score = (double)words.Count(other.Contains) / words.Count;
            var better = score > bestScore || (score == bestScore && best is not null && Math.Abs(index - near) < Math.Abs(best.Value - near));
            if (score >= Kept && better)
            {
                best = index;
                bestScore = score;
            }
        }

        return best;
    }

    /// <summary>The different words of a text, without case.</summary>
    public static HashSet<string> Words(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var words = new HashSet<string>(StringComparer.Ordinal);
        var start = -1;
        for (var index = 0; index <= text.Length; index++)
        {
            var inWord = index < text.Length && char.IsLetterOrDigit(text[index]);
            if (inWord && start < 0)
            {
                start = index;
            }
            else if (!inWord && start >= 0)
            {
                words.Add(text[start..index].ToLowerInvariant());
                start = -1;
            }
        }

        return words;
    }
}
