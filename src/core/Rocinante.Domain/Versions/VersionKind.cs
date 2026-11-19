namespace Rocinante.Domain.Versions;

/// <summary>Why a version was saved.</summary>
public enum VersionKind
{
    /// <summary>Saved on its own after a stretch of active writing.</summary>
    Automatic,

    /// <summary>Saved by the writer, optionally with a name.</summary>
    Manual,

    /// <summary>The text as it was just before restoring an older version, so nothing is lost.</summary>
    BeforeRestore,
}
