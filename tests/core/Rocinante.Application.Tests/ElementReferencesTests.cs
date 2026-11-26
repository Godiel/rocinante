using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Projects;

namespace Rocinante.Application.Tests;

public sealed class ElementReferencesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private readonly AppFixture _app = new();
    private readonly DocumentId _first;
    private readonly DocumentId _second;

    public ElementReferencesTests()
    {
        _app.CreateProject();
        _first = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main).Id;
        _second = _app.Documents.Create(DocumentKind.Chapter, "Dos", null, Main).Id;
    }

    public void Dispose() => _app.Dispose();

    private Element Character(string name, params string[] aliases)
    {
        var element = _app.Elements.Create(ElementKind.Character, null, name, [], null, Main);
        return aliases.Length == 0
            ? element
            : _app.Elements.Update(element.Id, new ElementUpdate(Aliases: aliases), Main);
    }

    private void Write(DocumentId document, params string[] paragraphs) =>
        _app.Documents.Save(document, TipTap.Paragraphs(paragraphs), Main);

    [Fact]
    public void Gives_every_mention_by_name_or_alias_in_the_order_of_the_index()
    {
        var quixote = Character("Alonso Quijano", "Don Quijote");
        Write(_second, "Don Quijote salió de nuevo.");
        Write(_first, "Alonso Quijano leía.", "Y Don Quijote soñaba; alonso quijano dormía poco.");

        var references = _app.Elements.References(quixote.Id);

        references.Total.ShouldBe(4);
        references.Documents.ShouldBe(2);
        references.First.ShouldBe(new MentionPlace(_first, 0));
        references.ByDocument.Select(document => document.DocumentId).ShouldBe([_first, _second]);
        references.ByDocument[0].Mentions.Select(mention => (mention.Ordinal, mention.Text))
            .ShouldBe([(0, "Alonso Quijano"), (1, "Don Quijote"), (2, "alonso quijano")]);
        references.ByDocument[0].Mentions[1].Before.ShouldBe("Y ");
        references.ByDocument[0].Mentions[1].After.ShouldBe(" soñaba; alonso quijano dormía poco.");
    }

    [Fact]
    public void Shows_whole_words_around_a_mention_in_a_long_paragraph()
    {
        var sancho = Character("Sancho");
        var words = string.Join(' ', Enumerable.Repeat("palabra", 20));
        Write(_first, $"{words} Sancho {words}");

        var mention = _app.Elements.References(sancho.Id).ByDocument.ShouldHaveSingleItem().Mentions.ShouldHaveSingleItem();

        mention.Before.Length.ShouldBeLessThanOrEqualTo(60);
        mention.Before.ShouldStartWith("palabra");
        mention.Before.ShouldEndWith("palabra ");
        mention.After.ShouldStartWith(" palabra");
        mention.After.ShouldEndWith("palabra");
    }

    [Fact]
    public void Follows_the_text_and_the_names_as_they_change()
    {
        var sancho = Character("Sancho");
        Write(_first, "Sancho comía.");
        _app.Elements.References(sancho.Id).Total.ShouldBe(1);

        Write(_first, "Sancho comía y Sancho bebía.");
        _app.Elements.References(sancho.Id).Total.ShouldBe(2);

        _app.Elements.Update(sancho.Id, new ElementUpdate(Name: "Sancho Panza"), Main);
        _app.Elements.References(sancho.Id).Total.ShouldBe(0);
    }

    [Fact]
    public void Leaves_out_the_documents_in_the_trash_and_the_elements_in_it()
    {
        var sancho = Character("Sancho");
        Write(_first, "Sancho comía.");
        Write(_second, "Sancho bebía.");
        _app.Documents.Delete(_first, Main);

        _app.Elements.References(sancho.Id).ByDocument.ShouldHaveSingleItem().DocumentId.ShouldBe(_second);

        _app.Elements.Delete(sancho.Id, Main);
        _app.Elements.References(sancho.Id).Total.ShouldBe(0);
    }

    [Fact]
    public void A_name_shared_by_two_fichas_is_a_mention_of_both()
    {
        var father = Character("Juan");
        var son = Character("Juanito", "Juan");
        Write(_first, "Juan llegó.");

        _app.Elements.References(father.Id).Total.ShouldBe(1);
        _app.Elements.References(son.Id).Total.ShouldBe(1);
    }

    [Fact]
    public void An_element_never_mentioned_has_no_first_appearance()
    {
        var references = _app.Elements.References(Character("Dulcinea").Id);

        references.Total.ShouldBe(0);
        references.Documents.ShouldBe(0);
        references.First.ShouldBeNull();
        references.ByDocument.ShouldBeEmpty();
    }

    [Fact]
    public void Asks_for_an_element_of_the_work()
    {
        Should.Throw<DomainException>(() => _app.Elements.References(ElementId.New(_app.Clock.GetUtcNow())))
            .Error.ShouldBe(DomainError.ElementNotFound);
    }
}
