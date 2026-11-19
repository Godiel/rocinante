using Rocinante.Domain.Formats;
using Rocinante.Domain.Projects;

namespace Rocinante.Domain.Tests.Projects;

public sealed class ProjectTests
{
    private readonly Project _project = Project.Create("El ingenioso hidalgo", Moments.Start);

    [Fact]
    public void A_new_project_is_empty_and_has_a_normalized_title()
    {
        var project = Project.Create("  La Galatea ", Moments.Start);

        project.Title.ShouldBe("La Galatea");
        project.CreatedAt.ShouldBe(Moments.Start);
        project.Chapters.ShouldBeEmpty();
        project.Fragments.ShouldBeEmpty();
        project.Trash.ShouldBeEmpty();
    }

    [Fact]
    public void A_new_project_takes_the_format_it_is_given_or_the_default()
    {
        var pocket = WorkFormat.Create(
            PageSize.Pocket, 110, 170, new PageMargins(14, 18, 16, 12), Typeface.Literata, 10, 1.3, true, true, false);

        Project.Create("Novelas ejemplares", Moments.Start, pocket).Format.ShouldBe(pocket);
        _project.Format.ShouldBe(WorkFormat.Default);
    }

    [Fact]
    public void Its_format_can_be_changed()
    {
        var letter = WorkFormat.Create(
            PageSize.Letter, 215.9, 279.4, new PageMargins(25, 25, 25, 25), Typeface.SourceSerif4, 12, 1.5, false, false, true);

        _project.ChangeFormat(letter);

        _project.Format.ShouldBe(letter);
        Should.Throw<ArgumentNullException>(() => _project.ChangeFormat(null!));
    }

    [Fact]
    public void Can_be_renamed_but_never_left_without_a_title()
    {
        _project.Rename("Don Quijote");

        _project.Title.ShouldBe("Don Quijote");
        Should.Throw<DomainException>(() => _project.Rename(" ")).Error.ShouldBe(DomainError.TitleRequired);
    }

    [Fact]
    public void Chapters_are_added_at_the_end_in_reading_order()
    {
        var first = _project.AddChapter("Uno", Moments.At(1));
        var second = _project.AddChapter("Dos", Moments.At(2));

        TitlesOf(_project.Chapters).ShouldBe(["Uno", "Dos"]);
        first.Position.ShouldBe(0);
        second.Position.ShouldBe(1);
        second.Kind.ShouldBe(DocumentKind.Chapter);
        second.CreatedAt.ShouldBe(Moments.At(2));
    }

    [Fact]
    public void A_chapter_can_be_inserted_at_any_place()
    {
        _project.AddChapter("Uno", Moments.At(1));
        _project.AddChapter("Tres", Moments.At(2));

        _project.AddChapter("Dos", Moments.At(3), index: 1);

        TitlesOf(_project.Chapters).ShouldBe(["Uno", "Dos", "Tres"]);
        Positions(_project.Chapters).ShouldBe([0, 1, 2]);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(2)]
    public void Cannot_insert_outside_the_list(int index)
    {
        _project.AddChapter("Uno", Moments.At(1));

        Should.Throw<DomainException>(() => _project.AddChapter("Otro", Moments.At(2), index))
            .Error.ShouldBe(DomainError.PositionOutOfRange);
    }

    [Fact]
    public void Fragments_live_in_their_own_drawer()
    {
        _project.AddChapter("Capítulo", Moments.At(1));
        var fragment = _project.AddFragment("Idea suelta", Moments.At(2));

        fragment.Kind.ShouldBe(DocumentKind.Fragment);
        fragment.Position.ShouldBe(0);
        TitlesOf(_project.Fragments).ShouldBe(["Idea suelta"]);
        TitlesOf(_project.Chapters).ShouldBe(["Capítulo"]);
    }

    [Fact]
    public void Documents_can_be_renamed()
    {
        var chapter = _project.AddChapter("Borrador", Moments.At(1));

        _project.RenameDocument(chapter.Id, " Capítulo primero ");

        chapter.Title.ShouldBe("Capítulo primero");
    }

    [Fact]
    public void Unknown_documents_are_reported()
    {
        Should.Throw<DomainException>(() => _project.Find(DocumentId.New(Moments.Start)))
            .Error.ShouldBe(DomainError.DocumentNotFound);
    }

