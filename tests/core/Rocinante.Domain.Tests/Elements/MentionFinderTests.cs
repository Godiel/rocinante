using System.Text.Json.Nodes;
using Rocinante.Domain.Elements;
using static Rocinante.Domain.Tests.Contents;

namespace Rocinante.Domain.Tests.Elements;

public sealed class MentionFinderTests
{
    private static readonly JsonArray _cases = (JsonNode.Parse(
        File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "contract", "mentions.json")))!["cases"] as JsonArray)!;

    public static TheoryData<string> Cases => [.. _cases.Select(item => item!["name"]!.GetValue<string>())];

    [Theory]
    [MemberData(nameof(Cases))]
    public void Finds_the_same_mentions_as_the_interface(string name)
    {
        var item = _cases.Single(candidate => candidate!["name"]!.GetValue<string>() == name)!;
        var ids = new Dictionary<string, ElementId>();
        var elements = new List<(ElementId, IEnumerable<string>)>();
        foreach (var (key, names) in item["names"]!.AsObject())
        {
            ids[key] = ElementId.New(Moments.At(ids.Count));
            elements.Add((ids[key], names!.AsArray().Select(alias => alias!.GetValue<string>()).ToList()));
        }

        var found = new MentionFinder(elements).Find(item["text"]!.GetValue<string>());

        var expected = item["mentions"]!.AsArray()
            .Select(mention => (
                Elements: string.Join(",", mention!["elements"]!.AsArray().Select(key => ids[key!.GetValue<string>()])),
                Start: mention["start"]!.GetValue<int>(),
                Length: mention["length"]!.GetValue<int>()))
            .ToList();
        found.Select(mention => (string.Join(",", mention.Elements), mention.Start, mention.Length)).ShouldBe(expected);
    }

    [Fact]
    public void With_no_names_there_is_nothing_to_find()
    {
        var finder = new MentionFinder([]);

        finder.IsEmpty.ShouldBeTrue();
        finder.Find("Antonio llegó.").ShouldBeEmpty();
    }

    [Fact]
    public void A_name_at_the_end_of_the_text_is_found_whole_or_not_at_all()
    {
        var finder = new MentionFinder([(ElementId.New(Moments.Start), ["Don Quijote"])]);

        finder.Find("Llegó Don").ShouldBeEmpty();
        finder.Find("Llegó Don Quijote").ShouldHaveSingleItem().Start.ShouldBe(6);
    }

    [Fact]
    public void Words_of_a_name_split_by_a_line_or_too_much_are_not_a_mention()
    {
        var finder = new MentionFinder([(ElementId.New(Moments.Start), ["Don Quijote"])]);

        finder.Find("Don\nQuijote").ShouldBeEmpty();
        finder.Find("Don … — Quijote").ShouldBeEmpty();
    }

    [Fact]
    public void The_same_name_twice_in_one_ficha_counts_once()
    {
        var antonio = ElementId.New(Moments.Start);

        new MentionFinder([(antonio, ["Antonio", "ANTONIO"])]).Find("Antonio").ShouldHaveSingleItem().Elements.ShouldBe([antonio]);
    }

    [Fact]
    public void A_text_gives_its_blocks_in_order_with_their_line_breaks()
    {
        var content = Doc(
            Block("heading", Text("Capítulo")),
            Block("paragraph", Text("verso"), HardBreak(), Text("verso"), Footnote("nota")),
            Paragraph("   "));

        content.Blocks.ShouldBe(["Capítulo", "verso\nverso"]);
    }
}
