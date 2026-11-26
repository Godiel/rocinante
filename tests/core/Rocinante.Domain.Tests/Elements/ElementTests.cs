using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;

namespace Rocinante.Domain.Tests.Elements;

public sealed class ElementTests
{
    private readonly ElementBoard _board = new();

    private Element Quixote() => _board.Create(
        ElementKind.Character, otherKind: null, "  Alonso Quijano ", [new ElementAttribute("Edad", "")], position: null, Moments.Start);

    [Fact]
    public void A_new_element_has_its_name_trimmed_its_attributes_and_an_empty_description()
    {
        var element = Quixote();

        element.Name.ShouldBe("Alonso Quijano");
        element.Kind.ShouldBe(ElementKind.Character);
        element.OtherKind.ShouldBeNull();
        element.Attributes.ShouldHaveSingleItem().ShouldBe(new ElementAttribute("Edad", ""));
        element.Aliases.ShouldBeEmpty();
        element.Description.ShouldBe(DocumentContent.Empty);
        element.ImageVersion.ShouldBeNull();
        element.CreatedAt.ShouldBe(Moments.Start);
        element.IsDeleted.ShouldBeFalse();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void An_element_needs_a_name(string name)
    {
        Should.Throw<DomainException>(() => _board.Create(ElementKind.Place, null, name, null, null, Moments.Start))
            .Error.ShouldBe(DomainError.NameRequired);
        Should.Throw<DomainException>(() => Quixote().Rename(name)).Error.ShouldBe(DomainError.NameRequired);
    }

    [Fact]
    public void A_name_has_a_length_limit()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => Quixote().Rename(new string('a', Element.MaxNameLength + 1)));
        Quixote().Rename(new string('a', Element.MaxNameLength));
    }

    [Fact]
    public void An_element_of_another_kind_names_its_kind()
    {
        var helmet = _board.Create(ElementKind.Other, " Objeto ", "Yelmo de Mambrino", null, null, Moments.Start);

        helmet.Kind.ShouldBe(ElementKind.Other);
        helmet.OtherKind.ShouldBe("Objeto");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("  ")]
    public void Another_kind_without_a_name_is_refused(string? otherKind)
    {
        Should.Throw<DomainException>(() => _board.Create(ElementKind.Other, otherKind, "Yelmo", null, null, Moments.Start))
            .Error.ShouldBe(DomainError.OtherKindRequired);
    }

    [Fact]
    public void Changing_the_kind_keeps_everything_written_and_only_other_keeps_a_kind_name()
    {
        var element = Quixote();
        element.SetAliases(["el Caballero de la Triste Figura"]);
        element.Describe(Contents.Paragraphs("Hidalgo de lanza en astillero."));

        element.ChangeKind(ElementKind.Other, "Leyenda");
        element.OtherKind.ShouldBe("Leyenda");
        element.ChangeKind(ElementKind.Plot, "ignored");

        element.Kind.ShouldBe(ElementKind.Plot);
        element.OtherKind.ShouldBeNull();
        element.Name.ShouldBe("Alonso Quijano");
        element.Aliases.ShouldBe(["el Caballero de la Triste Figura"]);
        element.Attributes.Count.ShouldBe(1);
        element.Description.ShouldBe(Contents.Paragraphs("Hidalgo de lanza en astillero."));
    }

    [Fact]
    public void An_unknown_kind_is_refused()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => Quixote().ChangeKind((ElementKind)42, null));
    }

    [Fact]
    public void Aliases_are_trimmed_and_blank_ones_dropped()
    {
        var element = Quixote();

        element.SetAliases([" Don Quijote ", "", "  ", "el Caballero de los Leones"]);

        element.Aliases.ShouldBe(["Don Quijote", "el Caballero de los Leones"]);
    }

    [Fact]
    public void There_is_a_limit_of_aliases_and_attributes()
    {
        var element = Quixote();

        Should.Throw<ArgumentOutOfRangeException>(() => element.SetAliases(Enumerable.Range(0, Element.MaxAliases + 1).Select(i => $"alias {i}")));
        Should.Throw<ArgumentOutOfRangeException>(() =>
            element.SetAttributes(Enumerable.Range(0, Element.MaxAttributes + 1).Select(i => new ElementAttribute($"a{i}", ""))));
        Should.Throw<ArgumentOutOfRangeException>(() => element.SetAliases([new string('a', Element.MaxNameLength + 1)]));
    }

    [Fact]
    public void Attributes_keep_the_writers_order()
    {
        var element = Quixote();

        element.SetAttributes([new ElementAttribute("Carácter", "Idealista"), new ElementAttribute("Edad", "Cincuenta años")]);

        element.Attributes.Select(attribute => attribute.Name).ShouldBe(["Carácter", "Edad"]);
    }

    [Fact]
    public void An_attribute_needs_a_name_and_has_limits()
    {
        Should.Throw<DomainException>(() => new ElementAttribute(" ", "x")).Error.ShouldBe(DomainError.NameRequired);
        Should.Throw<ArgumentOutOfRangeException>(() => new ElementAttribute(new string('a', ElementAttribute.MaxNameLength + 1), ""));
        Should.Throw<ArgumentOutOfRangeException>(() => new ElementAttribute("Historia", new string('a', ElementAttribute.MaxValueLength + 1)));
        new ElementAttribute(" Edad ", null!).ShouldBe(new ElementAttribute("Edad", ""));
    }

    [Fact]
    public void A_new_image_always_gets_a_newer_version_even_after_removing_one()
    {
        var element = Quixote();

        element.ReplaceImage(Moments.Start);
        var first = element.ImageVersion!.Value;
        element.RemoveImage();
        element.ImageVersion.ShouldBeNull();
        element.ReplaceImage(Moments.Start);

        element.ImageVersion!.Value.ShouldBeGreaterThan(first);
    }

    [Fact]
    public void Rehydrating_gives_back_what_was_saved_and_drops_a_kind_name_that_does_not_belong()
    {
        var id = ElementId.New(Moments.Start);

        var element = Element.Rehydrate(
            id, ElementKind.Place, "sobra", "La Mancha", ["la Mancha"], [new ElementAttribute("Situación", "Castilla")],
            Contents.Paragraphs("Llanura"), new BoardPosition(10, -20), 7, hasImage: true, Moments.Start, Moments.At(3));

        element.Id.ShouldBe(id);
        element.OtherKind.ShouldBeNull();
        element.Aliases.ShouldBe(["la Mancha"]);
        element.Position.ShouldBe(new BoardPosition(10, -20));
        element.ImageVersion.ShouldBe(7);
        element.DeletedAt.ShouldBe(Moments.At(3));
        element.IsDeleted.ShouldBeTrue();
    }

    [Theory]
    [InlineData(double.NaN, 0)]
    [InlineData(0, double.PositiveInfinity)]
    [InlineData(BoardPosition.Limit + 1, 0)]
    [InlineData(0, -BoardPosition.Limit - 1)]
    public void A_board_position_stays_on_the_board(double x, double y)
    {
        Should.Throw<DomainException>(() => new BoardPosition(x, y)).Error.ShouldBe(DomainError.PositionOutOfRange);
    }
}
