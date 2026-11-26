using System.Text.RegularExpressions;

namespace Rocinante.Domain.Elements;

/// <summary>
/// Names a kind of relationship: <c>builtin:&lt;name&gt;</c> for a common one, whose words live in the UI so they
/// can be translated, or <c>own:&lt;id&gt;</c> for one the writer wrote in this work.
/// </summary>
public readonly partial record struct RelationshipKindId
{
    private RelationshipKindId(string value) => Value = value;

    public string Value { get; }

    /// <summary>The writer's own kind this names, or null for a common one.</summary>
    public Guid? Own => Value.StartsWith("own:", StringComparison.Ordinal) ? Guid.Parse(Value.AsSpan(4)) : null;

    public static RelationshipKindId Builtin(string name) => Parse($"builtin:{name}");

    public static RelationshipKindId OwnKind(Guid id) => new($"own:{id:D}");

    public static RelationshipKindId Parse(string value) =>
        TryParse(value, out var id) ? id : throw new FormatException($"'{value}' is not a relationship kind.");

    public static bool TryParse(string? value, out RelationshipKindId id)
    {
        if (value is not null && Shape().IsMatch(value))
        {
            id = new RelationshipKindId(value);
            return true;
        }

        id = default;
        return false;
    }

    public override string ToString() => Value;

    [GeneratedRegex("^(builtin:[a-z0-9-]{1,40}|own:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$")]
    private static partial Regex Shape();
}
