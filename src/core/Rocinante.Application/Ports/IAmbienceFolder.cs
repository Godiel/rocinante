namespace Rocinante.Application.Ports;

/// <summary>The first bytes and the size of a file the writer chose.</summary>
public sealed record FileSample(long Length, byte[] Head);

/// <summary>
/// The folder inside the app data folder where the copies of the writer's own images and sounds
/// live. The interface may read this folder, and nothing else, through the host.
/// </summary>
public interface IAmbienceFolder
{
    /// <summary>The full path of a copy, for the interface to read it.</summary>
    string PathOf(string fileName);

    /// <summary>The size and first <paramref name="headLength"/> bytes of a file; <see cref="ProjectFileError.NotFound"/> if it is not there.</summary>
    FileSample Sample(string path, int headLength);

    /// <summary>Copies <paramref name="source"/> into the folder as <paramref name="fileName"/>, whole or not at all.</summary>
    void Copy(string source, string fileName);

    /// <summary>Deletes a copy; nothing happens if it is already gone.</summary>
    void Delete(string fileName);

    /// <summary>The names of every file in the folder.</summary>
    IReadOnlyList<string> Files();
}
