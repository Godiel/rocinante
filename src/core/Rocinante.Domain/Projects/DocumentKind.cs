namespace Rocinante.Domain.Projects;

/// <summary>Where a document lives in the work.</summary>
public enum DocumentKind
{
    /// <summary>Part of the work, in reading order.</summary>
    Chapter,

    /// <summary>Loose text in the drawer, with no fixed place in the work yet.</summary>
    Fragment,
}
