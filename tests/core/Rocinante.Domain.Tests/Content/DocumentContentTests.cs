using Rocinante.Domain.Content;
using static Rocinante.Domain.Tests.Contents;

namespace Rocinante.Domain.Tests.Content;

public sealed class DocumentContentTests
{
    [Fact]
    public void Keeps_the_json_exactly_as_received()
    {
        const string json = """{ "type": "doc", "content": [] }""";

        DocumentContent.Parse(json).Json.ShouldBe(json);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("""{"content":[]}""")]
    [InlineData("""{"type":"paragraph"}""")]
    [InlineData("""{"type":7}""")]
    public void Rejects_anything_that_is_not_a_tiptap_document(string json)
    {
        Should.Throw<DomainException>(() => DocumentContent.Parse(json)).Error.ShouldBe(DomainError.InvalidContent);
    }

    [Fact]
    public void The_empty_document_has_nothing_to_count()
    {
        DocumentContent.Empty.Statistics.ShouldBe(TextStatistics.Zero);
        DocumentContent.Empty.NoteAnchors.ShouldBeEmpty();
    }

    [Fact]
    public void Equality_ignores_formatting_and_key_order()
    {
        var compact = DocumentContent.Parse("""{"type":"doc","content":[{"type":"paragraph"}]}""");
        var spaced = DocumentContent.Parse("""{ "content": [ { "type": "paragraph" } ], "type": "doc" }""");

        spaced.ShouldBe(compact);
        spaced.Equals((object)compact).ShouldBeTrue();
        spaced.GetHashCode().ShouldBe(compact.GetHashCode());
    }

    [Fact]
    public void Different_text_is_different_content()
    {
        Paragraphs("En un lugar").ShouldNotBe(Paragraphs("En un lugar de la Mancha"));
        Paragraphs("En un lugar").Equals(null).ShouldBeFalse();
    }

    [Fact]
    public void Counts_words_characters_and_paragraphs()
    {
        var content = Paragraphs("En un lugar de la Mancha,", "de cuyo nombre no quiero acordarme");

        content.Statistics.ShouldBe(new TextStatistics(Words: 12, Characters: 59, Paragraphs: 2));
    }

    [Fact]
    public void Text_split_by_formatting_is_still_one_word()
    {
        var content = Doc(Block("paragraph", Text("Rocin"), Text("ante", Mark("bold"))));

        content.Statistics.Words.ShouldBe(1);
        content.Statistics.Characters.ShouldBe(9);
    }

    [Fact]
    public void Dialogue_dashes_and_punctuation_do_not_count_as_words()
    {
        var content = Paragraphs("—¿Quién va? —dijo Sancho—. ¡Ea! … — «Ven».");

        content.Statistics.Words.ShouldBe(6);
    }

    [Fact]
    public void Blank_paragraphs_are_not_counted()
    {
        var content = Doc(Block("paragraph"), Paragraph("   "), Paragraph("Fin"));

        content.Statistics.ShouldBe(new TextStatistics(Words: 1, Characters: 3, Paragraphs: 1));
    }

    [Fact]
    public void Headings_and_nested_blocks_count_as_paragraphs()
    {
        var content = Doc(
            Block("heading", Text("Capítulo primero")),
            new System.Text.Json.Nodes.JsonObject
            {
                ["type"] = "blockquote",
                ["content"] = new System.Text.Json.Nodes.JsonArray(Paragraph("Una cita"), Paragraph("en dos párrafos")),
            });

        content.Statistics.Paragraphs.ShouldBe(3);
        content.Statistics.Words.ShouldBe(7);
    }

    [Fact]
    public void A_hard_break_separates_words_without_adding_characters()
    {
        var content = Doc(Block("paragraph", Text("verso"), HardBreak(), Text("verso")));

        content.Statistics.ShouldBe(new TextStatistics(Words: 2, Characters: 10, Paragraphs: 1));
    }

    [Fact]
    public void Characters_are_counted_as_the_reader_sees_them()
    {
        // "ñ" written as n + combining tilde, and an emoji made of two UTF-16 units.
        var content = Paragraphs("año \U0001F40E");

        content.Statistics.Characters.ShouldBe(5);
    }

    [Fact]
    public void Finds_passage_and_point_anchors()
    {
        var passage = NoteId.New(Moments.At(0));
        var point = NoteId.New(Moments.At(1));

        var content = Doc(Block("paragraph", Text("revisar esta fecha", AnchorMark(passage)), AnchorNode(point)));

        content.NoteAnchors.ShouldBe([passage, point], ignoreOrder: true);
    }

    [Fact]
    public void Anchors_do_not_change_the_counts()
    {
        var note = NoteId.New(Moments.Start);
        var plain = Paragraphs("aquí Antonio aún no conoce a Claudio");
        var annotated = Doc(Block("paragraph", Text("aquí Antonio aún no conoce a Claudio", AnchorMark(note))));

        annotated.Statistics.ShouldBe(plain.Statistics);
    }

    [Fact]
    public void Footnotes_count_as_words_of_the_work_but_not_as_paragraphs()
    {
        var content = Doc(Block("paragraph", Text("Rocinante"), Footnote("Rocín antes, ahora primero."), Text(" y Sancho")));

        content.Statistics.ShouldBe(new TextStatistics(Words: 7, Characters: 45, Paragraphs: 1));
    }

    [Fact]
    public void A_paragraph_with_only_a_point_anchor_or_a_blank_footnote_is_not_counted()
    {
        var content = Doc(Block("paragraph", AnchorNode(NoteId.New(Moments.Start))), Block("paragraph", Footnote("   ")));

        content.Statistics.ShouldBe(TextStatistics.Zero);
    }

    [Fact]
    public void Ignores_anchors_without_a_valid_note_id()
    {
        var broken = new System.Text.Json.Nodes.JsonObject
        {
            ["type"] = DocumentContent.NoteAnchorType,
            ["attrs"] = new System.Text.Json.Nodes.JsonObject { ["noteId"] = "not-a-guid" },
        };

        Doc(Block("paragraph", Text("texto", broken))).NoteAnchors.ShouldBeEmpty();
    }

    [Fact]
    public void Statistics_add_up()
    {
        var total = new TextStatistics(1, 2, 3) + new TextStatistics(10, 20, 30);

        total.ShouldBe(new TextStatistics(11, 22, 33));
        TextStatistics.Add(total, TextStatistics.Zero).ShouldBe(total);
    }
}
