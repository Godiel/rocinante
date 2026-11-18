namespace Rocinante.Domain;

/// <summary>
/// Every rule the domain can refuse. The UI maps each one to a friendly message in Spanish;
/// the English message of <see cref="DomainException"/> is meant for logs and developers.
/// </summary>
public enum DomainError
{
    TitleRequired,
    TitleTooLong,
    VersionNameTooLong,
    NoteTextRequired,
    NoteTextTooLong,
    InvalidContent,
    DocumentNotFound,
    DocumentIsDeleted,
    DocumentIsNotDeleted,
    PositionOutOfRange,
    VersionOfAnotherDocument,
    VersionNotFound,
    NoteNotFound,
}
