using System.Globalization;

namespace Rocinante.Domain.Formats;

/// <summary>The named page sizes the writer can pick. The name is a label; the measures live in the format.</summary>
public enum PageSize
{
    /// <summary>11 × 17 cm.</summary>
    Pocket,
    A5,

    /// <summary>5.5 × 8.5 in.</summary>
    Digest,

    /// <summary>6 × 9 in.</summary>
    Trade,
    A4,
    Letter,
    Custom,
}

/// <summary>The typefaces bundled with the app for the text of the work.</summary>
public enum Typeface
{
    EbGaramond,
    Literata,
    CrimsonPro,
    SourceSerif4,
    LibreBaskerville,
    CourierPrime,
}

/// <summary>The four margins of a page, in millimetres. Inside is the one next to the spine.</summary>
public sealed record PageMargins(double Top, double Bottom, double Inside, double Outside);

/// <summary>
/// How a work is set: the page of the book it will be, its margins and its type. Lengths are in
/// millimetres and the body in points, the units of a printer and of CSS.
/// </summary>
public sealed record WorkFormat
{
    public const double MinPageSide = 70;
    public const double MaxPageSide = 300;
    public const double MinTextWidth = 40;
    public const double MinTextHeight = 60;
    public const double MinBodySize = 8;
    public const double MaxBodySize = 16;
    public const double MinLeading = 1;
    public const double MaxLeading = 2;

    /// <summary>What a new work gets when there is nothing to suggest: an A5 novel.</summary>
    public static readonly WorkFormat Default = Create(
        PageSize.A5,
        148,
        210,
        new PageMargins(Top: 18, Bottom: 22, Inside: 20, Outside: 15),
        Typeface.EbGaramond,
        bodySize: 11,
        leading: 1.35,
        firstLineIndent: true,
        justified: true,
        dropCap: false);

    private WorkFormat()
    {
    }

    public PageSize PageSize { get; private init; }

    public double PageWidth { get; private init; }

    public double PageHeight { get; private init; }

    public PageMargins Margins { get; private init; } = null!;

    public Typeface Typeface { get; private init; }

    /// <summary>Size of the text, in points.</summary>
    public double BodySize { get; private init; }

    /// <summary>Line height as a multiple of the body size.</summary>
    public double Leading { get; private init; }

    /// <summary>Indent the first line of each paragraph that follows another.</summary>
    public bool FirstLineIndent { get; private init; }

    /// <summary>Justified text; otherwise aligned to the left.</summary>
    public bool Justified { get; private init; }

    /// <summary>A drop cap at the start of each chapter.</summary>
    public bool DropCap { get; private init; }

    /// <summary>Checks every measure and builds the format, or says which rule it breaks.</summary>
    public static WorkFormat Create(
        PageSize pageSize,
        double pageWidth,
        double pageHeight,
        PageMargins margins,
        Typeface typeface,
        double bodySize,
        double leading,
        bool firstLineIndent,
        bool justified,
        bool dropCap)
    {
        ArgumentNullException.ThrowIfNull(margins);

        Within("page width", pageWidth, MinPageSide, MaxPageSide);
        Within("page height", pageHeight, MinPageSide, MaxPageSide);
        Within("top margin", margins.Top, 0, MaxPageSide);
        Within("bottom margin", margins.Bottom, 0, MaxPageSide);
        Within("inside margin", margins.Inside, 0, MaxPageSide);
        Within("outside margin", margins.Outside, 0, MaxPageSide);
        Within("body size", bodySize, MinBodySize, MaxBodySize);
        Within("leading", leading, MinLeading, MaxLeading);
        if (!Enum.IsDefined(pageSize) || !Enum.IsDefined(typeface))
        {
            throw new DomainException(DomainError.FormatOutOfRange, "Unknown page size or typeface.");
        }

        var textWidth = pageWidth - margins.Inside - margins.Outside;
        var textHeight = pageHeight - margins.Top - margins.Bottom;
        if (textWidth < MinTextWidth || textHeight < MinTextHeight)
        {
            throw new DomainException(
                DomainError.TextAreaTooSmall,
                string.Create(
                    CultureInfo.InvariantCulture,
                    $"The margins leave a text area of {textWidth} × {textHeight} mm; it must be at least {MinTextWidth} × {MinTextHeight} mm."));
        }

        return new WorkFormat
        {
            PageSize = pageSize,
            PageWidth = pageWidth,
            PageHeight = pageHeight,
            Margins = margins,
            Typeface = typeface,
            BodySize = bodySize,
            Leading = leading,
            FirstLineIndent = firstLineIndent,
            Justified = justified,
            DropCap = dropCap,
        };
    }

    private static void Within(string what, double value, double minimum, double maximum)
    {
        if (double.IsNaN(value) || value < minimum || value > maximum)
        {
            throw new DomainException(
                DomainError.FormatOutOfRange,
                string.Create(CultureInfo.InvariantCulture, $"The {what} must be between {minimum} and {maximum}; it was {value}."));
        }
    }
}
