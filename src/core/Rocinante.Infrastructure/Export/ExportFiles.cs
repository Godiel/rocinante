using Rocinante.Application.Ports;

namespace Rocinante.Infrastructure.Export;

/// <summary>Writes a book beside its destination under another name and moves it into place when whole.</summary>
public sealed class ExportFiles : IExportFiles
{
    public Stream Begin(string path)
    {
        var full = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        return new FileStream(Unfinished(full), FileMode.Create, FileAccess.ReadWrite, FileShare.None);
    }

    public long Commit(string path)
    {
        var full = Path.GetFullPath(path);
        File.Move(Unfinished(full), full, overwrite: true);
        return new FileInfo(full).Length;
    }

    public void Discard(string path)
    {
        var unfinished = Unfinished(Path.GetFullPath(path));
        if (File.Exists(unfinished))
        {
            File.Delete(unfinished);
        }
    }

    private static string Unfinished(string full) =>
        Path.Combine(Path.GetDirectoryName(full)!, $".{Path.GetFileName(full)}.rocinante-export");
}
