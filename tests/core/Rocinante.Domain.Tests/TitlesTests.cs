namespace Rocinante.Domain.Tests;

public sealed class TitlesTests
{
    [Fact]
    public void Trims_the_title()
    {
        Titles.Normalize("  El retablo de maese Pedro  ").ShouldBe("El retablo de maese Pedro");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \t ")]
    public void Requires_some_text(string? title)
    {
        Should.Throw<DomainException>(() => Titles.Normalize(title)).Error.ShouldBe(DomainError.TitleRequired);
    }

    [Fact]
    public void Accepts_the_maximum_length()
    {
        var title = new string('a', Titles.MaxLength);

        Titles.Normalize(title).ShouldBe(title);
    }

    [Fact]
    public void Rejects_longer_titles()
    {
        Should.Throw<DomainException>(() => Titles.Normalize(new string('a', Titles.MaxLength + 1)))
            .Error.ShouldBe(DomainError.TitleTooLong);
    }
}
