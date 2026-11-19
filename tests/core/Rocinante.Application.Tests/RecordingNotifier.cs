using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;

namespace Rocinante.Application.Tests;

/// <summary>Keeps every announcement, so tests can check what the windows would hear.</summary>
internal sealed class RecordingNotifier : IChangeNotifier
{
    public List<string> Events { get; } = [];

    public IReadOnlyList<Note>? LastNotes { get; private set; }

    public void ProjectOpened(ProjectSnapshot project, string origin) => Events.Add($"project.opened:{origin}");

    public void ProjectChanged(ProjectSnapshot project, string origin) => Events.Add($"project.changed:{origin}");

    public void ProjectClosed(string origin) => Events.Add($"project.closed:{origin}");

    public void DocumentChanged(Document document, TextStatistics work, string origin) => Events.Add($"document.changed:{origin}");

    public void VersionsChanged(DocumentId documentId, string origin) => Events.Add($"versions.changed:{origin}");

    public void NotesChanged(DocumentId documentId, IReadOnlyList<Note> notes, string origin)
    {
        LastNotes = notes;
        Events.Add($"notes.changed:{origin}");
    }

    public void PreferencesChanged(Preferences preferences, string origin) => Events.Add($"preferences.changed:{origin}");

    public void RecentChanged(IReadOnlyList<RecentProjectView> recent, string origin) => Events.Add($"recent.changed:{origin}");

    public void Clear() => Events.Clear();
}
