using Rocinante.Domain.Elements;

namespace Rocinante.Domain.Tests.Elements;

public sealed class ElementBoardTests
{
    private static readonly RelationshipKindId _childOf = RelationshipKindId.Builtin("child-of");
    private static readonly RelationshipKindId _livesIn = RelationshipKindId.Builtin("lives-in");

    private readonly ElementBoard _board = new();

    private Element Add(string name, BoardPosition? position = null, ElementKind kind = ElementKind.Character) =>
        _board.Create(kind, null, name, null, position, Moments.Start);

    [Fact]
    public void New_cards_without_a_place_never_cover_another_card()
    {
        var cards = Enumerable.Range(0, 40).Select(i => Add($"Personaje {i}")).ToList();

        cards[0].Position.ShouldBe(BoardPosition.Origin);
        foreach (var card in cards)
        {
            cards.Where(other => other != card)
                .ShouldAllBe(other =>
                    Math.Abs(other.Position.X - card.Position.X) >= ElementBoard.CardWidth
                    || Math.Abs(other.Position.Y - card.Position.Y) >= ElementBoard.CardHeight);
        }
    }

    [Fact]
    public void A_free_place_is_looked_for_around_a_centre_and_ignores_cards_in_the_trash()
    {
        var centre = new BoardPosition(1000, 500);
        var taken = Add("Sancho", centre);

        var free = _board.FreePlaceNear(centre);
        free.ShouldNotBe(centre);
        Math.Abs(free.X - centre.X).ShouldBeLessThanOrEqualTo(ElementBoard.CardWidth);
        Math.Abs(free.Y - centre.Y).ShouldBeLessThanOrEqualTo(ElementBoard.CardHeight);

        _board.Delete(taken.Id, Moments.At(1));
        _board.FreePlaceNear(centre).ShouldBe(centre);
    }

    [Fact]
    public void A_free_place_stays_on_the_board()
    {
        var corner = new BoardPosition(BoardPosition.Limit, BoardPosition.Limit);
        Add("En la esquina", corner);

        var free = _board.FreePlaceNear(corner);

        Math.Abs(free.X).ShouldBeLessThanOrEqualTo(BoardPosition.Limit);
        Math.Abs(free.Y).ShouldBeLessThanOrEqualTo(BoardPosition.Limit);
        free.ShouldNotBe(corner);
    }

    [Fact]
    public void An_element_that_is_not_there_is_not_found()
    {
        var missing = ElementId.New(Moments.Start);

        Should.Throw<DomainException>(() => _board.Find(missing)).Error.ShouldBe(DomainError.ElementNotFound);
        Should.Throw<DomainException>(() => _board.Delete(missing, Moments.Start)).Error.ShouldBe(DomainError.ElementNotFound);
    }

    [Fact]
    public void Moving_puts_cards_where_the_writer_left_them_or_moves_none()
    {
        var quixote = Add("Don Quijote");
        var sancho = Add("Sancho");
        _board.Delete(sancho.Id, Moments.At(1));

        _board.Move([(quixote.Id, new BoardPosition(300, -150))]);
        quixote.Position.ShouldBe(new BoardPosition(300, -150));

        Should.Throw<DomainException>(() => _board.Move([(quixote.Id, new BoardPosition(1, 1)), (sancho.Id, new BoardPosition(2, 2))]))
            .Error.ShouldBe(DomainError.ElementIsDeleted);
        quixote.Position.ShouldBe(new BoardPosition(300, -150));
    }

