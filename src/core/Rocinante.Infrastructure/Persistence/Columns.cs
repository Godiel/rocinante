using Microsoft.Data.Sqlite;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Versions;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>How domain values are written to and read from SQLite columns.</summary>
internal static class Columns
{
    public static long Time(DateTimeOffset value) => value.ToUnixTimeMilliseconds();

    public static long? Time(DateTimeOffset? value) => value?.ToUnixTimeMilliseconds();

    public static string Id(Guid value) => value.ToString("D");

    public static string Kind(DocumentKind kind) => kind switch
    {
        DocumentKind.Chapter => "chapter",
        DocumentKind.Fragment => "fragment",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown document kind."),
    };

    public static string Kind(VersionKind kind) => kind switch
    {
        VersionKind.Automatic => "automatic",
        VersionKind.Manual => "manual",
        VersionKind.BeforeRestore => "before_restore",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown version kind."),
    };

    public static DateTimeOffset GetTime(this SqliteDataReader reader, int ordinal) =>
        DateTimeOffset.FromUnixTimeMilliseconds(reader.GetInt64(ordinal));

    public static DateTimeOffset? GetNullableTime(this SqliteDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? null : reader.GetTime(ordinal);

    public static string? GetNullableString(this SqliteDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);

    public static Guid GetId(this SqliteDataReader reader, int ordinal) => Guid.Parse(reader.GetString(ordinal));

    public static DocumentKind GetDocumentKind(this SqliteDataReader reader, int ordinal) => reader.GetString(ordinal) switch
    {
        "chapter" => DocumentKind.Chapter,
        "fragment" => DocumentKind.Fragment,
        var other => throw new InvalidDataException($"Unknown document kind '{other}'."),
    };

    public static VersionKind GetVersionKind(this SqliteDataReader reader, int ordinal) => reader.GetString(ordinal) switch
    {
        "automatic" => VersionKind.Automatic,
        "manual" => VersionKind.Manual,
        "before_restore" => VersionKind.BeforeRestore,
        var other => throw new InvalidDataException($"Unknown version kind '{other}'."),
    };
}
