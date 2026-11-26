using System.Globalization;
using System.Text;

namespace Rocinante.Domain.Elements;

/// <summary>A mention found in a text: the elements it belongs to, where it starts and how long it is.</summary>
public sealed record FoundMention(IReadOnlyList<ElementId> Elements, int Start, int Length);

/// <summary>
/// Finds the names and aliases of the elements in a text, by the rules in <c>src/contracts/mentions.json</c>,
/// which the interface follows too: whole words; without minding case or accents, but with the ñ as a letter
/// of its own; up to three characters of any kind but letters, digits or line breaks between the words of a
/// name; the longest name wins; a name of one letter is not looked for.
/// </summary>
public sealed class MentionFinder
{
    private const int MaxGap = 3;

    private const char LineFeed = (char)0x0A;

    private const char CarriageReturn = (char)0x0D;

    private const char LineSeparator = (char)0x2028;

    private const char ParagraphSeparator = (char)0x2029;

    private const char CombiningTilde = (char)0x0303;

    private static readonly System.Buffers.SearchValues<char> _lineBreaks =
        System.Buffers.SearchValues.Create([LineFeed, CarriageReturn, LineSeparator, ParagraphSeparator]);

    private readonly Dictionary<string, List<Candidate>> _byFirstWord = new(StringComparer.Ordinal);

    public MentionFinder(IEnumerable<(ElementId Element, IEnumerable<string> Names)> elements)
    {
        ArgumentNullException.ThrowIfNull(elements);

        var byWords = new Dictionary<string, Candidate>(StringComparer.Ordinal);
        foreach (var (element, names) in elements)
        {
            foreach (var name in names)
            {
                var words = Tokens(name).Select(token => token.Folded).ToArray();
                if (words.Sum(word => word.Length) < 2)
                {
                    continue;
                }

                var key = string.Join(' ', words);
                if (!byWords.TryGetValue(key, out var candidate))
                {
                    byWords[key] = candidate = new Candidate(words, []);
                    if (!_byFirstWord.TryGetValue(words[0], out var list))
                    {
                        _byFirstWord[words[0]] = list = [];
                    }

                    list.Add(candidate);
                }

                if (!candidate.Elements.Contains(element))
                {
                    candidate.Elements.Add(element);
                }
            }
        }

        // The longest name is tried first, so it wins over a shorter one that starts the same.
        foreach (var list in _byFirstWord.Values)
        {
            list.Sort((a, b) => b.Words.Length != a.Words.Length
                ? b.Words.Length.CompareTo(a.Words.Length)
                : b.Length.CompareTo(a.Length));
        }
    }

    /// <summary>Whether there is any name to look for.</summary>
    public bool IsEmpty => _byFirstWord.Count == 0;

    public IReadOnlyList<FoundMention> Find(string text)
    {
        ArgumentNullException.ThrowIfNull(text);

        var found = new List<FoundMention>();
        if (IsEmpty)
        {
            return found;
        }

        var tokens = Tokens(text);
        for (var at = 0; at < tokens.Count;)
        {
            var match = _byFirstWord.TryGetValue(tokens[at].Folded, out var candidates)
                ? candidates.FirstOrDefault(candidate => Matches(text, tokens, at, candidate.Words))
                : null;
            if (match is null)
            {
                at++;
                continue;
            }

            var last = tokens[at + match.Words.Length - 1];
            found.Add(new FoundMention(match.Elements, tokens[at].Start, last.End - tokens[at].Start));
            at += match.Words.Length;
        }

        return found;
    }

    private static bool Matches(string text, List<Token> tokens, int at, string[] words)
    {
        if (at + words.Length > tokens.Count)
        {
            return false;
        }

        for (var index = 0; index < words.Length; index++)
        {
            var token = tokens[at + index];
            if (!string.Equals(token.Folded, words[index], StringComparison.Ordinal))
            {
                return false;
            }

            if (index > 0)
            {
                var gap = text.AsSpan(tokens[at + index - 1].End, token.Start - tokens[at + index - 1].End);
                if (gap.Length > MaxGap || gap.IndexOfAny(_lineBreaks) >= 0)
                {
                    return false;
                }
            }
        }

        return true;
    }

    /// <summary>The words of a text: runs of letters, decimal digits and combining marks, folded.</summary>
    private static List<Token> Tokens(string text)
    {
        var tokens = new List<Token>();
        var index = 0;
        while (index < text.Length)
        {
            if (!IsWordChar(text[index]))
            {
                index++;
                continue;
            }

            var start = index;
            while (index < text.Length && IsWordChar(text[index]))
            {
                index++;
            }

            tokens.Add(new Token(start, index, Fold(text.AsSpan(start, index - start))));
        }

        return tokens;
    }

    private static bool IsWordChar(char character) =>
        char.GetUnicodeCategory(character) is UnicodeCategory.UppercaseLetter
            or UnicodeCategory.LowercaseLetter
            or UnicodeCategory.TitlecaseLetter
            or UnicodeCategory.ModifierLetter
            or UnicodeCategory.OtherLetter
            or UnicodeCategory.DecimalDigitNumber
            or UnicodeCategory.NonSpacingMark
            or UnicodeCategory.SpacingCombiningMark
            or UnicodeCategory.EnclosingMark;

    /// <summary>Lowercase and without accents, but the ñ stays a ñ, written whole or as n and a tilde.</summary>
    private static string Fold(ReadOnlySpan<char> word)
    {
        var folded = new StringBuilder(word.Length);
        foreach (var character in word)
        {
            if (character is 'ñ' or 'Ñ')
            {
                folded.Append('ñ');
                continue;
            }

            if (character == CombiningTilde && folded.Length > 0 && folded[^1] == 'n')
            {
                folded[^1] = 'ñ';
                continue;
            }

            foreach (var part in character.ToString().Normalize(NormalizationForm.FormD))
            {
                if (char.GetUnicodeCategory(part) is not (UnicodeCategory.NonSpacingMark
                    or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark))
                {
                    folded.Append(char.ToLowerInvariant(part));
                }
            }
        }

        return folded.ToString();
    }

    private sealed record Token(int Start, int End, string Folded);

    private sealed record Candidate(string[] Words, List<ElementId> Elements)
    {
        public int Length { get; } = Words.Sum(word => word.Length);
    }
}
