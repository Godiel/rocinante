using Rocinante.Application.Settings;

namespace Rocinante.Application.Tests;

public sealed class FileSignatureTests
{
    public static TheoryData<OwnAmbienceKind, byte[], string> Accepted => new()
    {
        { OwnAmbienceKind.Image, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13], ".png" },
        { OwnAmbienceKind.Image, [0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1], ".jpg" },
        { OwnAmbienceKind.Image, [.. "RIFF"u8, 0x24, 0, 0, 0, .. "WEBP"u8], ".webp" },
        { OwnAmbienceKind.Sound, [.. "OggS"u8, 0, 2, 0, 0, 0, 0, 0, 0], ".ogg" },
        { OwnAmbienceKind.Sound, [.. "fLaC"u8, 0, 0, 0, 34, 0, 0, 0, 0], ".flac" },
        { OwnAmbienceKind.Sound, [.. "RIFF"u8, 0x24, 0, 0, 0, .. "WAVE"u8], ".wav" },
        { OwnAmbienceKind.Sound, [.. "ID3"u8, 4, 0, 0, 0, 0, 0, 0, 0, 0], ".mp3" },
        { OwnAmbienceKind.Sound, [0xFF, 0xFB, 0x90, 0x64, 0, 0, 0, 0, 0, 0, 0, 0], ".mp3" },
    };

    public static TheoryData<OwnAmbienceKind, byte[]> Refused => new()
    {
        // Text renamed to .png, a video, a WAVE where an image is asked, a WebP where a sound is.
        { OwnAmbienceKind.Image, [.. "Querido Sanch"u8] },
        { OwnAmbienceKind.Image, [0, 0, 0, 0x18, .. "ftypmp42"u8] },
        { OwnAmbienceKind.Image, [.. "RIFF"u8, 0x24, 0, 0, 0, .. "WAVE"u8] },
        { OwnAmbienceKind.Sound, [.. "RIFF"u8, 0x24, 0, 0, 0, .. "WEBP"u8] },
        { OwnAmbienceKind.Sound, [0xFF, 0xD8, 0xFF, 0xE0, 0, 16, 0x4A, 0x46, 0x49, 0x46, 0, 1] },
        // AAC in ADTS also starts with 0xFFF, but its layer bits are 00.
        { OwnAmbienceKind.Sound, [0xFF, 0xF1, 0x50, 0x80, 0, 0x1F, 0xFC, 0, 0, 0, 0, 0] },
        { OwnAmbienceKind.Sound, [] },
        { OwnAmbienceKind.Image, [.. "RIFF"u8] },
    };

    [Theory]
    [MemberData(nameof(Accepted))]
    public void A_file_is_known_by_its_first_bytes(OwnAmbienceKind kind, byte[] head, string extension)
    {
        FileSignature.ExtensionOf(kind, head).ShouldBe(extension);
    }

    [Theory]
    [MemberData(nameof(Refused))]
    public void A_file_of_another_kind_is_refused_whatever_its_name(OwnAmbienceKind kind, byte[] head)
    {
        FileSignature.ExtensionOf(kind, head).ShouldBeNull();
    }
}
