using Rocinante.Domain.Formats;

namespace Rocinante.Domain.Tests.Formats;

public sealed class WorkFormatTests
{
    private static readonly PageMargins _printer = new(Top: 18, Bottom: 22, Inside: 20, Outside: 15);

    private static WorkFormat Format(
        double width = 148,
        double height = 210,
        PageMargins? margins = null,
        double bodySize = 11,
        double leading = 1.35,
        PageSize size = PageSize.A5,
        Typeface typeface = Typeface.EbGaramond) =>
        WorkFormat.Create(size, width, height, margins ?? _printer, typeface, bodySize, leading, true, true, false);

    [Fact]
    public void The_default_is_an_a5_novel()
    {
        var format = WorkFormat.Default;

        format.PageSize.ShouldBe(PageSize.A5);
        (format.PageWidth, format.PageHeight).ShouldBe((148, 210));
        format.Typeface.ShouldBe(Typeface.EbGaramond);
        format.BodySize.ShouldBe(11);
        format.Leading.ShouldBe(1.35);
        format.FirstLineIndent.ShouldBeTrue();
        format.Justified.ShouldBeTrue();
        format.DropCap.ShouldBeFalse();
    }

    [Fact]
    public void Keeps_every_setting_it_was_given()
    {
        var format = WorkFormat.Create(
            PageSize.Custom, 130, 200, new PageMargins(10, 12, 14, 9), Typeface.CourierPrime, 9.5, 1.6, false, false, true);

        format.PageSize.ShouldBe(PageSize.Custom);
        (format.PageWidth, format.PageHeight).ShouldBe((130, 200));
        format.Margins.ShouldBe(new PageMargins(10, 12, 14, 9));
        format.Typeface.ShouldBe(Typeface.CourierPrime);
        (format.BodySize, format.Leading).ShouldBe((9.5, 1.6));
        (format.FirstLineIndent, format.Justified, format.DropCap).ShouldBe((false, false, true));
    }

    [Fact]
    public void Two_formats_with_the_same_settings_are_equal()
    {
        Format().ShouldBe(Format());
        Format().ShouldNotBe(Format(bodySize: 12));
    }

    [Theory]
    [InlineData(70, 70)]
    [InlineData(300, 300)]
    public void Accepts_the_page_limits(double width, double height)
    {
        var margins = new PageMargins(0, 0, 0, 0);

        Should.NotThrow(() => Format(width, height, margins));
    }

    [Theory]
    [InlineData(69.9, 210)]
    [InlineData(148, 300.1)]
    [InlineData(double.NaN, 210)]
    public void Refuses_pages_out_of_range(double width, double height)
    {
        Should.Throw<DomainException>(() => Format(width, height)).Error.ShouldBe(DomainError.FormatOutOfRange);
    }

    [Theory]
    [InlineData(7.9, 1.35)]
    [InlineData(16.1, 1.35)]
    [InlineData(11, 0.99)]
    [InlineData(11, 2.01)]
    public void Refuses_type_out_of_range(double bodySize, double leading)
    {
        Should.Throw<DomainException>(() => Format(bodySize: bodySize, leading: leading))
            .Error.ShouldBe(DomainError.FormatOutOfRange);
    }

    [Fact]
    public void Refuses_negative_margins()
    {
        Should.Throw<DomainException>(() => Format(margins: _printer with { Outside = -1 }))
            .Error.ShouldBe(DomainError.FormatOutOfRange);
    }

    [Fact]
    public void Refuses_unknown_names()
    {
        Should.Throw<DomainException>(() => Format(size: (PageSize)99)).Error.ShouldBe(DomainError.FormatOutOfRange);
        Should.Throw<DomainException>(() => Format(typeface: (Typeface)99)).Error.ShouldBe(DomainError.FormatOutOfRange);
    }

    [Fact]
    public void The_margins_must_leave_room_for_the_text()
    {
        // 148 − 54 − 54 = 40 mm wide and 210 − 75 − 75 = 60 mm high: just enough.
        Should.NotThrow(() => Format(margins: new PageMargins(75, 75, 54, 54)));

        Should.Throw<DomainException>(() => Format(margins: new PageMargins(75, 75, 54, 54.1)))
            .Error.ShouldBe(DomainError.TextAreaTooSmall);
        Should.Throw<DomainException>(() => Format(margins: new PageMargins(75.1, 75, 54, 54)))
            .Error.ShouldBe(DomainError.TextAreaTooSmall);
    }
}
