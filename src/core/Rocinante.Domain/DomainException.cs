namespace Rocinante.Domain;

/// <summary>A domain rule was broken. <see cref="Error"/> says which one.</summary>
public sealed class DomainException : Exception
{
    public DomainException(DomainError error, string message)
        : base(message)
    {
        Error = error;
    }

    public DomainError Error { get; }
}
