using System.Diagnostics.CodeAnalysis;

namespace Rocinante.Domain.Elements;

/// <summary>A name–value pair of an element: «Edad: cincuenta años». The value may be empty, as suggested ones start.</summary>
[SuppressMessage("Naming", "CA1711", Justification = "«Atributo» is Attribute in the glossary; this is not a .NET attribute.")]
public sealed record ElementAttribute
{
    public const int MaxNameLength = 100;
    public const int MaxValueLength = 5_000;

    public ElementAttribute(string name, string value)
    {
        Name = Names.Required(name, MaxNameLength, "An attribute");
        Value = Names.Bounded(value ?? string.Empty, MaxValueLength, "An attribute value");
    }

    public string Name { get; }

    public string Value { get; }
}
