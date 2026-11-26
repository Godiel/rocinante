namespace Rocinante.Domain.Threads;

/// <summary>
/// Something that happens to an element at a paragraph of a chapter: «muere su padre». It belongs to its
/// paragraph and follows it as the text changes; when the paragraph is gone it stays in its chapter, lost, for the
/// writer to decide.
/// </summary>
public sealed class Milestone
{
    public const int MaxTextLength = 300;

    /// <summary>The longest paragraph a milestone keeps, to find it again.</summary>
    public const int MaxParagraphLength = 20000;

    private Milestone(
        MilestoneId id, ElementId elementId, DocumentId documentId, string paragraph, int block, string text, bool lost, DateTimeOffset createdAt)
    {
        Id = id;
        ElementId = elementId;
        DocumentId = documentId;
        Paragraph = paragraph;
        Block = block;
        Text = text;
        Lost = lost;
        CreatedAt = createdAt;
    }

    public MilestoneId Id { get; }

    public ElementId ElementId { get; }

    public DocumentId DocumentId { get; }

    /// <summary>The text of its paragraph, as it was last found.</summary>
    public string Paragraph { get; private set; }

    /// <summary>The place of its paragraph in the document, as it was last found.</summary>
    public int Block { get; private set; }

    public string Text { get; private set; }

    /// <summary>Whether its paragraph is no longer in the document.</summary>
    public bool Lost { get; private set; }

    public DateTimeOffset CreatedAt { get; }

    /// <summary>A milestone at the paragraph <paramref name="block"/> of a document, whose text is <paramref name="paragraph"/>.</summary>
    public static Milestone Create(ElementId elementId, DocumentId documentId, string paragraph, int block, string text, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(paragraph);
        ArgumentOutOfRangeException.ThrowIfNegative(block);
        return new Milestone(MilestoneId.New(now), elementId, documentId, Kept(paragraph), block, Valid(text), lost: false, now);
    }

    /// <summary>Rebuilds a milestone from storage.</summary>
    public static Milestone Rehydrate(
        MilestoneId id, ElementId elementId, DocumentId documentId, string paragraph, int block, string text, bool lost, DateTimeOffset createdAt) =>
        new(id, elementId, documentId, paragraph, block, text, lost, createdAt);

    /// <summary>Says something else of what happens.</summary>
    public void Rename(string text) => Text = Valid(text);

    /// <summary>
    /// Looks for its paragraph among the paragraphs of its document as they are now. Returns whether anything of
    /// it changed: the paragraph, its place, or whether it is lost.
    /// </summary>
    public bool Follow(IReadOnlyList<string> blocks)
    {
        ArgumentNullException.ThrowIfNull(blocks);
        if (!Lost && Block < blocks.Count && blocks[Block] == Paragraph)
        {
            return false;
        }

        var found = ParagraphFinder.Find(blocks, Paragraph, Block);
        if (found is not { } place)
        {
            var wasLost = Lost;
            Lost = true;
            return !wasLost;
        }

        var paragraph = Kept(blocks[place]);
        var changed = Lost || place != Block || paragraph != Paragraph;
        Lost = false;
        Block = place;
        Paragraph = paragraph;
        return changed;
    }

    private static string Kept(string paragraph) =>
        paragraph.Length <= MaxParagraphLength ? paragraph : paragraph[..MaxParagraphLength];

    private static string Valid(string text)
    {
        var trimmed = text?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            throw new DomainException(DomainError.MilestoneTextRequired, "A milestone says what happens.");
        }

        return trimmed.Length <= MaxTextLength
            ? trimmed
            : throw new DomainException(DomainError.MilestoneTextRequired, $"A milestone says it in at most {MaxTextLength} characters.");
    }
}
