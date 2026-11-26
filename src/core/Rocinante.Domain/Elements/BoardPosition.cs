namespace Rocinante.Domain.Elements;

/// <summary>Where a card sits on the board, in board units. The board is large but not endless.</summary>
public readonly record struct BoardPosition
{
    public const double Limit = 1_000_000;

    public BoardPosition(double x, double y)
    {
        X = Checked(x, nameof(x));
        Y = Checked(y, nameof(y));
    }

    public double X { get; }

    public double Y { get; }

    public static BoardPosition Origin => new(0, 0);

    private static double Checked(double value, string name) =>
        double.IsFinite(value) && Math.Abs(value) <= Limit
            ? value
            : throw new DomainException(DomainError.PositionOutOfRange, $"A board {name} goes from -{Limit} to {Limit}.");
}