    [Fact]
    public void The_trash_keeps_an_element_and_hides_its_relationships_until_it_is_restored()
    {
        var antonio = Add("Antonio");
        var claudio = Add("Claudio");
        var mancha = Add("La Mancha", kind: ElementKind.Place);
        var son = _board.Relate(claudio.Id, antonio.Id, _childOf, Moments.Start);
        var home = _board.Relate(antonio.Id, mancha.Id, _livesIn, Moments.Start);

        _board.Delete(antonio.Id, Moments.At(2));

        _board.Elements.ShouldBe([claudio, mancha], ignoreOrder: true);
        _board.Trash.ShouldBe([antonio]);
        _board.Relationships.ShouldBeEmpty();
        _board.RelationshipsOf(antonio.Id).ShouldBe([son, home], ignoreOrder: true);
        Should.Throw<DomainException>(() => _board.FindRelationship(son.Id)).Error.ShouldBe(DomainError.RelationshipNotFound);
        Should.Throw<DomainException>(() => _board.InWork(antonio.Id)).Error.ShouldBe(DomainError.ElementIsDeleted);
        Should.Throw<DomainException>(() => _board.Relate(claudio.Id, antonio.Id, _livesIn, Moments.Start))
            .Error.ShouldBe(DomainError.ElementIsDeleted);

        _board.Restore(antonio.Id);

        antonio.IsDeleted.ShouldBeFalse();
        _board.Relationships.ShouldBe([son, home], ignoreOrder: true);
    }

    [Fact]
    public void The_trash_shows_the_most_recently_deleted_first_and_only_deleted_ones_are_restored()
    {
        var first = Add("Primero");
        var second = Add("Segundo");
        _board.Delete(first.Id, Moments.At(1));
        _board.Delete(second.Id, Moments.At(2));

        _board.Trash.ShouldBe([second, first]);
        _board.Restore(first.Id);
        Should.Throw<DomainException>(() => _board.Restore(first.Id)).Error.ShouldBe(DomainError.ElementIsNotDeleted);
    }

    [Fact]
    public void A_relationship_joins_two_different_elements_and_is_not_repeated()
    {
        var antonio = Add("Antonio");
        var claudio = Add("Claudio");

        var son = _board.Relate(claudio.Id, antonio.Id, _childOf, Moments.Start);

        son.From.ShouldBe(claudio.Id);
        son.To.ShouldBe(antonio.Id);
        son.Kind.ShouldBe(_childOf);
        Should.Throw<DomainException>(() => _board.Relate(claudio.Id, claudio.Id, _childOf, Moments.Start)).Error.ShouldBe(DomainError.SameElement);
        Should.Throw<DomainException>(() => _board.Relate(claudio.Id, antonio.Id, _childOf, Moments.Start)).Error.ShouldBe(DomainError.RelationshipRepeated);

        // Another kind, or the other way round with a common kind, is another relationship.
        _board.Relate(claudio.Id, antonio.Id, _livesIn, Moments.Start);
        _board.Relate(antonio.Id, claudio.Id, _childOf, Moments.Start);
        _board.Relationships.Count().ShouldBe(3);
    }

    [Fact]
    public void An_own_kind_is_written_once_and_reused_when_the_writer_types_it_again()
    {
        var squire = _board.OwnKind(" escudero de ", "señor de", Moments.Start);

        _board.OwnKind("Escudero de", " Señor de ", Moments.At(1)).ShouldBeSameAs(squire);
        _board.OwnKind("escudero de", null, Moments.At(1)).ShouldNotBeSameAs(squire);
        _board.OwnKind("escudero de", "amo de", Moments.At(1)).ShouldNotBeSameAs(squire);

        squire.Forward.ShouldBe("escudero de");
        squire.Inverse.ShouldBe("señor de");
        squire.IsSymmetric.ShouldBeFalse();
        squire.KindId.Own.ShouldBe(squire.Id);
        _board.OwnKinds.Count.ShouldBe(3);
    }

    [Fact]
    public void A_symmetric_own_kind_reads_the_same_both_ways_and_is_not_repeated_the_other_way_round()
    {
        var quixote = Add("Don Quijote");
        var bachelor = Add("Sansón Carrasco");
        var rival = _board.OwnKind("rival de", "  ", Moments.Start);

        rival.IsSymmetric.ShouldBeTrue();
        _board.Relate(quixote.Id, bachelor.Id, rival.KindId, Moments.Start);
        Should.Throw<DomainException>(() => _board.Relate(bachelor.Id, quixote.Id, rival.KindId, Moments.Start))
            .Error.ShouldBe(DomainError.RelationshipRepeated);
    }

