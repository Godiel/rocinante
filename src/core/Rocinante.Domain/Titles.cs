namespace Rocinante.Domain;

/// <summary>Rules shared by every user-given title: projects, chapters and fragments.</summary>
public static class Titles
{
    public const int MaxLength = 200;

    /// <summary>Trims the title and checks it is neither empty nor too long.</summary>
    public static string Normalize(string? title)
    {
        var trimmed = title?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            throw new DomainException(DomainError.TitleRequired, "A title is required.");
        }

        if (trimmed.Length > MaxLength)
        {
            throw new DomainException(
                DomainError.TitleTooLong,
                $"A title cannot exceed {MaxLength} characters.");
        }

        return trimmed;
    }
}
