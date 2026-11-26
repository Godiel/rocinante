using Rocinante.Domain.Projects;

namespace Rocinante.Application.Ports;

/// <summary>Creates and opens project files.</summary>
public interface IProjectFiles
{
    /// <summary>Creates a new file holding <paramref name="project"/>. Fails if the path is taken.</summary>
    IProjectSession Create(string path, Project project);

    /// <summary>Opens an existing file after checking it is a project this version understands.</summary>
    IProjectSession Open(string path);
}

/// <summary>An open project file and the repositories over it.</summary>
public interface IProjectSession : IDisposable
{
    string FilePath { get; }

    IProjectRepository Projects { get; }

    IDocumentRepository Documents { get; }

    IVersionRepository Versions { get; }

    INoteRepository Notes { get; }

    IProposalRepository Proposals { get; }

    IElementRepository Elements { get; }

    /// <summary>Runs <paramref name="work"/> so that every write inside it is kept, or none is.</summary>
    T InTransaction<T>(Func<T> work);

    /// <summary>Writes a complete copy of the project to a new file. Fails if the path is taken.</summary>
    void SaveCopyAs(string path);
}
