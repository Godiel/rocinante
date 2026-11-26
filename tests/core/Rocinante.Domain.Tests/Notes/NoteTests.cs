using Rocinante.Domain.Content;
using Rocinante.Domain.Notes;
using static Rocinante.Domain.Tests.Contents;

namespace Rocinante.Domain.Tests.Notes;

public sealed class NoteTests
{
    private readonly DocumentId _documentId = DocumentId.New(Moments.Start);
    private readonly ElementId _antonio = ElementId.New(Moments.At(1));
    private readonly ElementId _claudio = ElementId.New(Moments.At(2));

    private Note OnTheDocument(string text = "revisar esta fecha", bool anchored = true) =>
        Note.Create(_documentId, Paragraphs(text), anchored, [], Moments.At(1));

    private static Note Idea(string text = "un final en el Toboso") =>
        Note.Create(documentId: null, Paragraphs(text), anchored: false, [], Moments.At(1));

    [Fact]
    public void A_note_belongs_to_a_document()
    {
        var note = OnTheDocument();

        note.DocumentId.ShouldBe(_documentId);
        note.Text.ShouldBe("revisar esta fecha");
        note.IsAnchored.ShouldBeTrue();
        note.AnchorOrder.ShouldBeNull();
        note.IsResolved.ShouldBeFalse();
        note.IsDeleted.ShouldBeFalse();
        note.Elements.ShouldBeEmpty();
        note.CreatedAt.ShouldBe(Moments.At(1));
        note.UpdatedAt.ShouldBe(Moments.At(1));
    }

    [Fact]
    public void A_loose_idea_belongs_to_no_document_and_is_never_anchored()
    {
        var idea = Note.Create(documentId: null, Paragraphs("un final en el Toboso"), anchored: true, [], Moments.At(1));

        idea.DocumentId.ShouldBeNull();
        idea.IsAnchored.ShouldBeFalse();
        idea.Reconcile(Doc(Block("paragraph", Text("texto", AnchorMark(idea.Id))))).ShouldBeFalse();
        idea.IsAnchored.ShouldBeFalse();
    }

    [Fact]
    public void The_text_of_a_note_is_its_words_with_one_line_per_paragraph()
    {
        var content = Doc(Block("paragraph", Text("Aquí Antonio "), Text("aún", Mark("italic")), Text(" no")), Paragraph("conoce a Claudio"));

        var note = Note.Create(_documentId, content, anchored: false, [], Moments.At(1));

        note.Content.ShouldBe(content);
        note.Text.ShouldBe("Aquí Antonio aún no\nconoce a Claudio");
    }

    [Theory]
    [InlineData]
    [InlineData("  ", " ")]
    public void A_note_needs_some_text(params string[] paragraphs)
    {
        Should.Throw<DomainException>(() => Note.Create(_documentId, Paragraphs(paragraphs), anchored: false, [], Moments.Start))
            .Error.ShouldBe(DomainError.NoteTextRequired);
        Should.Throw<DomainException>(() => OnTheDocument().Edit(Paragraphs(paragraphs), Moments.At(5)))
            .Error.ShouldBe(DomainError.NoteTextRequired);
    }

    [Fact]
    public void A_note_has_a_length_limit()
    {
        Should.Throw<DomainException>(() => OnTheDocument(new string('a', Note.MaxTextLength + 1)))
            .Error.ShouldBe(DomainError.NoteTextTooLong);
        OnTheDocument(new string('a', Note.MaxTextLength)).Text.Length.ShouldBe(Note.MaxTextLength);
    }

    [Fact]
    public void Editing_changes_the_content_and_the_update_time()
    {
        var note = OnTheDocument("Antonio no conoce a Claudio");

        note.Edit(Paragraphs("Aquí Antonio aún no conoce a Claudio"), Moments.At(5)).ShouldBeTrue();

        note.Text.ShouldBe("Aquí Antonio aún no conoce a Claudio");
        note.UpdatedAt.ShouldBe(Moments.At(5));
        note.CreatedAt.ShouldBe(Moments.At(1));
    }

