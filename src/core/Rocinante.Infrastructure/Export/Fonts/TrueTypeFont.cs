using System.Buffers.Binary;
using System.IO.Compression;
using System.Text;

namespace Rocinante.Infrastructure.Export.Fonts;

/// <summary>
/// A TrueType font, read from WOFF: what the book needs to set text with it and embed it in a PDF. Its glyphs
/// are not read: the font goes whole into the file.
/// </summary>
public sealed class TrueTypeFont
{
    private readonly Dictionary<int, ushort> _glyphs;
    private readonly ushort[] _advances;

    private TrueTypeFont(byte[] data, Tables tables)
    {
        Data = data;
        var head = tables["head"];
        UnitsPerEm = U16(head, 18);
        BoundingBox = (I16(head, 36), I16(head, 38), I16(head, 40), I16(head, 42));

        var hhea = tables["hhea"];
        Ascent = I16(hhea, 4);
        Descent = I16(hhea, 6);
        var metrics = U16(hhea, 34);
        var count = U16(tables["maxp"], 4);
        _advances = ReadAdvances(tables["hmtx"], metrics, count);

        if (tables.TryGetValue("OS/2", out var os2) && os2.Length >= 78)
        {
            Ascent = I16(os2, 68);
            Descent = I16(os2, 70);
            CapHeight = U16(os2, 0) >= 2 && os2.Length >= 90 ? I16(os2, 88) : Ascent;
        }
        else
        {
            CapHeight = Ascent;
        }

        ItalicAngle = tables.TryGetValue("post", out var post) ? BinaryPrimitives.ReadInt32BigEndian(post.AsSpan(4)) / 65536.0 : 0;
        PostScriptName = tables.TryGetValue("name", out var name) ? NameOf(name) ?? "Rocinante" : "Rocinante";
        _glyphs = ReadCharacterMap(tables["cmap"]);
    }

    /// <summary>The whole font as TrueType, to embed.</summary>
    public byte[] Data { get; }

    public int UnitsPerEm { get; }

    public int Ascent { get; }

    /// <summary>Below the baseline: negative.</summary>
    public int Descent { get; }

    public int CapHeight { get; }

    public double ItalicAngle { get; }

    public (int XMin, int YMin, int XMax, int YMax) BoundingBox { get; }

    public string PostScriptName { get; }

    public int GlyphCount => _advances.Length;

    /// <summary>Reads a WOFF file: each table, inflated if it was compressed, put back into a TrueType file.</summary>
    public static TrueTypeFont FromWoff(ReadOnlySpan<byte> woff)
    {
        if (woff.Length < 44 || BinaryPrimitives.ReadUInt32BigEndian(woff) != 0x774F4646)
        {
            throw new InvalidDataException("Not a WOFF file.");
        }

        var flavor = BinaryPrimitives.ReadUInt32BigEndian(woff[4..]);
        var count = BinaryPrimitives.ReadUInt16BigEndian(woff[12..]);
        var tables = new Tables();
        var order = new List<(string Tag, uint Checksum)>();
        for (var index = 0; index < count; index++)
        {
            var entry = woff.Slice(44 + (index * 20), 20);
            var tag = Encoding.ASCII.GetString(entry[..4]);
            var offset = (int)BinaryPrimitives.ReadUInt32BigEndian(entry[4..]);
            var compressed = (int)BinaryPrimitives.ReadUInt32BigEndian(entry[8..]);
            var original = (int)BinaryPrimitives.ReadUInt32BigEndian(entry[12..]);
            var checksum = BinaryPrimitives.ReadUInt32BigEndian(entry[16..]);
            var raw = woff.Slice(offset, compressed);
            tables[tag] = compressed < original ? Inflate(raw, original) : raw.ToArray();
            order.Add((tag, checksum));
        }

        return new TrueTypeFont(Sfnt(flavor, tables, order), tables);
    }

    /// <summary>The glyph of a character, or null if the font does not have it.</summary>
    public ushort? GlyphOf(int character) => _glyphs.TryGetValue(character, out var glyph) && glyph != 0 ? glyph : null;

    public bool Has(int character) => GlyphOf(character) is not null;

    /// <summary>The advance of a glyph in font units.</summary>
    public int AdvanceOf(ushort glyph) => glyph < _advances.Length ? _advances[glyph] : _advances[^1];

    /// <summary>The characters of the font and their glyphs, for the ToUnicode map of a PDF.</summary>
    public IReadOnlyDictionary<int, ushort> CharacterMap => _glyphs;

    private static byte[] Inflate(ReadOnlySpan<byte> compressed, int length)
    {
        using var input = new MemoryStream(compressed.ToArray());
        using var zlib = new ZLibStream(input, CompressionMode.Decompress);
        var output = new byte[length];
        zlib.ReadExactly(output);
        return output;
    }

    /// <summary>A TrueType file with the given tables, each on a four-byte boundary.</summary>
    private static byte[] Sfnt(uint flavor, Tables tables, List<(string Tag, uint Checksum)> order)
    {
        var sorted = order.OrderBy(entry => entry.Tag, StringComparer.Ordinal).ToList();
        var count = sorted.Count;
        var power = 1;
        var exponent = 0;
        while (power * 2 <= count)
        {
            power *= 2;
            exponent++;
        }

        var headerLength = 12 + (16 * count);
        var length = headerLength + sorted.Sum(entry => (tables[entry.Tag].Length + 3) & ~3);
        var output = new byte[length];
        var span = output.AsSpan();
        BinaryPrimitives.WriteUInt32BigEndian(span, flavor);
        BinaryPrimitives.WriteUInt16BigEndian(span[4..], (ushort)count);
        BinaryPrimitives.WriteUInt16BigEndian(span[6..], (ushort)(power * 16));
        BinaryPrimitives.WriteUInt16BigEndian(span[8..], (ushort)exponent);
        BinaryPrimitives.WriteUInt16BigEndian(span[10..], (ushort)((count * 16) - (power * 16)));

        var offset = headerLength;
        for (var index = 0; index < count; index++)
        {
            var (tag, checksum) = sorted[index];
            var data = tables[tag];
            var record = span.Slice(12 + (index * 16), 16);
            Encoding.ASCII.GetBytes(tag, record);
            BinaryPrimitives.WriteUInt32BigEndian(record[4..], checksum);
            BinaryPrimitives.WriteUInt32BigEndian(record[8..], (uint)offset);
            BinaryPrimitives.WriteUInt32BigEndian(record[12..], (uint)data.Length);
            data.CopyTo(span[offset..]);
            offset += (data.Length + 3) & ~3;
        }

        return output;
    }

