using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;

namespace Rocinante.Application.Tests;

public sealed class ElementUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private const string Other = "window-1";
    private static readonly RelationshipKindId _childOf = RelationshipKindId.Builtin("child-of");
    private static readonly byte[] _webp = [.. "RIFF"u8, 9, 0, 0, 0, .. "WEBPVP8 "u8, 1, 2, 3];
    private static readonly byte[] _jpeg = [0xFF, 0xD8, 0xFF, 0xE0, 4, 5, 6];
    private static readonly byte[] _png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 7, 8, 9, 10];

    private readonly AppFixture _app = new();

    public ElementUseCasesTests() => _app.CreateProject();

    public void Dispose() => _app.Dispose();

    private ElementUseCases Elements => _app.Elements;

    private Element Character(string name, string origin = Main) =>
        Elements.Create(ElementKind.Character, null, name, [new ElementAttribute("Edad", "")], null, origin);

    [Fact]
    public void Without_a_work_open_there_are_no_elements()
    {
        _app.Projects.Close(Main);

        Should.Throw<ProjectNotOpenException>(() => Elements.Board());
        Should.Throw<ProjectNotOpenException>(() => Character("Sancho"));
    }

    [Fact]
    public void Creating_an_element_stores_it_and_tells_every_window()
    {
        var quixote = Character("Alonso Quijano", Other);

        quixote.Attributes.ShouldHaveSingleItem().Name.ShouldBe("Edad");
        _app.Notifier.Events.ShouldBe([$"elements.changed:{Other}"]);
        _app.Notifier.LastElements!.Elements.ShouldBe([quixote]);
        _app.Notifier.LastElements.Details.ShouldBe([quixote]);
        Elements.Board().Elements.ShouldBe([quixote]);

        _app.Quit();
        _app.Projects.Open(_app.PathOf("obra.rocinante"), Main);
        Elements.Get(quixote.Id).Name.ShouldBe("Alonso Quijano");
    }

    [Fact]
    public void An_update_changes_only_what_it_names_and_changing_nothing_announces_nothing()
    {
        var quixote = Character("Alonso Quijano");
        _app.Notifier.Clear();

        var description = DocumentContent.Parse(TipTap.Paragraphs("Hidalgo de lanza en astillero."));
        var updated = Elements.Update(
            quixote.Id, new ElementUpdate(Name: "Don Quijote", Aliases: ["Alonso Quijano"], Description: description), Other);

        updated.Name.ShouldBe("Don Quijote");
        updated.Aliases.ShouldBe(["Alonso Quijano"]);
        updated.Attributes.ShouldHaveSingleItem();
        updated.Description.ShouldBe(description);
        _app.Notifier.Events.ShouldBe([$"elements.changed:{Other}"]);
        _app.Notifier.LastElements!.Details.ShouldBe([updated]);

        _app.Notifier.Clear();
        Elements.Update(quixote.Id, new ElementUpdate(Name: "Don Quijote", Aliases: ["Alonso Quijano"]), Main);
        _app.Notifier.Events.ShouldBeEmpty();
    }

    [Fact]
    public void Changing_the_kind_to_another_needs_its_name_and_a_broken_update_changes_nothing()
    {
        var helmet = Elements.Create(ElementKind.Plot, null, "Yelmo", null, null, Main);

        Should.Throw<DomainException>(() => Elements.Update(helmet.Id, new ElementUpdate(Name: "Yelmo de Mambrino", Kind: ElementKind.Other), Main))
            .Error.ShouldBe(DomainError.OtherKindRequired);
        Elements.Get(helmet.Id).Name.ShouldBe("Yelmo");

        Elements.Update(helmet.Id, new ElementUpdate(Kind: ElementKind.Other, OtherKind: "Objeto"), Main).OtherKind.ShouldBe("Objeto");
        Elements.Update(helmet.Id, new ElementUpdate(OtherKind: "Reliquia"), Main).OtherKind.ShouldBe("Reliquia");
    }

    [Fact]
    public void The_trash_hides_the_relationships_of_an_element_and_restoring_brings_them_back()
    {
        var antonio = Character("Antonio");
        var claudio = Character("Claudio");
        var son = Elements.Relate(claudio.Id, antonio.Id, RelationshipKindChoice.Of(_childOf), Main);
        _app.Notifier.Clear();

        Elements.Delete(antonio.Id, Other);

        _app.Notifier.Events.ShouldBe([$"elements.changed:{Other}"]);
        _app.Notifier.LastElements!.Trash.ShouldHaveSingleItem().Id.ShouldBe(antonio.Id);
        _app.Notifier.LastElements.RemovedRelationships.ShouldBe([son.Id]);
        Should.Throw<DomainException>(() => Elements.Update(antonio.Id, new ElementUpdate(Name: "Antón"), Main))
            .Error.ShouldBe(DomainError.ElementIsDeleted);

        var restored = Elements.Restore(antonio.Id, Main);

        restored.IsDeleted.ShouldBeFalse();
        _app.Notifier.LastElements!.Elements.ShouldBe([restored]);
        _app.Notifier.LastElements.Relationships.Select(relationship => relationship.Id).ShouldBe([son.Id]);
    }

    [Fact]
    public void Moving_cards_stores_their_places_and_announces_the_moved_ones()
    {
        var quixote = Character("Don Quijote");
        var sancho = Character("Sancho");
        _app.Notifier.Clear();

        Elements.Move([(quixote.Id, new BoardPosition(10, 20)), (sancho.Id, new BoardPosition(300, 20))], Other);

        _app.Notifier.LastElements!.Elements.Select(element => element.Position)
            .ShouldBe([new BoardPosition(10, 20), new BoardPosition(300, 20)]);
        _app.Quit();
        _app.Projects.Open(_app.PathOf("obra.rocinante"), Main);
        Elements.Get(sancho.Id).Position.ShouldBe(new BoardPosition(300, 20));
    }

    [Fact]
    public void A_new_own_kind_is_written_down_once_and_announced_with_the_relationship()
    {
        var quixote = Character("Don Quijote");
        var sancho = Character("Sancho");
        var dapple = Elements.Create(ElementKind.Other, "Montura", "el Rucio", null, null, Main);

        var service = Elements.Relate(sancho.Id, quixote.Id, RelationshipKindChoice.New("escudero de", "señor de"), Main);
        var kind = _app.Notifier.LastElements!.OwnKinds.ShouldHaveSingleItem();
        service.Kind.ShouldBe(kind.KindId);

        var again = Elements.Relate(dapple.Id, sancho.Id, RelationshipKindChoice.New("Escudero de", "Señor de"), Main);
        again.Kind.ShouldBe(kind.KindId);
        _app.Notifier.LastElements!.OwnKinds.ShouldBeEmpty();

        var changed = Elements.ChangeRelationship(again.Id, RelationshipKindChoice.New("montura de", "jinete de"), Other);
        changed.Kind.ShouldNotBe(kind.KindId);
        _app.Notifier.LastElements!.OwnKinds.ShouldHaveSingleItem().Forward.ShouldBe("montura de");

        Elements.Unrelate(changed.Id, Main);
        _app.Notifier.LastElements!.RemovedRelationships.ShouldBe([changed.Id]);
        Elements.Board().Relationships.ShouldBe([service]);
        Elements.Board().OwnKinds.Count.ShouldBe(2);
    }

    [Fact]
    public void A_broken_relationship_changes_nothing()
    {
        var quixote = Character("Don Quijote");

        Should.Throw<DomainException>(() => Elements.Relate(quixote.Id, quixote.Id, RelationshipKindChoice.New("rival de", null), Main))
            .Error.ShouldBe(DomainError.SameElement);

        Elements.Board().OwnKinds.ShouldBeEmpty();
        _app.Quit();
        _app.Projects.Open(_app.PathOf("obra.rocinante"), Main);
        Elements.Board().OwnKinds.ShouldBeEmpty();
    }

    [Fact]
    public void A_chosen_image_is_read_whole_with_its_type()
    {
        var path = _app.PathOf("retrato.png");
        File.WriteAllBytes(path, _png);

        var image = Elements.ReadImage(path);

        image.MediaType.ShouldBe("image/png");
        image.Data.ToArray().ShouldBe(_png);
    }

    [Fact]
    public void A_chosen_file_that_is_not_an_image_or_is_not_there_is_refused()
    {
        var letter = _app.PathOf("carta.png");
        File.WriteAllText(letter, "Querido Sancho:");

        Should.Throw<DomainException>(() => Elements.ReadImage(letter)).Error.ShouldBe(DomainError.NotAnImage);
        Should.Throw<ProjectFileException>(() => Elements.ReadImage(_app.PathOf("no-existe.png"))).Error.ShouldBe(ProjectFileError.NotFound);
    }

    [Fact]
    public void A_chosen_image_has_a_size_limit()
    {
        var path = _app.PathOf("enorme.png");
        using (var file = File.Create(path))
        {
            file.Write(_png);
            file.SetLength(ElementUseCases.MaxChosenImageBytes + 1);
        }

        Should.Throw<DomainException>(() => Elements.ReadImage(path)).Error.ShouldBe(DomainError.FileTooLarge);
    }

    [Fact]
    public void A_reduced_image_is_stored_with_its_thumbnail_and_can_be_taken_away()
    {
        var dulcinea = Character("Dulcinea");
        _app.Notifier.Clear();

        var withImage = Elements.SetImage(dulcinea.Id, _webp, _jpeg, Other);

        withImage.ImageVersion.ShouldNotBeNull();
        _app.Notifier.Events.ShouldBe([$"elements.changed:{Other}"]);
        Elements.Image(dulcinea.Id, ImageSize.Full).MediaType.ShouldBe("image/webp");
        Elements.Image(dulcinea.Id, ImageSize.Thumbnail).Data.ToArray().ShouldBe(_jpeg);

        Elements.RemoveImage(dulcinea.Id, Main).ImageVersion.ShouldBeNull();
        Should.Throw<DomainException>(() => Elements.Image(dulcinea.Id, ImageSize.Full)).Error.ShouldBe(DomainError.ElementNotFound);
    }

    [Fact]
    public void A_reduced_image_must_be_webp_or_jpeg_and_small()
    {
        var dulcinea = Character("Dulcinea");

        Should.Throw<DomainException>(() => Elements.SetImage(dulcinea.Id, _png, _jpeg, Main)).Error.ShouldBe(DomainError.NotAnImage);
        Should.Throw<DomainException>(() => Elements.SetImage(dulcinea.Id, _webp, new byte[] { 1, 2 }, Main)).Error.ShouldBe(DomainError.NotAnImage);
        var tooLarge = new byte[ElementUseCases.MaxThumbnailBytes + 1];
        _jpeg.CopyTo(tooLarge, 0);
        Should.Throw<DomainException>(() => Elements.SetImage(dulcinea.Id, _webp, tooLarge, Main)).Error.ShouldBe(DomainError.FileTooLarge);
        Elements.Get(dulcinea.Id).ImageVersion.ShouldBeNull();
    }

    [Fact]
    public void An_element_that_is_not_there_is_reported()
    {
        var missing = ElementId.New(_app.Clock.GetUtcNow());

        Should.Throw<DomainException>(() => Elements.Get(missing)).Error.ShouldBe(DomainError.ElementNotFound);
        Should.Throw<DomainException>(() => Elements.Image(missing, ImageSize.Full)).Error.ShouldBe(DomainError.ElementNotFound);
    }
}