    [Theory]
    [InlineData(0, 2, new[] { "B", "C", "A" })]
    [InlineData(2, 0, new[] { "C", "A", "B" })]
    [InlineData(1, 1, new[] { "A", "B", "C" })]
    public void Chapters_are_reordered_by_moving_one(int from, int to, string[] expected)
    {
        AddChapters("A", "B", "C");

        _project.Move(_project.Chapters[from].Id, DocumentKind.Chapter, to);

        TitlesOf(_project.Chapters).ShouldBe(expected);
        Positions(_project.Chapters).ShouldBe([0, 1, 2]);
    }

    [Fact]
    public void Moving_within_a_list_cannot_go_past_its_last_place()
    {
        AddChapters("A", "B");

        Should.Throw<DomainException>(() => _project.Move(_project.Chapters[0].Id, DocumentKind.Chapter, 2))
            .Error.ShouldBe(DomainError.PositionOutOfRange);
    }

    [Fact]
    public void Dragging_a_fragment_among_the_chapters_makes_it_a_chapter()
    {
        AddChapters("A", "C");
        var fragment = _project.AddFragment("B", Moments.At(5));

        _project.Move(fragment.Id, DocumentKind.Chapter, 1);

        fragment.Kind.ShouldBe(DocumentKind.Chapter);
        TitlesOf(_project.Chapters).ShouldBe(["A", "B", "C"]);
        Positions(_project.Chapters).ShouldBe([0, 1, 2]);
        _project.Fragments.ShouldBeEmpty();
    }

    [Fact]
    public void A_chapter_can_become_a_fragment_and_the_rest_close_up()
    {
        AddChapters("A", "B", "C");
        var chapter = _project.Chapters[1];

        _project.Convert(chapter.Id, DocumentKind.Fragment);

        chapter.Kind.ShouldBe(DocumentKind.Fragment);
        chapter.Position.ShouldBe(0);
        TitlesOf(_project.Chapters).ShouldBe(["A", "C"]);
        Positions(_project.Chapters).ShouldBe([0, 1]);
    }

    [Fact]
    public void Converting_to_the_same_kind_changes_nothing()
    {
        AddChapters("A", "B");

        _project.Convert(_project.Chapters[0].Id, DocumentKind.Chapter);

        TitlesOf(_project.Chapters).ShouldBe(["A", "B"]);
    }

    [Fact]
    public void Converting_appends_to_the_end_of_the_other_list()
    {
        _project.AddFragment("Uno", Moments.At(1));
        var chapter = _project.AddChapter("Dos", Moments.At(2));

        _project.Convert(chapter.Id, DocumentKind.Fragment);

        TitlesOf(_project.Fragments).ShouldBe(["Uno", "Dos"]);
    }

    [Fact]
    public void Deleting_sends_the_document_to_the_trash()
    {
        AddChapters("A", "B", "C");
        var deleted = _project.Chapters[1];

        _project.Delete(deleted.Id, Moments.At(10));

        TitlesOf(_project.Chapters).ShouldBe(["A", "C"]);
        Positions(_project.Chapters).ShouldBe([0, 1]);
        _project.Trash.ShouldBe([deleted]);
        deleted.IsDeleted.ShouldBeTrue();
        deleted.DeletedAt.ShouldBe(Moments.At(10));
        _project.Find(deleted.Id).ShouldBeSameAs(deleted);
    }

    [Fact]
    public void The_trash_shows_the_most_recent_first()
    {
        AddChapters("A", "B");
        var first = _project.Chapters[0];
        var second = _project.Chapters[1];

        _project.Delete(first.Id, Moments.At(10));
        _project.Delete(second.Id, Moments.At(11));

        _project.Trash.ShouldBe([second, first]);
    }

    [Fact]
    public void A_deleted_document_returns_to_its_place()
    {
        AddChapters("A", "B", "C");
        var deleted = _project.Chapters[1];
        _project.Delete(deleted.Id, Moments.At(10));

        _project.Restore(deleted.Id);

        TitlesOf(_project.Chapters).ShouldBe(["A", "B", "C"]);
        Positions(_project.Chapters).ShouldBe([0, 1, 2]);
        deleted.IsDeleted.ShouldBeFalse();
        _project.Trash.ShouldBeEmpty();
    }

