using Rocinante.Application.Ports;

namespace Rocinante.Infrastructure.Files;

/// <summary>Reads the files the writer chose, reporting a missing or unreadable one as not found.</summary>
public sealed class ChosenFiles : IChosenFiles
{
    public FileSample Sample(string path, int headLength) => Reading(path, () =>
    {
        using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        var head = new byte[Math.Min(headLength, stream.Length)];
        stream.ReadExactly(head);
        return new FileSample(stream.Length, head);
    });

    public byte[] Read(string path) => Reading(path, () => File.ReadAllBytes(path));

    private static T Reading<T>(string path, Func<T> read)
    {
        try
        {
            return read();
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
}
