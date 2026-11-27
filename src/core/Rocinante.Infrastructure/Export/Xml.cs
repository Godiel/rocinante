using System.Text;

namespace Rocinante.Infrastructure.Export;

/// <summary>Text and attribute values made safe for XML, leaving out the characters XML does not allow.</summary>
internal static class Xml
{
    public static string Escape(string text)
    {
        ArgumentNullException.ThrowIfNull(text);
        var escaped = new StringBuilder(text.Length);
        foreach (var character in text)
        {
            switch (character)
            {
                case '&':
                    escaped.Append("&amp;");
                    break;
                case '<':
                    escaped.Append("&lt;");
                    break;
                case '>':
                    escaped.Append("&gt;");
                    break;
                case '"':
                    escaped.Append("&quot;");
                    break;
                case '\'':
                    escaped.Append("&apos;");
                    break;
                case '\t' or '\n' or '\r':
                    escaped.Append(character);
                    break;
                case < ' ' or '￾' or '￿':
                    break;
                default:
                    escaped.Append(character);
                    break;
            }
        }

        return escaped.ToString();
    }
}
