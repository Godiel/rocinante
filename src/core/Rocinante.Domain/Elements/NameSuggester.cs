namespace Rocinante.Domain.Elements;

/// <summary>A proper name the text repeats, as it is most often written, and how many times.</summary>
public sealed record NameSuggestion(string Name, int Count);

/// <summary>
/// Finds the proper names a text repeats, to suggest them as fichas: a word with a capital letter that does
/// not start a sentence, or several in a row joined by «de», «del», «la», «las» or «los». A name
/// counts only inside a sentence: the words that start one are left out, since every sentence starts with
/// a capital.
/// </summary>
public static class NameSuggester
{
    public const int MinimumCount = 3;

    public const int MaxSuggestions = 20;

    /// <summary>Longest name suggested, in words.</summary>
    private const int MaxWords = 6;

    private static readonly HashSet<string> _connectors = new(StringComparer.Ordinal) { "de", "del", "la", "las", "los" };

    /// <summary>What opens a sentence or a speech: a capital after these starts something, not a name.</summary>
    private static readonly System.Buffers.SearchValues<char> _openers = System.Buffers.SearchValues.Create(".!?¡¿…—«“\":;");

    /// <param name="blocks">The paragraphs of the work.</param>
    /// <param name="known">Keys (<see cref="MentionFinder.Key"/>) of names not to suggest: those of the fichas and the dismissed.</param>
    public static IReadOnlyList<NameSuggestion> Suggest(IEnumerable<string> blocks, IReadOnlySet<string> known) =>
        Suggest(Occurrences(blocks), known);

    /// <summary>Every proper name inside the sentences of some paragraphs: its key and how it is written there.</summary>
    public static IReadOnlyList<(string Key, string Written)> Occurrences(IEnumerable<string> blocks)
    {
        ArgumentNullException.ThrowIfNull(blocks);
        return [.. blocks.SelectMany(NamesIn)];
    }

    /// <summary>The suggestions from names already found, leaving out the <paramref name="known"/> ones.</summary>
    public static IReadOnlyList<NameSuggestion> Suggest(IEnumerable<(string Key, string Written)> occurrences, IReadOnlySet<string> known)
    {
        ArgumentNullException.ThrowIfNull(occurrences);
        ArgumentNullException.ThrowIfNull(known);

        var found = new Dictionary<string, Dictionary<string, int>>(StringComparer.Ordinal);
        foreach (var (key, written) in occurrences)
        {
            if (known.Contains(key))
            {
                continue;
            }

            if (!found.TryGetValue(key, out var forms))
            {
                found[key] = forms = new Dictionary<string, int>(StringComparer.Ordinal);
            }

            forms[written] = forms.GetValueOrDefault(written) + 1;
        }

        return [.. found.Values
            .Select(forms => new NameSuggestion(
                forms.OrderByDescending(form => form.Value).ThenBy(form => form.Key, StringComparer.Ordinal).First().Key,
                forms.Values.Sum()))
            .Where(suggestion => suggestion.Count >= MinimumCount)
            .OrderByDescending(suggestion => suggestion.Count)
            .ThenBy(suggestion => suggestion.Name, StringComparer.Ordinal)
            .Take(MaxSuggestions)];
    }

    /// <summary>The proper names inside the sentences of one paragraph: their key and how they are written.</summary>
    private static IEnumerable<(string Key, string Written)> NamesIn(string block)
    {
        var tokens = MentionFinder.Tokens(block);
        var at = 0;
        while (at < tokens.Count)
        {
            // The word that starts a sentence is left out; a name right after it still counts.
            if (!IsCapitalized(block, tokens[at]) || StartsSentence(block, tokens, at))
            {
                at++;
                continue;
            }

            // A run of capitalized words, with connectors between them, and only spaces in between.
            var last = at;
            var next = at + 1;
            while (next < tokens.Count && next - at < MaxWords && OnlySpaceBetween(block, tokens[next - 1], tokens[next]))
            {
                if (IsCapitalized(block, tokens[next]))
                {
                    last = next;
                    next++;
                }
                else if (_connectors.Contains(tokens[next].Folded))
                {
                    next++;
                }
                else
                {
                    break;
                }
            }

            var words = tokens.Skip(at).Take(last - at + 1).ToList();
            if (words.Sum(word => word.Folded.Length) >= 2)
            {
                yield return (
                    string.Join(' ', words.Select(word => word.Folded)),
                    block[tokens[at].Start..tokens[last].End]);
            }

            at = last + 1;
        }
    }

    private static bool IsCapitalized(string block, MentionFinder.Token token) =>
        char.IsUpper(block[token.Start]) && token.End - token.Start >= 2;

    private static bool OnlySpaceBetween(string block, MentionFinder.Token before, MentionFinder.Token after) =>
        block.AsSpan(before.End, after.Start - before.End) is var gap && gap.Length > 0 && gap.Trim().IsEmpty;

    private static bool StartsSentence(string block, List<MentionFinder.Token> tokens, int at)
    {
        var from = at == 0 ? 0 : tokens[at - 1].End;
        var gap = block.AsSpan(from, tokens[at].Start - from);
        return at == 0 || gap.IndexOfAny(_openers) >= 0;
    }
}
