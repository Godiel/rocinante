using Rocinante.Application.Squire;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Squire;

namespace Rocinante.Application.Tests;

public sealed class SquireAskTests
{
    [Fact]
    public void Asks_about_the_paragraph_with_the_fichas_the_work_has()
    {
        var board = new ElementBoard();
        var antonio = board.Create(ElementKind.Character, null, "Antonio", null, null, DateTimeOffset.UnixEpoch);
        antonio.SetAliases(["el viejo"]);

        var question = SquireAsk.Question("Antonio llegó con Claudio.", board.Elements);

        question.ShouldContain("- Antonio (también el viejo)");
        question.ShouldEndWith("Párrafo:\nAntonio llegó con Claudio.");
        SquireAsk.Question("Nada.", []).ShouldContain("(ninguna)");
    }

    [Fact]
    public void Reads_what_the_model_found()
    {
        var reading = SquireAsk.Read(
            """
            Aquí tienes:
            {"elements":[{"name":"Claudio","kind":"character","otherKind":null},{"name":"Yelmo","kind":"other"}],
             "relationships":[{"from":"Claudio","to":"Antonio","forward":"hijo de","inverse":"padre de"}],
             "attributes":[{"element":"Antonio","name":"Pelo","value":"rojo"}]}
            """);

        reading.Elements.ShouldBe([
            new ProposedElement("Claudio", ElementKind.Character, null),
            new ProposedElement("Yelmo", ElementKind.Other, "Otro"),
        ]);
        reading.Relationships.ShouldBe([new ProposedRelationship("Claudio", "Antonio", "hijo de", "padre de")]);
        reading.Details.ShouldBe([new ProposedDetail("Antonio", "Pelo", "rojo")]);
    }

    [Theory]
    [InlineData("No hay nada que anotar.")]
    [InlineData("{ esto no es json }")]
    [InlineData("[1, 2]")]
    public void An_answer_it_cannot_read_reads_as_nothing(string answer)
    {
        SquireAsk.Read(answer).ShouldBe(SquireReading.Nothing);
    }

    [Fact]
    public void Leaves_out_the_parts_that_do_not_make_sense()
    {
        var reading = SquireAsk.Read(
            """{"elements":[{"kind":"place"},{"name":"  "},{"name":"Toboso","kind":"village"}],"relationships":[{"from":"A"}],"attributes":"no"}""");

        reading.Elements.ShouldBe([new ProposedElement("Toboso", ElementKind.Character, null)]);
        reading.Relationships.ShouldBeEmpty();
        reading.Details.ShouldBeEmpty();
    }
}
