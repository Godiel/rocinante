using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;

namespace Rocinante.Application;

/// <summary>One of the writer's own images or sounds, with the full path of its copy.</summary>
public sealed record OwnAmbienceView(Guid Id, OwnAmbienceKind Kind, string Name, string File);

/// <summary>
/// The images and sounds the writer adds. Each one is checked by its signature and size and copied
/// into the app's ambience folder, so it keeps working if the original moves. Messages never name
/// the writer's files: a file name can say what the work is about.
/// </summary>
public sealed class AmbienceUseCases(WriterSettings settings, IAmbienceFolder folder, IChangeNotifier notifier)
{
    public const long MaxImageBytes = 30L * 1024 * 1024;
    public const long MaxSoundBytes = 100L * 1024 * 1024;
    private const int MaxNameLength = 255;

    public IReadOnlyList<OwnAmbienceView> Own() =>
        [.. settings.Own.Select(own => new OwnAmbienceView(own.Id, own.Kind, own.Name, folder.PathOf(own.FileName)))];

    public OwnAmbienceView Import(string path, OwnAmbienceKind kind, string origin)
    {
        var full = Path.GetFullPath(path);
        var sample = folder.Sample(full, FileSignature.HeadLength);
        var what = kind == OwnAmbienceKind.Image ? "image" : "sound";
        var extension = FileSignature.ExtensionOf(kind, sample.Head)
            ?? throw new DomainException(kind == OwnAmbienceKind.Image ? DomainError.NotAnImage : DomainError.NotASound, $"The chosen file is not an accepted {what}.");
        if (sample.Length > (kind == OwnAmbienceKind.Image ? MaxImageBytes : MaxSoundBytes))
        {
            throw new DomainException(DomainError.FileTooLarge, $"The chosen {what} is {sample.Length} bytes, over the limit.");
        }

        var id = Guid.CreateVersion7();
        var fileName = $"{id:D}{extension}";
        folder.Copy(full, fileName);
        settings.AddOwn(new OwnAmbience(id, kind, NameOf(full), fileName));

        var own = Own();
        notifier.AmbienceChanged(own, origin);
        return own.Single(entry => entry.Id == id);
    }

    /// <summary>Deletes the copy; if the ambience used it, the ambience stops using it.</summary>
    public IReadOnlyList<OwnAmbienceView> Remove(Guid id, string origin)
    {
        var removed = settings.FindOwn(id) ?? throw new DomainException(DomainError.AmbienceNotFound, $"Own file {id} is not there.");
        var preferencesChanged = settings.KeepOwn(entry => entry.Id != id);
        folder.Delete(removed.FileName);

        if (preferencesChanged)
        {
            notifier.PreferencesChanged(settings.Preferences, origin);
        }

        var own = Own();
        notifier.AmbienceChanged(own, origin);
        return own;
    }

    /// <summary>
    /// On start: forgets the copies that are gone (someone cleaned the folder) and deletes the
    /// files nobody lists (an import cut short). Nothing is announced: no window is open yet.
    /// </summary>
    public void Tidy()
    {
        var files = folder.Files().ToHashSet(StringComparer.OrdinalIgnoreCase);
        settings.KeepOwn(own => files.Contains(own.FileName));

        var listed = settings.Own.Select(own => own.FileName).ToHashSet(StringComparer.OrdinalIgnoreCase);
        foreach (var orphan in files.Where(file => !listed.Contains(file)))
        {
            folder.Delete(orphan);
        }
    }

    private static string NameOf(string path)
    {
        var name = Path.GetFileName(path).Trim();
        return name.Length == 0 ? "Sin nombre" : name.Length > MaxNameLength ? name[..MaxNameLength] : name;
    }
}
