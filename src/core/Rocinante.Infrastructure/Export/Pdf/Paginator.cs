namespace Rocinante.Infrastructure.Export.Pdf;

/// <summary>The lines <c>From</c>…<c>To</c> (excluded) of a block of a chapter, on a page.</summary>
internal sealed record BlockSlice(int Block, int From, int To);

/// <summary>The lines <c>From</c>…<c>To</c> (excluded) of a footnote of a chapter, at the foot of a page.</summary>
internal sealed record NoteSlice(SetFootnote Note, int From, int To);

internal sealed class SetPage(int chapter, bool opensChapter)
{
    public int Chapter { get; } = chapter;

    public bool OpensChapter { get; } = opensChapter;

    public List<BlockSlice> Slices { get; } = [];

    public List<NoteSlice> Notes { get; } = [];
}

/// <summary>
/// Shares the set blocks of the chapters out among pages, with the rules of the page view (layout.ts):
/// <list type="bullet">
/// <item>every chapter on a new page, its title lowered;</item>
/// <item>no single line at the foot or the head of a page;</item>
/// <item>a title with at least two lines of what follows;</item>
/// <item>a footnote at the foot of the page where it is called, going on at the next one if it does not fit.</item>
/// </list>
/// </summary>
internal sealed class Paginator(double textHeight, double chapterSink, double footnoteRule)
{
    /// <summary>Lines kept together at either side of a cut, and after a title.</summary>
    private const int Keep = 2;

    private readonly List<SetPage> _pages = [];
    private SetPage _page = null!;
    private double _used;
    private double _notesUsed;
    private List<(SetFootnote Note, int From)> _carried = [];

    public IReadOnlyList<SetPage> Pages => _pages;

    private double Room => textHeight - _used - _notesUsed;

    public void Chapter(int chapter, IReadOnlyList<SetBlock> blocks)
    {
        NewPage(chapter, opens: true);
        for (var index = 0; index < blocks.Count; index++)
        {
            var block = blocks[index];
            var next = index + 1 < blocks.Count ? blocks[index + 1] : null;
            var start = 0;
            while (start < block.Lines.Count)
            {
                var atTop = _page.Slices.Count == 0;
                var space = atTop ? 0 : block.SpaceBefore;
                var remaining = block.Lines.Count - start;
                int count;
                if (block.Unbreakable || block.KeepWithNext)
                {
                    var needed = space + Sum(block.Lines, 0, block.Lines.Count) + NotesOf(block, 0)
                        + (block.KeepWithNext && next is not null ? next.SpaceBefore + Sum(next.Lines, 0, Math.Min(Keep, next.Lines.Count)) : 0);
                    count = needed <= Room || atTop ? remaining : 0;
                }
                else
                {
                    var fit = Fitting(block, start, space);
                    count = Math.Min(fit, remaining);
                    if (count < remaining)
                    {
                        if (start == 0 && count < Keep)
                        {
                            count = 0;
                        }

                        if (remaining - count < Keep && count > 0)
                        {
                            count = Math.Max(0, remaining - Keep);
                        }

                        if (start == 0 && count < Keep)
                        {
                            count = 0;
                        }
                    }

                    if (count == 0 && atTop)
                    {
                        count = Math.Max(1, Math.Min(fit, remaining));
                    }
                }

                if (count == 0)
                {
                    NewPage(chapter, opens: false);
                    continue;
                }

                _used += space + Sum(block.Lines, start, start + count);
                _page.Slices.Add(new BlockSlice(index, start, start + count));
                foreach (var note in block.Footnotes.Where(note => note.Line >= start && note.Line < start + count))
                {
                    PlaceNote(note, 0);
                }

                start += count;
                if (start < block.Lines.Count)
                {
                    NewPage(chapter, opens: false);
                }
            }
        }

        // The notes of a chapter end with it: what is left goes on pages of its own.
        while (_carried.Count > 0)
        {
            NewPage(chapter, opens: false);
        }
    }

    private void NewPage(int chapter, bool opens)
    {
        _page = new SetPage(chapter, opens);
        _pages.Add(_page);
        _used = opens ? chapterSink : 0;
        _notesUsed = 0;
        var waiting = _carried;
        _carried = [];
        foreach (var (note, from) in waiting)
        {
            PlaceNote(note, from);
        }
    }

    /// <summary>As much of a note as fits at the foot of the page, at least a line; the rest waits.</summary>
    private void PlaceNote(SetFootnote note, int from)
    {
        var rule = _page.Notes.Count == 0 ? footnoteRule : 0;
        var count = 0;
        var height = rule;
        while (from + count < note.Lines.Count && height + note.Lines[from + count].Height <= Room)
        {
            height += note.Lines[from + count].Height;
            count++;
        }

        count = Math.Max(1, count);
        _page.Notes.Add(new NoteSlice(note, from, from + count));
        _notesUsed += rule + Sum(note.Lines, from, from + count);
        if (from + count < note.Lines.Count)
        {
            _carried.Add((note, from + count));
        }
    }

    private double NotesOf(SetBlock block, int line)
    {
        var called = block.Footnotes.Where(note => note.Line == line).ToList();
        return called.Count == 0 ? 0 : (_page.Notes.Count == 0 ? footnoteRule : 0) + called.Sum(note => Sum(note.Lines, 0, note.Lines.Count));
    }

    private int Fitting(SetBlock block, int start, double space)
    {
        var height = space;
        var count = 0;
        for (var line = start; line < block.Lines.Count; line++)
        {
            height += block.Lines[line].Height;
            var notes = block.Footnotes.Where(note => note.Line == line).ToList();
            var firstLines = notes.Count > 0 ? (_page.Notes.Count == 0 ? footnoteRule : 0) + notes.Sum(note => note.Lines[0].Height) : 0;
            if (height + firstLines > Room)
            {
                break;
            }

            count++;
        }

        return count;
    }

    private static double Sum(IReadOnlyList<SetLine> lines, int from, int to)
    {
        var total = 0.0;
        for (var index = from; index < to; index++)
        {
            total += lines[index].Height;
        }

        return total;
    }
}
