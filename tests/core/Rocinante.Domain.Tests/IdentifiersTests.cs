namespace Rocinante.Domain.Tests;

public sealed class IdentifiersTests
{
    [Fact]
    public void New_identifiers_are_uuid_v7_and_sort_by_creation_time()
    {
        var first = DocumentId.New(Moments.At(0));
        var second = DocumentId.New(Moments.At(1));

        first.Value.Version.ShouldBe(7);
        first.Value.CompareTo(second.Value).ShouldBeLessThan(0);
    }

    [Fact]
    public void Every_kind_of_identifier_prints_as_its_guid()
    {
        var now = Moments.Start;
        var project = ProjectId.New(now);
        var document = DocumentId.New(now);
        var version = VersionId.New(now);
        var note = NoteId.New(now);

        project.ToString().ShouldBe(project.Value.ToString());
        document.ToString().ShouldBe(document.Value.ToString());
        version.ToString().ShouldBe(version.Value.ToString());
        note.ToString().ShouldBe(note.Value.ToString());
        new[] { project.Value, document.Value, version.Value, note.Value }.Distinct().Count().ShouldBe(4);
    }
}