    [Fact]
    public void If_its_place_no_longer_exists_it_returns_at_the_end()
    {
        AddChapters("A", "B", "C");
        var last = _project.Chapters[2];
        _project.Delete(last.Id, Moments.At(10));
        _project.Delete(_project.Chapters[1].Id, Moments.At(11));

        _project.Restore(last.Id);

        TitlesOf(_project.Chapters).ShouldBe(["A", "C"]);
    }

    [Fact]
    public void A_deleted_fragment_returns_to_the_drawer()
    {
        var fragment = _project.AddFragment("Suelto", Moments.At(1));
        _project.Delete(fragment.Id, Moments.At(2));

        _project.Restore(fragment.Id);

        _project.Fragments.ShouldBe([fragment]);
        _project.Chapters.ShouldBeEmpty();
    }

    [Fact]
    public void Documents_in_the_trash_cannot_be_moved_converted_or_deleted_again()
    {
        var chapter = _project.AddChapter("A", Moments.At(1));
        _project.Delete(chapter.Id, Moments.At(2));

        Should.Throw<DomainException>(() => _project.Move(chapter.Id, DocumentKind.Chapter, 0))
            .Error.ShouldBe(DomainError.DocumentIsDeleted);
        Should.Throw<DomainException>(() => _project.Convert(chapter.Id, DocumentKind.Fragment))
            .Error.ShouldBe(DomainError.DocumentIsDeleted);
        Should.Throw<DomainException>(() => _project.Delete(chapter.Id, Moments.At(3)))
            .Error.ShouldBe(DomainError.DocumentIsDeleted);
    }

    [Fact]
    public void Only_documents_in_the_trash_can_be_restored()
    {
        var chapter = _project.AddChapter("A", Moments.At(1));

        Should.Throw<DomainException>(() => _project.Restore(chapter.Id)).Error.ShouldBe(DomainError.DocumentIsNotDeleted);
    }

    [Fact]
    public void Rehydrating_orders_documents_and_closes_gaps_in_positions()
    {
        var id = ProjectId.New(Moments.Start);
        var entries = new[]
        {
            Entry("C", DocumentKind.Chapter, position: 7, createdAt: 1),
            Entry("A", DocumentKind.Chapter, position: 2, createdAt: 2),
            Entry("B", DocumentKind.Chapter, position: 2, createdAt: 3),
            Entry("Suelto", DocumentKind.Fragment, position: 4, createdAt: 4),
            Entry("Viejo", DocumentKind.Chapter, position: 1, createdAt: 5, deletedAt: 20),
            Entry("Reciente", DocumentKind.Fragment, position: 0, createdAt: 6, deletedAt: 30),
        };

        var project = Project.Rehydrate(id, "Obra", Moments.Start, entries);

        project.Id.ShouldBe(id);
        project.Title.ShouldBe("Obra");
        TitlesOf(project.Chapters).ShouldBe(["A", "B", "C"]);
        Positions(project.Chapters).ShouldBe([0, 1, 2]);
        Positions(project.Fragments).ShouldBe([0]);
        TitlesOf(project.Trash).ShouldBe(["Reciente", "Viejo"]);
        project.Trash[1].Position.ShouldBe(1);
    }

    private void AddChapters(params string[] titles)
    {
        for (var index = 0; index < titles.Length; index++)
        {
            _project.AddChapter(titles[index], Moments.At(index + 1));
        }
    }

    private static DocumentEntry Entry(string title, DocumentKind kind, int position, int createdAt, int? deletedAt = null) =>
        DocumentEntry.Rehydrate(
            DocumentId.New(Moments.At(createdAt)),
            kind,
            title,
            position,
            Moments.At(createdAt),
            deletedAt is null ? null : Moments.At(deletedAt.Value));

    private static string[] TitlesOf(IEnumerable<DocumentEntry> entries) => [.. entries.Select(entry => entry.Title)];

    private static int[] Positions(IEnumerable<DocumentEntry> entries) => [.. entries.Select(entry => entry.Position)];
}
