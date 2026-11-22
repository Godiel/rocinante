namespace Rocinante.Domain.Elements;

/// <summary>Rules for the short texts the writer gives to elements and relationships.</summary>
internal static class Names
{
    /// <summary>Trims <paramref name="text"/> and checks it is neither blank nor longer than <paramref name="maxLength"/>.</summary>
    public static string Required(string? text, int maxLength, string what)
    {
        var trimmed = text?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            throw new DomainException(DomainError.NameRequired, $"{what} needs a name.");
        }

        return Bounded(trimmed, maxLength, what);
    }

    public static string Bounded(string text, int maxLength, string what) =>
        text.Length <= maxLength
            ? text
            : throw new ArgumentOutOfRangeException(nameof(text), $"{what} cannot exceed {maxLength} characters.");
}
