using Rocinante.Application.Squire;
using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Squire;

namespace Rocinante.Application.Tests;

public sealed class SquireUseCasesTests : IDisposable
{
    private const string Main = AppFixture.Main;
    private const string Paragraph = "Antonio llegó con su hijo Claudio, pelirrojo como él.";
    private const string Answer =
        """
        {"elements":[{"name":"Claudio","kind":"character"},{"name":"Antonio","kind":"character"}],
         "relationships":[{"from":"Claudio","to":"Antonio","forward":"hijo de","inverse":"padre de"}],
         "attributes":[{"element":"Antonio","name":"Pelo","value":"pelirrojo"}]}
        """;

    private readonly AppFixture _app = new();
    private readonly DocumentId _chapter;

    public SquireUseCasesTests()
    {
        _app.CreateProject();
        _chapter = _app.Documents.Create(DocumentKind.Chapter, "Uno", null, Main).Id;
        _app.SquireClient.Answer = Answer;
    }

    public void Dispose() => _app.Dispose();

    private SquireUseCases Squire => _app.Squire;

    private Element Antonio() => _app.Elements.Create(ElementKind.Character, null, "Antonio", [], null, Main);

    /// <summary>A squire set up and allowed to read the work.</summary>
    private void Ready(SquireProvider provider = SquireProvider.Anthropic)
    {
        Squire.Configure(provider, "modelo", null, Main);
        if (provider != SquireProvider.Ollama)
        {
            Squire.SetKey(provider, "clave", Main);
        }

        Squire.Enable(true, Main);
    }

    private async Task Read(string text = Paragraph)
    {
        Squire.Analyze(_chapter, text, Main);
        await Squire.WhenIdle();
    }

    [Fact]
    public void Starts_without_a_provider_and_off_in_every_work()
    {
        var state = Squire.State();

        state.Provider.ShouldBeNull();
        state.Enabled.ShouldBeFalse();
        state.Status.ShouldBe(SquireStatus.Off);
        state.Pending.ShouldBe(0);
    }

    [Fact]
    public void Keeps_the_choice_in_the_settings_and_the_key_in_the_store_only()
    {
        Squire.Configure(SquireProvider.Gemini, " gemini-2.5-flash ", null, Main);
        Squire.SetKey(SquireProvider.Gemini, " g-clave ", Main).HasKey.ShouldBeTrue();

        _app.Settings.Squire.ShouldBe(new Settings.SquireChoice("gemini", "gemini-2.5-flash", null));
        _app.Secrets.Read("gemini").ShouldBe("g-clave");
        _app.Store.Stored.ToString().ShouldNotContain("g-clave");

        Squire.ForgetKey(SquireProvider.Gemini, Main).HasKey.ShouldBeFalse();
        _app.Secrets.Read("gemini").ShouldBeNull();
    }

    [Fact]
    public async Task Reads_a_finished_paragraph_and_proposes_what_is_new()
    {
        Antonio();
        Ready();

        await Read();

        var pending = Squire.Pending();
        pending.Select(proposal => proposal.Kind).ShouldBe(
            [ProposalKind.Element, ProposalKind.Relationship, ProposalKind.Attribute], ignoreOrder: true);
        pending.Single(proposal => proposal.Kind == ProposalKind.Element).Element!.Name.ShouldBe("Claudio");
        pending.ShouldAllBe(proposal => proposal.Passage == Paragraph && proposal.DocumentId == _chapter);
        _app.SquireClient.Asked.ShouldHaveSingleItem().Question.ShouldContain("- Antonio");
        Squire.State().Pending.ShouldBe(3);
        _app.Notifier.Events.ShouldContain("squire.changed:squire");
    }

    [Fact]
    public async Task Does_not_read_a_paragraph_again_nor_anything_while_off()
    {
        Squire.Configure(SquireProvider.Ollama, "llama3.1", null, Main);
        await Read();
        _app.SquireClient.Asked.ShouldBeEmpty();

        Squire.Enable(true, Main);
        await Read();
        await Read("  " + Paragraph + " ");

        _app.SquireClient.Asked.ShouldHaveSingleItem().Connection.Key.ShouldBeNull();
    }

