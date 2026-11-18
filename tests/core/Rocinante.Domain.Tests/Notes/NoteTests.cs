using Rocinante.Domain.Notes;
using static Rocinante.Domain.Tests.Contents;

namespace Rocinante.Domain.Tests.Notes;

public sealed class NoteTests
{
    private readonly DocumentId _documentId = DocumentId.New(Moments.Start);

    [Fact]
    public void A_note_belongs_to_a_document()
    {
        var note = Note.Create(_documentId, "revisar esta fecha", anchored: true, Moments.At(1));

        note.DocumentId.ShouldBe(_documentId);
        note.Text.ShouldBe("revisar esta fecha");
        note.IsAnchored.ShouldBeTrue();
        note.CreatedAt.ShouldBe(Moments.At(1));
        note.UpdatedAt.ShouldBe(Moments.At(1));
    }

    [Theory]
    [InlineData("")]
    [InlineData("  \n ")]
    public void A_note_needs_some_text(string text)
    {
        Should.Throw<DomainException>(() => Note.Create(_documentId, text, anchored: false, Moments.Start))
            .Error.ShouldBe(DomainError.NoteTextRequired);
    }

    [Fact]
    public void A_note_has_a_length_limit()
    {
        Should.Throw<DomainException>(() => Note.Create(_documentId, new string('a', Note.MaxTextLength + 1), anchored: false, Moments.Start))
            .Error.ShouldBe(DomainError.NoteTextTooLong);
    }

    [Fact]
    public void Editing_changes_the_text_and_the_update_time()
    {
        var note = Note.Create(_documentId, "Antonio no conoce a Claudio", anchored: true, Moments.At(1));

        note.Edit("Aquí Antonio aún no conoce a Claudio", Moments.At(5));

        note.Text.ShouldBe("Aquí Antonio aún no conoce a Claudio");
        note.UpdatedAt.ShouldBe(Moments.At(5));
        note.CreatedAt.ShouldBe(Moments.At(1));
        Should.Throw<DomainException>(() => note.Edit(" ", Moments.At(6))).Error.ShouldBe(DomainError.NoteTextRequired);
    }

    [Fact]
    public void A_note_becomes_loose_when_its_passage_is_deleted()
    {
        var note = Note.Create(_documentId, "revisar", anchored: true, Moments.Start);

        note.Reconcile(Paragraphs("El pasaje ya no está")).ShouldBeTrue();

        note.IsAnchored.ShouldBeFalse();
    }

    [Fact]
    public void Undoing_the_deletion_anchors_it_again()
    {
        var note = Note.Create(_documentId, "revisar", anchored: false, Moments.Start);

        note.Reconcile(Doc(Block("paragraph", Text("el pasaje", AnchorMark(note.Id))))).ShouldBeTrue();

        note.IsAnchored.ShouldBeTrue();
    }

    [Fact]
    public void A_point_anchor_also_keeps_the_note_anchored()
    {
        var note = Note.Create(_documentId, "aquí", anchored: true, Moments.Start);

        note.Reconcile(Doc(Block("paragraph", Text("antes"), AnchorNode(note.Id)))).ShouldBeFalse();

        note.IsAnchored.ShouldBeTrue();
    }

    [Fact]
    public void Anchors_of_other_notes_do_not_count()
    {
        var note = Note.Create(_documentId, "mía", anchored: true, Moments.At(1));
        var other = NoteId.New(Moments.At(2));

        note.Reconcile(Doc(Block("paragraph", Text("texto", AnchorMark(other))))).ShouldBeTrue();

        note.IsAnchored.ShouldBeFalse();
    }

    [Fact]
    public void Rehydrating_keeps_every_value()
    {
        var id = NoteId.New(Moments.Start);

        var note = Note.Rehydrate(id, _documentId, "texto", isAnchored: false, Moments.At(1), Moments.At(2));

        note.Id.ShouldBe(id);
        note.DocumentId.ShouldBe(_documentId);
        note.Text.ShouldBe("texto");
        note.IsAnchored.ShouldBeFalse();
        note.CreatedAt.ShouldBe(Moments.At(1));
        note.UpdatedAt.ShouldBe(Moments.At(2));
    }
}
