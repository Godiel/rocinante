using Rocinante.Domain.Books;
using Rocinante.Domain.Content;

namespace Rocinante.Domain.Tests.Books;

public sealed class BookTests
{
    private static BookChapter Read(string json) => Book.ChapterOf("Uno", DocumentContent.Parse(json));

    [Fact]
    public void Reads_paragraphs_with_their_styles_and_tells_which_follow_another()
    {
        var chapter = Read("""
            {"type":"doc","content":[
              {"type":"paragraph","content":[{"type":"text","text":"En un "},{"type":"text","text":"lugar","marks":[{"type":"italic"}]},{"type":"text","text":" de la Mancha."}]},
              {"type":"paragraph","attrs":{"indent":2},"content":[{"type":"text","text":"Fuerte","marks":[{"type":"bold"},{"type":"underline"}]},{"type":"hardBreak"},{"type":"text","text":"y claro."}]},
              {"type":"paragraph"},
              {"type":"sceneBreak"},
              {"type":"paragraph","content":[{"type":"text","text":"Después."}]}
            ]}
            """);

        chapter.Title.ShouldBe("Uno");
        chapter.Blocks.Count.ShouldBe(4);
        var first = chapter.Blocks[0].ShouldBeOfType<BookParagraph>();
        first.Opens.ShouldBeTrue();
        first.Follows.ShouldBeFalse();
        first.Inlines.ShouldBe([
            new TextRun("En un ", TextStyle.Plain),
            new TextRun("lugar", TextStyle.Italic),
            new TextRun(" de la Mancha.", TextStyle.Plain),
        ]);
        var second = chapter.Blocks[1].ShouldBeOfType<BookParagraph>();
        second.Follows.ShouldBeTrue();
        second.Opens.ShouldBeFalse();
        second.Indent.ShouldBe(2);
        second.Inlines.ShouldBe([new TextRun("Fuerte", TextStyle.Bold | TextStyle.Underline), LineBreak.Instance, new TextRun("y claro.", TextStyle.Plain)]);
        chapter.Blocks[2].ShouldBe(BookSceneBreak.Instance);
        chapter.Blocks[3].ShouldBeOfType<BookParagraph>().Follows.ShouldBeFalse();
    }

    [Fact]
    public void Numbers_the_footnotes_of_a_chapter_and_leaves_out_the_notes_of_the_author()
    {
        var chapter = Read("""
            {"type":"doc","content":[
              {"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Primera salida"}]},
              {"type":"paragraph","content":[{"type":"text","text":"Rocinante","marks":[{"type":"noteAnchor","attrs":{"noteId":"0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b"}}]},{"type":"footnote","attrs":{"text":"Su caballo."}},{"type":"notePoint","attrs":{"noteId":"0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b"}}]},
              {"type":"blockquote","content":[{"type":"paragraph","content":[{"type":"text","text":"Cita"},{"type":"footnote","attrs":{"text":"De un libro."}}]}]},
              {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Uno"}]}]},{"type":"listItem","content":[{"type":"paragraph"}]}]},
              {"type":"orderedList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"Primero"}]}]}]}
            ]}
            """);

        var heading = chapter.Blocks[0].ShouldBeOfType<BookHeading>();
        heading.Level.ShouldBe(2);
        heading.Inlines.ShouldBe([new TextRun("Primera salida", TextStyle.Plain)]);
        chapter.Blocks[1].ShouldBeOfType<BookParagraph>().Inlines.ShouldBe([new TextRun("Rocinante", TextStyle.Plain), new FootnoteCall(1, "Su caballo.")]);
        chapter.Blocks[2].ShouldBeOfType<BookQuote>().Blocks.ShouldHaveSingleItem();
        chapter.Blocks[3].ShouldBeOfType<BookList>().Items.ShouldHaveSingleItem();
        chapter.Blocks[4].ShouldBeOfType<BookList>().Ordered.ShouldBeTrue();
        chapter.Footnotes.ShouldBe([new FootnoteCall(1, "Su caballo."), new FootnoteCall(2, "De un libro.")]);
    }

    [Fact]
    public void The_credits_are_the_authors_or_else_say_who_owns_the_rights()
    {
        var details = BookDetails.Empty.WithAuthor("  Miguel de Cervantes ");

        details.Author.ShouldBe("Miguel de Cervantes");
        details.CreditsFor(1605).ShouldBe("© 1605 Miguel de Cervantes. Todos los derechos reservados.");
        BookDetails.Empty.CreditsFor(2026).ShouldBe("© 2026. Todos los derechos reservados.");
        details.WithCredits("Primera edición.\r\nMadrid").CreditsFor(1605).ShouldBe("Primera edición.\nMadrid");
        details.WithCredits("Primera edición.").WithCredits("  ").Credits.ShouldBeNull();
        Should.Throw<DomainException>(() => details.WithAuthor(new string('a', 201)));
    }

    [Fact]
    public void A_new_cover_never_repeats_a_version()
    {
        var covered = BookDetails.Empty.WithCover();
        covered.CoverVersion.ShouldBe(1);

        var again = covered.WithoutCover().WithCover();
        again.CoverVersion.ShouldBe(2);
        again.WithoutCover().CoverVersion.ShouldBeNull();
    }
}