    [Fact]
    public async Task Says_what_went_wrong_and_the_writing_goes_on()
    {
        Ready();
        _app.SquireClient.Failure = DomainError.SquireUnavailable;

        await Read();

        Squire.State().Status.ShouldBe(SquireStatus.Problem);
        Squire.State().Problem.ShouldBe(DomainError.SquireUnavailable);
        Squire.Pending().ShouldBeEmpty();

        _app.SquireClient.Failure = null;
        await Read();
        Squire.State().Status.ShouldBe(SquireStatus.Idle);
        Squire.Pending().ShouldNotBeEmpty();
    }

    [Fact]
    public async Task Without_a_key_it_says_so()
    {
        Squire.Configure(SquireProvider.OpenAI, "gpt", null, Main);
        Squire.Enable(true, Main);

        await Read();

        Squire.State().Problem.ShouldBe(DomainError.SquireKeyMissing);
        (await Squire.TestAsync(CancellationToken.None)).ShouldBe(DomainError.SquireKeyMissing);
    }

    [Fact]
    public async Task Accepting_makes_the_ficha_the_relationship_and_the_attribute()
    {
        var antonio = Antonio();
        Ready();
        await Read();
        var pending = Squire.Pending();

        Squire.Accept(pending.Single(proposal => proposal.Kind == ProposalKind.Element).Id, null, Main);
        Squire.Accept(pending.Single(proposal => proposal.Kind == ProposalKind.Relationship).Id, null, Main);
        Squire.Accept(pending.Single(proposal => proposal.Kind == ProposalKind.Attribute).Id, null, Main);

        var board = _app.Elements.Board();
        var claudio = board.Elements.Single(element => element.Name == "Claudio");
        board.Relationships.ShouldHaveSingleItem().From.ShouldBe(claudio.Id);
        board.Find(antonio.Id).Attributes.ShouldContain(new ElementAttribute("Pelo", "pelirrojo"));
        Squire.Pending().ShouldBeEmpty();
        _app.Notifier.Events.ShouldContain("elements.changed:main");
    }

    [Fact]
    public async Task Accepting_takes_the_writers_corrections()
    {
        Ready();
        await Read();
        var element = Squire.Pending().Single(proposal => proposal.Kind == ProposalKind.Element && proposal.Element!.Name == "Claudio");

        Squire.Accept(element.Id, new ProposalCorrection(Name: "Claudio el Joven", Kind: ElementKind.Other, OtherKind: "Pariente"), Main);

        var made = _app.Elements.Board().Elements.ShouldHaveSingleItem();
        made.Name.ShouldBe("Claudio el Joven");
        made.OtherKind.ShouldBe("Pariente");
    }

    [Fact]
    public async Task A_relationship_with_a_ficha_that_is_not_there_waits_for_it()
    {
        Ready();
        await Read();
        var relationship = Squire.Pending().Single(proposal => proposal.Kind == ProposalKind.Relationship);

        Should.Throw<DomainException>(() => Squire.Accept(relationship.Id, null, Main)).Error.ShouldBe(DomainError.ProposalElementMissing);
        Squire.Pending().ShouldContain(proposal => proposal.Id == relationship.Id);
    }

    [Fact]
    public async Task A_dismissed_proposal_does_not_come_back_for_its_paragraph()
    {
        Ready();
        await Read();
        var element = Squire.Pending().Single(proposal => proposal.Kind == ProposalKind.Element && proposal.Element!.Name == "Claudio");

        Squire.Dismiss(element.Id, Main);
        Should.Throw<DomainException>(() => Squire.Dismiss(element.Id, Main)).Error.ShouldBe(DomainError.ProposalNotFound);

        await Read(Paragraph + " Y se quedó.");
        Squire.Pending().Count(proposal => proposal.Element?.Name == "Claudio").ShouldBe(1);
    }

    [Fact]
    public async Task Lists_the_models_of_Ollama_and_tests_the_connection()
    {
        (await Squire.ModelsAsync(SquireProvider.Ollama, null, CancellationToken.None)).ShouldBe(["llama3.1"]);
        (await Squire.TestAsync(CancellationToken.None)).ShouldBe(DomainError.SquireNotConfigured);

        Ready(SquireProvider.Ollama);
        (await Squire.TestAsync(CancellationToken.None)).ShouldBeNull();
    }
}
