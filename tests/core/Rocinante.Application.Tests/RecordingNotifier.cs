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

    public IReadOnlyList<NoteId>? LastRemovedNotes { get; private set; }

    public void ProjectOpened(ProjectSnapshot project, string origin) => Events.Add($"project.opened:{origin}");

    public void ProjectChanged(ProjectSnapshot project, string origin) => Events.Add($"project.changed:{origin}");

    public void ProjectClosed(string origin) => Events.Add($"project.closed:{origin}");

    public void DocumentChanged(Document document, TextStatistics work, string origin) => Events.Add($"document.changed:{origin}");

    public void VersionsChanged(DocumentId documentId, string origin) => Events.Add($"versions.changed:{origin}");

    public void NotesChanged(IReadOnlyList<Note> notes, IReadOnlyList<NoteId> removed, string origin)
    {
        LastNotes = notes;
        LastRemovedNotes = removed;
        Events.Add($"notes.changed:{origin}");
    }

    public void DictionaryChanged(IReadOnlyList<string> words, string origin) => Events.Add($"dictionary.changed:{origin}");

    public void SuggestionsChanged(string origin) => Events.Add($"suggestions.changed:{origin}");

    public void PreferencesChanged(Preferences preferences, string origin) => Events.Add($"preferences.changed:{origin}");

    public void RecentChanged(IReadOnlyList<RecentProjectView> recent, string origin) => Events.Add($"recent.changed:{origin}");

    public IReadOnlyList<OwnAmbienceView>? LastOwn { get; private set; }

    public void AmbienceChanged(IReadOnlyList<OwnAmbienceView> own, string origin)
    {
        LastOwn = own;
        Events.Add($"ambience.changed:{origin}");
    }

    public ElementsChange? LastElements { get; private set; }

    public void ElementsChanged(ElementsChange change, string origin)
    {
        LastElements = change;
        Events.Add($"elements.changed:{origin}");
    }

    public void Clear() => Events.Clear();
}
