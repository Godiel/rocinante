namespace Rocinante.Application.Ports;

/// <summary>
/// Where an exported book is written: first to a file of its own beside the destination, which takes its place
/// only once whole, so a failure never leaves half a book where the writer asked for one.
/// </summary>
public interface IExportFiles
{
    /// <summary>Opens the file the book is written to while it is not finished.</summary>
    Stream Begin(string path);

    /// <summary>Puts the finished book at <paramref name="path"/>, replacing what was there. Returns its size.</summary>
    long Commit(string path);

    /// <summary>Removes what was written, after a failure.</summary>
    void Discard(string path);
}
