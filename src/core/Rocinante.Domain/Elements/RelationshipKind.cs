namespace Rocinante.Domain.Elements;

/// <summary>
/// A kind of relationship the writer wrote in this work: how it reads forward («escudero de») and from the other
/// side («señor de»). Without an inverse it is symmetric and reads the same from both sides («rival de»).
/// </summary>
public sealed record RelationshipKind
{
    public const int MaxLabelLength = 60;

    private RelationshipKind(Guid id, string forward, string? inverse)
    {
        Id = id;
        Forward = forward;
        Inverse = inverse;
    }

    public Guid Id { get; }

    public RelationshipKindId KindId => RelationshipKindId.OwnKind(Id);

    public string Forward { get; }

    public string? Inverse { get; }

    public bool IsSymmetric => Inverse is null;

    internal static RelationshipKind Create(string forward, string? inverse, DateTimeOffset now)
    {
        var trimmedInverse = inverse?.Trim();
        return new RelationshipKind(
            Guid.CreateVersion7(now),
            Label(forward),
            string.IsNullOrEmpty(trimmedInverse) ? null : Label(trimmedInverse));
    }

    public static RelationshipKind Rehydrate(Guid id, string forward, string? inverse) => new(id, forward, inverse);

    /// <summary>Whether it reads like the given words, ignoring case and surrounding spaces.</summary>
    internal bool ReadsAs(string forward, string? inverse) =>
        Same(Forward, forward) && (Inverse is null ? string.IsNullOrWhiteSpace(inverse) : inverse is not null && Same(Inverse, inverse));

    private static bool Same(string a, string b) => string.Equals(a, b.Trim(), StringComparison.OrdinalIgnoreCase);

    private static string Label(string label) => Names.Required(label, MaxLabelLength, "A relationship");
}