    [Fact]
    public void An_own_kind_needs_words()
    {
        Should.Throw<DomainException>(() => _board.OwnKind("  ", null, Moments.Start)).Error.ShouldBe(DomainError.NameRequired);
        Should.Throw<ArgumentOutOfRangeException>(() => _board.OwnKind(new string('a', RelationshipKind.MaxLabelLength + 1), null, Moments.Start));
    }

    [Fact]
    public void A_relationship_with_an_own_kind_of_another_work_is_refused()
    {
        var antonio = Add("Antonio");
        var claudio = Add("Claudio");
        var foreign = RelationshipKindId.OwnKind(Guid.CreateVersion7());

        Should.Throw<DomainException>(() => _board.Relate(claudio.Id, antonio.Id, foreign, Moments.Start))
            .Error.ShouldBe(DomainError.RelationshipKindNotFound);
    }

    [Fact]
    public void A_relationship_can_change_its_kind_but_not_into_one_it_would_repeat()
    {
        var antonio = Add("Antonio");
        var claudio = Add("Claudio");
        var son = _board.Relate(claudio.Id, antonio.Id, _childOf, Moments.Start);
        _board.Relate(claudio.Id, antonio.Id, _livesIn, Moments.Start);
        var mentor = _board.OwnKind("discípulo de", "mentor de", Moments.Start);

        _board.ChangeKind(son.Id, mentor.KindId).Kind.ShouldBe(mentor.KindId);
        _board.ChangeKind(son.Id, mentor.KindId).Kind.ShouldBe(mentor.KindId);
        Should.Throw<DomainException>(() => _board.ChangeKind(son.Id, _livesIn)).Error.ShouldBe(DomainError.RelationshipRepeated);
        Should.Throw<DomainException>(() => _board.ChangeKind(son.Id, RelationshipKindId.OwnKind(Guid.CreateVersion7())))
            .Error.ShouldBe(DomainError.RelationshipKindNotFound);
    }

    [Fact]
    public void Unrelating_takes_the_relationship_away()
    {
        var antonio = Add("Antonio");
        var claudio = Add("Claudio");
        var son = _board.Relate(claudio.Id, antonio.Id, _childOf, Moments.Start);

        _board.Unrelate(son.Id);

        _board.Relationships.ShouldBeEmpty();
        Should.Throw<DomainException>(() => _board.Unrelate(son.Id)).Error.ShouldBe(DomainError.RelationshipNotFound);
    }

    [Fact]
    public void Rehydrating_drops_relationships_whose_elements_are_missing()
    {
        var antonio = Element.Rehydrate(
            ElementId.New(Moments.Start), ElementKind.Character, null, "Antonio", [], [], Rocinante.Domain.Content.DocumentContent.Empty,
            BoardPosition.Origin, 0, hasImage: false, Moments.Start, null);
        var lost = ElementId.New(Moments.Start);
        var kind = RelationshipKind.Rehydrate(Guid.CreateVersion7(), "escudero de", "señor de");

        var board = ElementBoard.Rehydrate(
            [antonio],
            [Relationship.Rehydrate(RelationshipId.New(Moments.Start), antonio.Id, lost, kind.KindId)],
            [kind]);

        board.Elements.ShouldBe([antonio]);
        board.Relationships.ShouldBeEmpty();
        board.RelationshipsOf(antonio.Id).ShouldBeEmpty();
        board.OwnKinds.ShouldBe([kind]);
    }

    [Theory]
    [InlineData("builtin:child-of", null)]
    [InlineData("own:0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b", "0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b")]
    public void A_relationship_kind_id_says_whether_it_is_the_writers(string value, string? own)
    {
        var id = RelationshipKindId.Parse(value);

        id.ToString().ShouldBe(value);
        id.Own.ShouldBe(own is null ? null : Guid.Parse(own));
    }

    [Theory]
    [InlineData("hijo de")]
    [InlineData("builtin:Child")]
    [InlineData("own:42")]
    [InlineData(null)]
    public void A_relationship_kind_id_has_a_fixed_shape(string? value)
    {
        RelationshipKindId.TryParse(value, out _).ShouldBeFalse();
        if (value is not null)
        {
            Should.Throw<FormatException>(() => RelationshipKindId.Parse(value));
        }
    }
}
