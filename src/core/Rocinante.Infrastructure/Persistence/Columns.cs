using Microsoft.Data.Sqlite;
using Rocinante.Domain.Formats;
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

    public static string Size(PageSize size) => size switch
    {
        PageSize.Pocket => "pocket",
        PageSize.A5 => "a5",
        PageSize.Digest => "digest",
        PageSize.Trade => "trade",
        PageSize.A4 => "a4",
        PageSize.Letter => "letter",
        PageSize.Custom => "custom",
        _ => throw new ArgumentOutOfRangeException(nameof(size), size, "Unknown page size."),
    };

    public static string Face(Typeface typeface) => typeface switch
    {
        Typeface.EbGaramond => "eb_garamond",
        Typeface.Literata => "literata",
        Typeface.CrimsonPro => "crimson_pro",
        Typeface.SourceSerif4 => "source_serif_4",
        Typeface.LibreBaskerville => "libre_baskerville",
        Typeface.CourierPrime => "courier_prime",
        _ => throw new ArgumentOutOfRangeException(nameof(typeface), typeface, "Unknown typeface."),
    };

    public static long Flag(bool value) => value ? 1 : 0;

    public static PageSize GetPageSize(this SqliteDataReader reader, int ordinal) => reader.GetString(ordinal) switch
    {
        "pocket" => PageSize.Pocket,
        "a5" => PageSize.A5,
        "digest" => PageSize.Digest,
        "trade" => PageSize.Trade,
        "a4" => PageSize.A4,
        "letter" => PageSize.Letter,
        "custom" => PageSize.Custom,
        var other => throw new InvalidDataException($"Unknown page size '{other}'."),
    };

    public static Typeface GetTypeface(this SqliteDataReader reader, int ordinal) => reader.GetString(ordinal) switch
    {
        "eb_garamond" => Typeface.EbGaramond,
        "literata" => Typeface.Literata,
        "crimson_pro" => Typeface.CrimsonPro,
        "source_serif_4" => Typeface.SourceSerif4,
        "libre_baskerville" => Typeface.LibreBaskerville,
        "courier_prime" => Typeface.CourierPrime,
        var other => throw new InvalidDataException($"Unknown typeface '{other}'."),
    };

    public static bool GetFlag(this SqliteDataReader reader, int ordinal) => reader.GetInt64(ordinal) != 0;

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
