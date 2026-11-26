namespace Rocinante.Domain.Elements;

/// <summary>What an element of the work is.</summary>
public enum ElementKind
{
    Character,
    Place,
    Plot,

    /// <summary>Anything else: an object, a faction, an era. The writer names the kind in <see cref="Element.OtherKind"/>.</summary>
    Other,
}
