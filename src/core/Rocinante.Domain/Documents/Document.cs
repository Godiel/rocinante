using Rocinante.Domain.Content;
using Rocinante.Domain.Versions;

namespace Rocinante.Domain.Documents;

/// <summary>
/// The text of a chapter or fragment, with the rules that keep its history safe: automatic
/// versions while the writer works, manual ones on request, and restores that never lose the
/// current text.
/// </summary>
public sealed class Document
{
    private Document(DocumentId id, DocumentContent content, long revision, DateTimeOffset updatedAt, WritingSession session)
    {
        Id = id;
        Content = content;
        Revision = revision;
        UpdatedAt = updatedAt;
        Session = session;
    }

    public DocumentId Id { get; }

    public DocumentContent Content { get; private set; }

    /// <summary>Increases with every change to the text. 0 means it was never edited.</summary>
    public long Revision { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public WritingSession Session { get; private set; }

    /// <summary>An empty document for a newly created chapter or fragment.</summary>
    public static Document Create(DocumentId id, DateTimeOffset now) =>
        new(id, DocumentContent.Empty, revision: 0, now, WritingSession.None);

    /// <summary>Rebuilds a document from storage.</summary>
    public static Document Rehydrate(DocumentId id, DocumentContent content, long revision, DateTimeOffset updatedAt, WritingSession session) =>
        new(id, content, revision, updatedAt, session);

    /// <summary>
    /// Replaces the text. Saving the same text again changes nothing. When enough active writing
    /// has accumulated, the result carries an automatic version of the new text, to be stored.
    /// </summary>
    public SaveResult Save(DocumentContent content, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(content);

        if (content.Equals(Content))
        {
            return new SaveResult(Changed: false, Revision, AutomaticVersion: null);
        }

        Replace(content, now);
        Session = Session.WithEdit(now);

        if (!Session.IsDueForVersion)
        {
            return new SaveResult(Changed: true, Revision, AutomaticVersion: null);
        }

        Session = Session.AfterVersion();
        return new SaveResult(Changed: true, Revision, Capture(VersionKind.Automatic, name: null, now));
    }

    /// <summary>Saves a version of the current text because the writer asked for it.</summary>
    public DocumentVersion SaveVersion(string? name, DateTimeOffset now)
    {
        var version = Capture(VersionKind.Manual, name, now);
        Session = Session.AfterVersion();
        return version;
    }

    /// <summary>
    /// Brings back the text of <paramref name="version"/>. The current text is captured first and
    /// returned, so the restore itself can be undone. Returns <see langword="null"/> when the text
    /// already matches and nothing had to change.
    /// </summary>
    public DocumentVersion? Restore(DocumentVersion version, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(version);

        if (version.DocumentId != Id)
        {
            throw new DomainException(
                DomainError.VersionOfAnotherDocument,
                $"Version {version.Id} belongs to document {version.DocumentId}, not {Id}.");
        }

        if (version.Content.Equals(Content))
        {
            return null;
        }

        var current = Capture(VersionKind.BeforeRestore, name: null, now);
        Replace(version.Content, now);
        Session = Session.AfterVersion() with { LastEditAt = now };
        return current;
    }

    private void Replace(DocumentContent content, DateTimeOffset now)
    {
        Content = content;
        Revision++;
        UpdatedAt = now;
    }

    private DocumentVersion Capture(VersionKind kind, string? name, DateTimeOffset now) =>
        DocumentVersion.Capture(Id, kind, name, now, Content);
}

/// <summary>Outcome of <see cref="Document.Save"/>.</summary>
/// <param name="Changed">Whether the text was different from the stored one.</param>
/// <param name="Revision">The document's revision after saving.</param>
/// <param name="AutomaticVersion">A version that became due with this save, to be stored with it.</param>
public sealed record SaveResult(bool Changed, long Revision, DocumentVersion? AutomaticVersion);
