namespace Rocinante.Domain.Content;

/// <summary>
/// Counts shown to the writer. Notes never contribute: their text lives outside the document.
/// </summary>
/// <param name="Words">Runs of text separated by spaces or dashes that contain a letter or digit.</param>
/// <param name="Characters">User-perceived characters (grapheme clusters), spaces included.</param>
/// <param name="Paragraphs">Text blocks (paragraphs, headings, list items…) that are not blank.</param>
public readonly record struct TextStatistics(int Words, int Characters, int Paragraphs)
{
    public static TextStatistics Zero { get; } = new(0, 0, 0);

    public static TextStatistics operator +(TextStatistics left, TextStatistics right) =>
        new(
            left.Words + right.Words,
            left.Characters + right.Characters,
            left.Paragraphs + right.Paragraphs);

    public static TextStatistics Add(TextStatistics left, TextStatistics right) => left + right;
}
