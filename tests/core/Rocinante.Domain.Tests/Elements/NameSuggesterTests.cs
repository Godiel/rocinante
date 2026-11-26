using Rocinante.Domain.Elements;

namespace Rocinante.Domain.Tests.Elements;

public sealed class NameSuggesterTests
{
    private static readonly HashSet<string> _none = [];

    private static IReadOnlyList<NameSuggestion> Suggest(IReadOnlySet<string>? known = null, params string[] blocks) =>
        NameSuggester.Suggest(blocks, known ?? _none);

    [Fact]
    public void Suggests_a_name_repeated_inside_sentences_three_times()
    {
        var suggestions = Suggest(null, "Vio a Dulcinea en la plaza.", "Pensaba en Dulcinea.", "Y soñó con Dulcinea.");

        suggestions.ShouldBe([new NameSuggestion("Dulcinea", 3)]);
    }

    [Fact]
    public void Two_times_are_not_enough()
    {
        Suggest(null, "Vio a Dulcinea.", "Pensaba en Dulcinea.").ShouldBeEmpty();
    }

    [Fact]
    public void A_word_that_only_starts_sentences_is_not_a_name()
    {
        Suggest(null, "Entonces llegó. Entonces se fue. Entonces volvió. ¿Entonces? —Entonces sí.").ShouldBeEmpty();
    }

    [Fact]
    public void A_name_at_the_start_of_a_sentence_counts_only_where_it_is_inside_one()
    {
        var suggestions = Suggest(null, "Sancho comía. Luego vino Sancho y habló Sancho con Sancho.");

        suggestions.ShouldBe([new NameSuggestion("Sancho", 3)]);
    }

    [Fact]
    public void Names_of_several_words_are_suggested_whole_with_their_connectors()
    {
        var suggestions = Suggest(
            null,
            "Salió Don Quijote de la Mancha al alba.",
            "Así era Don Quijote de la Mancha, y Sancho Panza lo seguía.",
            "Hablaba Don Quijote de la Mancha con Sancho Panza y con Sancho Panza.");

        suggestions.ShouldBe([new NameSuggestion("Don Quijote de la Mancha", 3), new NameSuggestion("Sancho Panza", 3)]);
    }

    [Fact]
    public void A_connector_at_the_end_is_not_part_of_the_name()
    {
        var suggestions = Suggest(null, "Vio a Pedro y a Juan.", "Con Pedro y nadie más.", "Por Pedro de buena fe.");

        suggestions.ShouldBe([new NameSuggestion("Pedro", 3)]);
    }

    [Fact]
    public void Punctuation_between_two_names_keeps_them_apart()
    {
        var suggestions = Suggest(null, "Vinieron Ana, Pedro.", "Llamó a Ana, Pedro.", "Con Ana, Pedro.");

        suggestions.Select(suggestion => suggestion.Name).ShouldBe(["Ana", "Pedro"]);
    }

    [Fact]
    public void Leaves_out_the_names_of_the_fichas_and_the_dismissed()
    {
        var known = new HashSet<string> { MentionFinder.Key("DULCINEA"), MentionFinder.Key("Sancho") };

        Suggest(known, "Vio a Dulcinea y a Sancho.", "Con Dulcinea y Sancho.", "Por Dulcinea y Sancho.").ShouldBeEmpty();
    }

    [Fact]
    public void Counts_together_the_ways_a_name_is_written_and_shows_the_most_common()
    {
        var suggestions = Suggest(null, "Vio a Ángela.", "Con Ángela.", "Por Angela.");

        suggestions.ShouldBe([new NameSuggestion("Ángela", 3)]);
    }

    [Fact]
    public void A_single_capital_letter_is_not_a_name()
    {
        Suggest(null, "La letra A va.", "Con la A va.", "Por la A va.").ShouldBeEmpty();
    }

    [Fact]
    public void Gives_twenty_at_most_the_most_repeated_first()
    {
        var blocks = Enumerable.Range(0, 25)
            .SelectMany(n => Enumerable.Repeat($"Vio a Nombre{(char)('a' + n)} hoy.", 3 + (n % 3)))
            .ToArray();

        var suggestions = Suggest(null, blocks);

        suggestions.Count.ShouldBe(NameSuggester.MaxSuggestions);
        suggestions[0].Count.ShouldBe(5);
        suggestions.Select(suggestion => suggestion.Count).ShouldBeInOrder(SortDirection.Descending);
    }

    [Fact]
    public void And_joins_two_names_not_one()
    {
        var suggestions = Suggest(null, "Vio a Dulcinea y Sancho.", "Con Dulcinea y Sancho.", "Por Dulcinea y Sancho.");

        suggestions.Select(suggestion => suggestion.Name).ShouldBe(["Dulcinea", "Sancho"]);
    }
}
