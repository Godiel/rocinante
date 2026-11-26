namespace Rocinante.Application.Ports;

/// <summary>Files the writer chose with a system dialog, read once to be taken into the work.</summary>
public interface IChosenFiles
{
    /// <summary>The size and first <paramref name="headLength"/> bytes of a file; <see cref="ProjectFileError.NotFound"/> if it is not there.</summary>
    FileSample Sample(string path, int headLength);

    /// <summary>Every byte of a file; <see cref="ProjectFileError.NotFound"/> if it is not there.</summary>
    byte[] Read(string path);
}