    [Fact]
    public void Editing_to_the_same_content_changes_nothing()
    {
        var note = OnTheDocument();

        note.Edit(Paragraphs("revisar esta fecha"), Moments.At(5)).ShouldBeFalse();

        note.UpdatedAt.ShouldBe(Moments.At(1));
    }

    [Fact]
    public void A_note_is_resolved_and_reopened()
    {
        var note = OnTheDocument();

        note.Resolve(Moments.At(3)).ShouldBeTrue();
        note.Resolve(Moments.At(4)).ShouldBeFalse();
        note.ResolvedAt.ShouldBe(Moments.At(3));
        note.IsResolved.ShouldBeTrue();

        note.Reopen(Moments.At(5)).ShouldBeTrue();
        note.Reopen(Moments.At(6)).ShouldBeFalse();
        note.ResolvedAt.ShouldBeNull();
        note.UpdatedAt.ShouldBe(Moments.At(5));
    }

    [Fact]
    public void A_note_links_with_several_elements_each_once()
    {
        var note = Note.Create(_documentId, Paragraphs("aquí Antonio aún no conoce a Claudio"), anchored: true, [_antonio, _claudio, _antonio], Moments.At(1));

        note.Elements.ShouldBe([_antonio, _claudio]);

        note.LinkWith([_claudio], Moments.At(4)).ShouldBeTrue();
        note.Elements.ShouldBe([_claudio]);
        note.UpdatedAt.ShouldBe(Moments.At(4));
        note.LinkWith([_claudio, _claudio], Moments.At(5)).ShouldBeFalse();
        note.LinkWith([], Moments.At(6)).ShouldBeTrue();
        note.Elements.ShouldBeEmpty();
    }

    [Fact]
    public void A_note_links_with_at_most_fifty_elements()
    {
        var many = Enumerable.Range(0, Note.MaxElements + 1).Select(minute => ElementId.New(Moments.At(minute))).ToList();

        Should.Throw<ArgumentException>(() => Idea().LinkWith(many, Moments.At(2)));
        Idea().LinkWith(many.Take(Note.MaxElements), Moments.At(2)).ShouldBeTrue();
    }

    [Fact]
    public void A_deleted_note_is_set_aside_and_restored_as_it_was()
    {
        var note = OnTheDocument();
        note.Resolve(Moments.At(2));

        note.Delete(Moments.At(3));
        note.IsDeleted.ShouldBeTrue();
        note.DeletedAt.ShouldBe(Moments.At(3));

        note.Restore();
        note.IsDeleted.ShouldBeFalse();
        note.ResolvedAt.ShouldBe(Moments.At(2));
        note.Text.ShouldBe("revisar esta fecha");
    }

    [Fact]
    public void A_deleted_note_cannot_change_until_it_is_restored()
    {
        var note = OnTheDocument();
        note.Delete(Moments.At(3));

        Should.Throw<DomainException>(() => note.Edit(Paragraphs("otra"), Moments.At(4))).Error.ShouldBe(DomainError.NoteIsDeleted);
        Should.Throw<DomainException>(() => note.Resolve(Moments.At(4))).Error.ShouldBe(DomainError.NoteIsDeleted);
        Should.Throw<DomainException>(() => note.Reopen(Moments.At(4))).Error.ShouldBe(DomainError.NoteIsDeleted);
        Should.Throw<DomainException>(() => note.LinkWith([_antonio], Moments.At(4))).Error.ShouldBe(DomainError.NoteIsDeleted);
        Should.Throw<DomainException>(() => note.Delete(Moments.At(4))).Error.ShouldBe(DomainError.NoteIsDeleted);
    }

    [Fact]
    public void Only_a_deleted_note_can_be_restored()
    {
        Should.Throw<DomainException>(() => OnTheDocument().Restore()).Error.ShouldBe(DomainError.NoteIsNotDeleted);
    }

    [Fact]
    public void A_note_becomes_loose_when_its_passage_is_deleted()
    {
        var note = OnTheDocument();
        note.Reconcile(Doc(Block("paragraph", Text("el pasaje", AnchorMark(note.Id))))).ShouldBeTrue();

        note.Reconcile(Paragraphs("El pasaje ya no está")).ShouldBeTrue();

        note.IsAnchored.ShouldBeFalse();
        note.AnchorOrder.ShouldBeNull();
    }

