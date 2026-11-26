namespace Rocinante.Application.Settings;

/// <summary>
/// Tells what a file is by its first bytes, not by its extension, which can lie. The interface
/// decodes the rest: a file that starts right but does not decode is reported there.
/// </summary>
public static class FileSignature
{
    /// <summary>How many bytes are enough to recognise every accepted kind.</summary>
    public const int HeadLength = 12;

    private static readonly byte[] _png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly byte[] _jpeg = [0xFF, 0xD8, 0xFF];

    /// <summary>The extension the copy gets (<c>.png</c>, <c>.ogg</c>…), or null if the file is not of that kind.</summary>
    public static string? ExtensionOf(OwnAmbienceKind kind, ReadOnlySpan<byte> head) =>
        kind == OwnAmbienceKind.Image ? ImageExtension(head) : SoundExtension(head);

    /// <summary>The media type of an image (<c>image/png</c>, <c>image/jpeg</c> or <c>image/webp</c>), or null if it is none of them.</summary>
    public static string? ImageMediaType(ReadOnlySpan<byte> head) => ImageExtension(head) switch
    {
        ".png" => "image/png",
        ".jpg" => "image/jpeg",
        ".webp" => "image/webp",
        _ => null,
    };

    private static string? ImageExtension(ReadOnlySpan<byte> head) =>
        head.StartsWith(_png) ? ".png"
        : head.StartsWith(_jpeg) ? ".jpg"
        : IsRiff(head, "WEBP"u8) ? ".webp"
        : null;

    private static string? SoundExtension(ReadOnlySpan<byte> head) =>
        head.StartsWith("OggS"u8) ? ".ogg"
        : head.StartsWith("fLaC"u8) ? ".flac"
        : IsRiff(head, "WAVE"u8) ? ".wav"
        : head.StartsWith("ID3"u8) || IsMpegAudioFrame(head) ? ".mp3"
        : null;

    private static bool IsRiff(ReadOnlySpan<byte> head, ReadOnlySpan<byte> form) =>
        head.Length >= 12 && head.StartsWith("RIFF"u8) && head[8..12].SequenceEqual(form);

    // An MPEG audio frame starts with 11 set bits; layer 00 is reserved (and is what AAC uses).
    private static bool IsMpegAudioFrame(ReadOnlySpan<byte> head) =>
        head.Length >= 2 && head[0] == 0xFF && (head[1] & 0xE0) == 0xE0 && (head[1] & 0x06) != 0;
}
