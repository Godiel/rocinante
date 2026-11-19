using Rocinante.Domain.Projects;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests;

/// <summary>A freshly created project file with two chapters and a fragment.</summary>
internal sealed class ProjectFixture : IDisposable
{
    private readonly TempFolder _folder = new();

    public ProjectFixture()
    {
        Project = Domain.Projects.Project.Create("El ingenioso hidalgo", Moments.Start);
        First = Project.AddChapter("Capítulo primero", Moments.At(1));
        Second = Project.AddChapter("Capítulo segundo", Moments.At(2));
        Fragment = Project.AddFragment("La aventura de los molinos", Moments.At(3));
        Path = _folder.File("quijote.rocinante");
        Database = ProjectDatabase.Create(Path, Project);
    }

    public string Path { get; }

    public Project Project { get; }

    public DocumentEntry First { get; }

    public DocumentEntry Second { get; }

    public DocumentEntry Fragment { get; }

    public ProjectDatabase Database { get; private set; }

    /// <summary>Closes the file and opens it again, as when the writer comes back the next day.</summary>
    public ProjectDatabase Reopen()
    {
        Database.Dispose();
        Database = ProjectDatabase.Open(Path);
        return Database;
    }

    public void Dispose()
    {
        Database.Dispose();
        _folder.Dispose();
    }
}