    [Fact]
    public void Undoing_the_deletion_anchors_it_again()
    {
        var note = OnTheDocument(anchored: false);

        note.Reconcile(Doc(Block("paragraph", Text("el pasaje", AnchorMark(note.Id))))).ShouldBeTrue();

        note.IsAnchored.ShouldBeTrue();
        note.AnchorOrder.ShouldBe(0);
    }

    [Fact]
    public void A_point_anchor_also_keeps_the_note_anchored()
    {
        var note = OnTheDocument("aquí");

        note.Reconcile(Doc(Block("paragraph", Text("antes"), AnchorNode(note.Id)))).ShouldBeTrue();
        note.Reconcile(Doc(Block("paragraph", Text("antes"), AnchorNode(note.Id)))).ShouldBeFalse();

        note.IsAnchored.ShouldBeTrue();
    }

    [Fact]
    public void The_order_of_a_note_is_where_its_anchor_falls_among_the_others()
    {
        var note = OnTheDocument();
        var before = NoteId.New(Moments.At(5));
        var after = NoteId.New(Moments.At(6));

        note.Reconcile(Doc(
            Block("paragraph", Text("uno", AnchorMark(before)), Text("dos", AnchorMark(note.Id))),
            Block("paragraph", AnchorNode(after), Text("tres", AnchorMark(note.Id))))).ShouldBeTrue();
        note.AnchorOrder.ShouldBe(1);

        note.Reconcile(Doc(Block("paragraph", Text("dos", AnchorMark(note.Id)), Text("uno", AnchorMark(before))))).ShouldBeTrue();
        note.AnchorOrder.ShouldBe(0);
    }

    [Fact]
    public void Anchors_of_other_notes_do_not_count()
    {
        var note = OnTheDocument("mía");
        var other = NoteId.New(Moments.At(2));

        note.Reconcile(Doc(Block("paragraph", Text("texto", AnchorMark(other))))).ShouldBeTrue();

        note.IsAnchored.ShouldBeFalse();
    }

    [Fact]
    public void Rehydrating_keeps_every_value()
    {
        var id = NoteId.New(Moments.Start);
        var content = Paragraphs("texto");

        var note = Note.Rehydrate(
            id,
            _documentId,
            content,
            legacyText: "texto",
            isAnchored: true,
            anchorOrder: 3,
            resolvedAt: Moments.At(3),
            elements: [_claudio, _antonio],
            createdAt: Moments.At(1),
            updatedAt: Moments.At(2),
            deletedAt: Moments.At(4));

        note.Id.ShouldBe(id);
        note.DocumentId.ShouldBe(_documentId);
        note.Content.ShouldBe(content);
        note.IsAnchored.ShouldBeTrue();
        note.AnchorOrder.ShouldBe(3);
        note.ResolvedAt.ShouldBe(Moments.At(3));
        note.Elements.ShouldBe([_claudio, _antonio]);
        note.CreatedAt.ShouldBe(Moments.At(1));
        note.UpdatedAt.ShouldBe(Moments.At(2));
        note.DeletedAt.ShouldBe(Moments.At(4));
    }

    [Fact]
    public void A_note_written_before_formatting_reads_as_one_paragraph_per_line()
    {
        var note = Note.Rehydrate(
            NoteId.New(Moments.Start),
            _documentId,
            content: null,
            legacyText: "revisar esta fecha\r\n\naquí Antonio aún no conoce a Claudio",
            isAnchored: false,
            anchorOrder: null,
            resolvedAt: null,
            elements: [],
            createdAt: Moments.At(1),
            updatedAt: Moments.At(1),
            deletedAt: null);

        note.Content.ShouldBe(Paragraphs("revisar esta fecha", "aquí Antonio aún no conoce a Claudio"));
        note.Text.ShouldBe("revisar esta fecha\naquí Antonio aún no conoce a Claudio");
    }

    [Fact]
    public void Plain_text_without_any_line_becomes_an_empty_paragraph()
    {
        DocumentContent.FromPlainText(" \n ").ShouldBe(DocumentContent.Empty);
    }
}
