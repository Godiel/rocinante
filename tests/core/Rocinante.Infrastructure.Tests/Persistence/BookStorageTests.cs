using Rocinante.Domain.Books;
using Rocinante.Domain.Projects;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class BookStorageTests : IDisposable
{
    private readonly ProjectFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    [Fact]
    public void A_new_work_has_no_author_nor_cover_and_the_default_credits()
    {
        var details = new BookRepository(_fixture.Database).Load();

        details.Author.ShouldBe(string.Empty);
        details.Credits.ShouldBeNull();
        details.CoverVersion.ShouldBeNull();
        new BookRepository(_fixture.Database).LoadCover().ShouldBeNull();
    }

    [Fact]
    public void The_author_the_credits_and_the_cover_survive_closing_the_file()
    {
        var books = new BookRepository(_fixture.Database);
        var details = books.Load().WithAuthor("Miguel de Cervantes").WithCredits("Primera edición.\nMadrid");
        books.Save(details);
        var covered = details.WithCover();
        books.SaveCover(covered, new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 });

        var reopened = new BookRepository(_fixture.Reopen());
        reopened.Load().ShouldBe(covered);
        reopened.LoadCover()!.Value.ToArray().ShouldBe([0xFF, 0xD8, 0xFF, 0xE0]);

        var bare = covered.WithoutCover();
        reopened.SaveCover(bare, null);
        reopened.Load().CoverVersion.ShouldBeNull();
        reopened.Load().LastCoverVersion.ShouldBe(1);
        reopened.LoadCover().ShouldBeNull();
    }

    [Fact]
    public void A_work_of_schema_seven_gets_an_empty_book_on_opening()
    {
        using var folder = new TempFolder();
        var path = folder.File("antigua.rocinante");
        using (ProjectDatabase.CreateAtVersion(path, Project.Create("Antigua", Moments.Start), 7))
        {
        }

        using var opened = ProjectDatabase.Open(path);
        new BookRepository(opened).Load().ShouldBe(BookDetails.Empty);
    }
}
