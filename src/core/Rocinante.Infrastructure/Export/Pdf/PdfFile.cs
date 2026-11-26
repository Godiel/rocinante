using System.Globalization;
using System.IO.Compression;
using System.Text;

namespace Rocinante.Infrastructure.Export.Pdf;

/// <summary>
/// The objects of a PDF file, written one after another as they are ready, with the table that finds them.
/// Numbers are reserved before the object is written, so a page can name a font written at the end.
/// </summary>
internal sealed class PdfFile(Stream output)
{
    private readonly Dictionary<int, long> _offsets = [];
    private long _position;
    private int _next = 1;

    public void Start() => Raw("%PDF-1.7\n%âãÏÓ\n");

    public int Reserve() => _next++;

    public void Object(int id, string body)
    {
        _offsets[id] = _position;
        Raw(string.Create(CultureInfo.InvariantCulture, $"{id} 0 obj\n{body}\nendobj\n"));
    }

    /// <summary>A stream, compressed with Flate. <paramref name="dictionary"/> goes inside the stream's dictionary.</summary>
    public void Stream(int id, string dictionary, ReadOnlySpan<byte> data)
    {
        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.Optimal, leaveOpen: true))
        {
            zlib.Write(data);
        }

        _offsets[id] = _position;
        Raw(string.Create(CultureInfo.InvariantCulture, $"{id} 0 obj\n<< {dictionary} /Filter /FlateDecode /Length {compressed.Length} >>\nstream\n"));
        Bytes(compressed.GetBuffer().AsSpan(0, (int)compressed.Length));
        Raw("\nendstream\nendobj\n");
    }

    public void Finish(int catalog, int info)
    {
        var table = _position;
        var text = new StringBuilder();
        text.Append(CultureInfo.InvariantCulture, $"xref\n0 {_next}\n0000000000 65535 f \n");
        for (var id = 1; id < _next; id++)
        {
            text.Append(_offsets.TryGetValue(id, out var offset)
                ? string.Create(CultureInfo.InvariantCulture, $"{offset:D10} 00000 n \n")
                : "0000000000 65535 f \n");
        }

        text.Append(CultureInfo.InvariantCulture, $"trailer\n<< /Size {_next} /Root {catalog} 0 R /Info {info} 0 R >>\nstartxref\n{table}\n%%EOF\n");
        Raw(text.ToString());
    }

    /// <summary>A text string: in UTF-16 with its mark, so any letter goes in the data of the file.</summary>
    public static string Text(string text)
    {
        var bytes = Encoding.BigEndianUnicode.GetBytes(text);
        var hex = new StringBuilder("<FEFF", (bytes.Length * 2) + 6);
        foreach (var value in bytes)
        {
            hex.Append(value.ToString("X2", CultureInfo.InvariantCulture));
        }

        return hex.Append('>').ToString();
    }

    public static string Number(double value) =>
        Math.Round(value, 3).ToString("0.###", CultureInfo.InvariantCulture);

    private void Raw(string text) => Bytes(Encoding.Latin1.GetBytes(text));

    private void Bytes(ReadOnlySpan<byte> data)
    {
        output.Write(data);
        _position += data.Length;
    }
}
