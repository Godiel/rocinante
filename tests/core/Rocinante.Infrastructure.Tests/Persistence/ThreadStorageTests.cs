using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Squire;
using Rocinante.Domain.Threads;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class ThreadStorageTests : IDisposable
{
    private const string Death = "Aquella noche murió el padre de Antonio.";
    private readonly ProjectFixture _fixture = new();
    private readonly Element _antonio;
    private readonly Element _claudio;

    public ThreadStorageTests()
    {
        var elements = new ElementRepository(_fixture.Database);
        var board = elements.LoadBoard();
        _antonio = board.Create(ElementKind.Character, null, "Antonio", null, null, Moments.At(4));
        _claudio = board.Create(ElementKind.Character, null, "Claudio", null, null, Moments.At(5));
        elements.Save(_antonio);
        elements.Save(_claudio);
    }

    public void Dispose() => _fixture.Dispose();

    private ThreadRepository Threads => new(_fixture.Database);

    [Fact]
    public void A_milestone_survives_closing_the_file_and_keeps_what_changed_of_it()
    {
        var milestone = Milestone.Create(_antonio.Id, _fixture.First.Id, Death, 2, "Muere su padre", Moments.At(6));
        Threads.Save(milestone);
        milestone.Rename("Muere su padre, de pronto");
        milestone.Follow(["Llovía.", Death]);
        Threads.Save(milestone);

        var reopened = new ThreadRepository(_fixture.Reopen()).Milestones().ShouldHaveSingleItem();

        reopened.Id.ShouldBe(milestone.Id);
        reopened.ElementId.ShouldBe(_antonio.Id);
        reopened.DocumentId.ShouldBe(_fixture.First.Id);
        reopened.Text.ShouldBe("Muere su padre, de pronto");
        reopened.Block.ShouldBe(1);
        reopened.Paragraph.ShouldBe(Death);
        reopened.Lost.ShouldBeFalse();
        reopened.CreatedAt.ShouldBe(Moments.At(6));

        Threads.Delete(milestone.Id);
        Threads.Milestones().ShouldBeEmpty();
    }

    [Fact]
    public void The_elements_shown_are_kept_in_order_once_the_writer_chooses()
    {
        Threads.Chosen().ShouldBeNull();

        Threads.Choose([_claudio.Id, _antonio.Id]);
        new ThreadRepository(_fixture.Reopen()).Chosen().ShouldBe([_claudio.Id, _antonio.Id]);

        Threads.Choose([]);
        Threads.Chosen().ShouldNotBeNull().ShouldBeEmpty();
    }

    [Fact]
    public void A_relationship_keeps_the_chapters_it_holds_between()
    {
        var elements = new ElementRepository(_fixture.Database);
        var board = elements.LoadBoard();
        var relationship = board.Relate(_antonio.Id, _claudio.Id, RelationshipKindId.Builtin("friend-of"), Moments.At(7));
        board.SetBounds(relationship.Id, _fixture.First.Id, _fixture.Second.Id);
        elements.Save(relationship);

        var reopened = new ElementRepository(_fixture.Reopen()).LoadBoard().FindRelationship(relationship.Id);
        reopened.Starts.ShouldBe(_fixture.First.Id);
        reopened.Ends.ShouldBe(_fixture.Second.Id);

        board.SetBounds(relationship.Id, null, null);
        new ElementRepository(_fixture.Database).Save(relationship);
        new ElementRepository(_fixture.Database).LoadBoard().FindRelationship(relationship.Id).Starts.ShouldBeNull();
    }

    [Fact]
    public void A_proposed_milestone_survives_closing_the_file()
    {
        var proposal = Proposal.ForMilestone(
            _fixture.First.Id, "huella", Death, new ProposedMilestone("Antonio", "Muere su padre"), Moments.At(8));
        new ProposalRepository(_fixture.Database).Save(proposal);

        var reopened = new ProposalRepository(_fixture.Reopen()).Load(proposal.Id);
        reopened.Kind.ShouldBe(ProposalKind.Milestone);
        reopened.Milestone.ShouldBe(proposal.Milestone);
    }
}

public sealed class SchemaSevenTests : IDisposable
{
    private readonly TempFolder _folder = new();

    public void Dispose() => _folder.Dispose();

    [Fact]
    public void A_work_of_schema_six_keeps_its_proposals_and_relationships_on_opening()
    {
        var path = _folder.File("antigua.rocinante");
        var project = Project.Create("Antigua", Moments.Start);
        var chapter = project.AddChapter("Uno", Moments.At(1));
        using (var old = ProjectDatabase.CreateAtVersion(path, project, 6))
        {
            new ProjectRepository(old).Save(project);
            old.Execute(
                """
                INSERT INTO proposal (id, document_id, paragraph, passage, created_at, kind, proposal_key, state, detail_element, detail_name, detail_value)
                VALUES ('0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b', $document, 'huella', 'Antonio era pelirrojo.', 1, 'attribute', 'attribute:antonio:pelo', 'pending', 'Antonio', 'Pelo', 'rojo');
                """,
                ("$document", Columns.Id(chapter.Id.Value)));
            old.ReadSchemaVersion().ShouldBe(6);
        }

        using var opened = ProjectDatabase.Open(path);

        opened.ReadSchemaVersion().ShouldBe(Migrations.Latest);
        var proposal = new ProposalRepository(opened).Pending().ShouldHaveSingleItem();
        proposal.Attribute.ShouldBe(new ProposedDetail("Antonio", "Pelo", "rojo"));
        new ThreadRepository(opened).Chosen().ShouldBeNull();
        new ThreadRepository(opened).Milestones().ShouldBeEmpty();
    }
}
