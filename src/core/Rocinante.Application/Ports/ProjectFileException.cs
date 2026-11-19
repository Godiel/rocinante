namespace Rocinante.Application.Ports;

/// <summary>Why a project file could not be created or opened.</summary>
public enum ProjectFileError
{
    /// <summary>There is no file at that path.</summary>
    NotFound,

    /// <summary>A file already exists where a new project was to be created.</summary>
    AlreadyExists,

    /// <summary>The file is not a Rocinante project (another kind of file, or another SQLite database).</summary>
    NotAProject,

    /// <summary>The project was saved by a newer Rocinante that this version does not understand.</summary>
    NewerVersion,

    /// <summary>The file is a project but it is damaged.</summary>
    Corrupted,
}

/// <summary>
/// A project file could not be used. The file is left exactly as it was: nothing is written to a
/// file until it has passed every check.
/// </summary>
public sealed class ProjectFileException : Exception
{
    public ProjectFileException(ProjectFileError error, string path, string message, Exception? innerException = null)
        : base(message, innerException)
    {
        Error = error;
        Path = path;
    }

    public ProjectFileError Error { get; }

    public string Path { get; }
}
