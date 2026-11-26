using Rocinante.Domain.Elements;

namespace Rocinante.Domain.Tests.Elements;

public sealed class RelationshipBoundsTests
{
    private readonly DocumentId _first = DocumentId.New(Moments.At(1));
    private readonly DocumentId _third = DocumentId.New(Moments.At(3));
    private readonly DocumentId _fragment = DocumentId.New(Moments.At(4));

    private int? ChapterAt(DocumentId id) => id == _first ? 0 : id == _third ? 2 : null;

    private static Relationship Between(DocumentId? starts, DocumentId? ends) => Relationship.Rehydrate(
        RelationshipId.New(Moments.Start),
        ElementId.New(Moments.At(1)),
        ElementId.New(Moments.At(2)),
        RelationshipKindId.Builtin("friend-of"),
        starts,
        ends);

    [Fact]
    public void Without_chapters_a_relationship_holds_in_the_whole_work()
    {
        var relationship = Between(null, null);

        relationship.HoldsAt(0, ChapterAt).ShouldBeTrue();
        relationship.HoldsAt(40, ChapterAt).ShouldBeTrue();
    }

    [Fact]
    public void It_holds_from_its_first_chapter_to_its_last_both_included()
    {
        var relationship = Between(_first, _third);

        relationship.HoldsAt(0, ChapterAt).ShouldBeTrue();
        relationship.HoldsAt(2, ChapterAt).ShouldBeTrue();
        relationship.HoldsAt(3, ChapterAt).ShouldBeFalse();
        Between(_third, null).HoldsAt(1, ChapterAt).ShouldBeFalse();
        Between(_third, null).HoldsAt(9, ChapterAt).ShouldBeTrue();
    }

    [Fact]
    public void A_limit_whose_chapter_is_gone_does_not_count()
    {
        Between(_fragment, _first).HoldsAt(0, ChapterAt).ShouldBeTrue();
    }

    [Fact]
    public void Its_limits_are_chapters_and_it_does_not_end_before_it_starts()
    {
        Relationship.EnsureBounds(_first, _third, ChapterAt);
        Relationship.EnsureBounds(_third, _third, ChapterAt);
        Relationship.EnsureBounds(null, _first, ChapterAt);

        Should.Throw<DomainException>(() => Relationship.EnsureBounds(_third, _first, ChapterAt))
            .Error.ShouldBe(DomainError.RelationshipBounds);
        Should.Throw<DomainException>(() => Relationship.EnsureBounds(_fragment, null, ChapterAt))
            .Error.ShouldBe(DomainError.RelationshipBounds);
    }
}
