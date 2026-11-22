using Rocinante.Application.Ports;

namespace Rocinante.Infrastructure.Settings;

/// <summary>
/// <c>ambience/</c> inside the app data folder. A copy goes first to a temporary file that then
/// takes its final name, so the folder never holds half an image; a temporary file left by a crash
/// is not listed under a name the settings know, and the next start deletes it.
/// </summary>
public sealed class AmbienceFolder(string dataDirectory) : IAmbienceFolder
{
    public const string Name = "ambience";

    public string Path { get; } = System.IO.Path.Combine(dataDirectory, Name);

    public string PathOf(string fileName) => System.IO.Path.Combine(Path, Checked(fileName));

    public FileSample Sample(string path, int headLength)
    {
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
            var head = new byte[Math.Min(headLength, stream.Length)];
            stream.ReadExactly(head);
            return new FileSample(stream.Length, head);
        }
        catch (Exception exception) when (exception is FileNotFoundException or DirectoryNotFoundException)
        {
            throw new ProjectFileException(ProjectFileError.NotFound, path, "The chosen file is not there.", exception);
        }
        catch (UnauthorizedAccessException exception)
        {
            throw new ProjectFileException(ProjectFileError.NotFound, path, "The chosen file cannot be read.", exception);
        }
    }

    public void Copy(string source, string fileName)
    {
        Directory.CreateDirectory(Path);
        var target = PathOf(fileName);
        var temporary = target + ".tmp";
        try
        {
            File.Copy(source, temporary, overwrite: true);
            File.Move(temporary, target, overwrite: true);
        }
        catch (Exception exception) when (exception is FileNotFoundException or DirectoryNotFoundException)
        {
            File.Delete(temporary);
            throw new ProjectFileException(ProjectFileError.NotFound, source, "The chosen file went away while it was being copied.", exception);
        }
    }

    public void Delete(string fileName)
    {
        var path = PathOf(fileName);
        if (Directory.Exists(Path))
        {
            File.Delete(path);
        }
    }

    public IReadOnlyList<string> Files() =>
        Directory.Exists(Path) ? [.. Directory.EnumerateFiles(Path).Select(file => System.IO.Path.GetFileName(file))] : [];

    // Names come from the settings file, which anyone can edit: never let one leave the folder.
    private static string Checked(string fileName) =>
        fileName.Length > 0 && System.IO.Path.GetFileName(fileName) == fileName && fileName is not ("." or "..")
            ? fileName
            : throw new ArgumentException("Not a file name inside the ambience folder.", nameof(fileName));
}