    private static ushort[] ReadAdvances(byte[] hmtx, int metrics, int count)
    {
        var advances = new ushort[Math.Max(count, metrics)];
        for (var glyph = 0; glyph < advances.Length; glyph++)
        {
            advances[glyph] = glyph < metrics ? U16(hmtx, glyph * 4) : advances[metrics - 1];
        }

        return advances;
    }

    /// <summary>The Unicode map of the font: format 12 if it has one, else format 4.</summary>
    private static Dictionary<int, ushort> ReadCharacterMap(byte[] cmap)
    {
        var count = U16(cmap, 2);
        int? best = null;
        var bestRank = 0;
        for (var index = 0; index < count; index++)
        {
            var record = 4 + (index * 8);
            var platform = U16(cmap, record);
            var encoding = U16(cmap, record + 2);
            var offset = (int)BinaryPrimitives.ReadUInt32BigEndian(cmap.AsSpan(record + 4));
            var format = U16(cmap, offset);
            var rank = (platform, encoding, format) switch
            {
                (3, 10, 12) => 4,
                (0, _, 12) => 3,
                (3, 1, 4) => 2,
                (0, _, 4) => 1,
                _ => 0,
            };
            if (rank > bestRank)
            {
                best = offset;
                bestRank = rank;
            }
        }

        if (best is not { } table)
        {
            throw new InvalidDataException("The font has no Unicode character map.");
        }

        return U16(cmap, table) == 12 ? Format12(cmap, table) : Format4(cmap, table);
    }

    private static Dictionary<int, ushort> Format4(byte[] cmap, int table)
    {
        var map = new Dictionary<int, ushort>();
        var segments = U16(cmap, table + 6) / 2;
        var ends = table + 14;
        var starts = ends + (segments * 2) + 2;
        var deltas = starts + (segments * 2);
        var ranges = deltas + (segments * 2);
        for (var segment = 0; segment < segments; segment++)
        {
            int end = U16(cmap, ends + (segment * 2));
            int start = U16(cmap, starts + (segment * 2));
            var delta = I16(cmap, deltas + (segment * 2));
            int rangeOffset = U16(cmap, ranges + (segment * 2));
            for (var character = start; character <= end && character != 0xFFFF; character++)
            {
                int glyph;
                if (rangeOffset == 0)
                {
                    glyph = (character + delta) & 0xFFFF;
                }
                else
                {
                    var at = ranges + (segment * 2) + rangeOffset + ((character - start) * 2);
                    glyph = U16(cmap, at);
                    if (glyph != 0)
                    {
                        glyph = (glyph + delta) & 0xFFFF;
                    }
                }

                if (glyph != 0)
                {
                    map[character] = (ushort)glyph;
                }
            }
        }

        return map;
    }

    private static Dictionary<int, ushort> Format12(byte[] cmap, int table)
    {
        var map = new Dictionary<int, ushort>();
        var groups = (int)BinaryPrimitives.ReadUInt32BigEndian(cmap.AsSpan(table + 12));
        for (var group = 0; group < groups; group++)
        {
            var at = table + 16 + (group * 12);
            var start = (int)BinaryPrimitives.ReadUInt32BigEndian(cmap.AsSpan(at));
            var end = (int)BinaryPrimitives.ReadUInt32BigEndian(cmap.AsSpan(at + 4));
            var glyph = (int)BinaryPrimitives.ReadUInt32BigEndian(cmap.AsSpan(at + 8));
            for (var character = start; character <= end; character++)
            {
                map[character] = (ushort)(glyph + character - start);
            }
        }

        return map;
    }

    /// <summary>The PostScript name (name 6), in the Windows or the Mac record, without spaces.</summary>
    private static string? NameOf(byte[] name)
    {
        var count = U16(name, 2);
        var strings = U16(name, 4);
        for (var index = 0; index < count; index++)
        {
            var record = 6 + (index * 12);
            if (U16(name, record + 6) != 6)
            {
                continue;
            }

            var platform = U16(name, record);
            var length = U16(name, record + 8);
            var offset = strings + U16(name, record + 10);
            var text = platform == 3 || platform == 0
                ? Encoding.BigEndianUnicode.GetString(name, offset, length)
                : Encoding.Latin1.GetString(name, offset, length);
            var clean = new string([.. text.Where(character => character > ' ' && character < 127 && "[](){}<>/%".IndexOf(character) < 0)]);
            if (clean.Length > 0)
            {
                return clean;
            }
        }

        return null;
    }

    private static ushort U16(byte[] data, int offset) => BinaryPrimitives.ReadUInt16BigEndian(data.AsSpan(offset));

    private static short I16(byte[] data, int offset) => BinaryPrimitives.ReadInt16BigEndian(data.AsSpan(offset));

    private sealed class Tables : Dictionary<string, byte[]>
    {
        public Tables()
            : base(StringComparer.Ordinal)
        {
        }
    }
}
