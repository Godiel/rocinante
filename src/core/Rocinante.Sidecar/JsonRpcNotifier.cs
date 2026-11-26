using System.Text.Json;
using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Application.Squire;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Squire;
using Rocinante.Sidecar.Protocol;

namespace Rocinante.Sidecar;

/// <summary>Announces changes as JSON-RPC notifications; the host relays them to every window.</summary>
internal sealed class JsonRpcNotifier(MessageWriter writer) : IChangeNotifier
{
    public void ProjectOpened(ProjectSnapshot project, string origin) =>
        Send("project.opened", new ProjectNotification(Wire.Of(project), origin), WireJson.Default.ProjectNotification);

    public void ProjectChanged(ProjectSnapshot project, string origin) =>
        Send("project.changed", new ProjectNotification(Wire.Of(project), origin), WireJson.Default.ProjectNotification);

    public void ProjectClosed(string origin) =>
        Send("project.closed", new ProjectClosedNotification(origin), WireJson.Default.ProjectClosedNotification);

    public void DocumentChanged(Document document, TextStatistics work, string origin) =>
        Send(
            "document.changed",
            new DocumentChangedNotification(Wire.Of(document), Wire.Of(work), origin),
            WireJson.Default.DocumentChangedNotification);

    public void VersionsChanged(DocumentId documentId, string origin) =>
        Send("versions.changed", new VersionsChangedNotification(documentId.Value, origin), WireJson.Default.VersionsChangedNotification);

    public void NotesChanged(IReadOnlyList<Note> notes, IReadOnlyList<NoteId> removed, string origin) =>
        Send(
            "notes.changed",
            new NotesChangedNotification([.. notes.Select(Wire.Of)], [.. removed.Select(id => id.Value)], origin),
            WireJson.Default.NotesChangedNotification);

    public void SquireChanged(SquireState state, IReadOnlyList<Proposal> proposals, IReadOnlyList<ProposalId> removed, string origin) =>
        Send(
            "squire.changed",
            new SquireChangedNotification(Wire.Of(state), [.. proposals.Select(Wire.Of)], [.. removed.Select(id => id.Value)], origin),
            WireJson.Default.SquireChangedNotification);

    public void DictionaryChanged(IReadOnlyList<string> words, string origin) =>
        Send("dictionary.changed", new DictionaryChangedNotification(words, origin), WireJson.Default.DictionaryChangedNotification);

    public void SuggestionsChanged(string origin) =>
        Send("suggestions.changed", new SuggestionsChangedNotification(origin), WireJson.Default.SuggestionsChangedNotification);

    public void PreferencesChanged(Preferences preferences, string origin) =>
        Send("preferences.changed", new PreferencesChangedNotification(Wire.Of(preferences), origin), WireJson.Default.PreferencesChangedNotification);

    public void RecentChanged(IReadOnlyList<RecentProjectView> recent, string origin) =>
        Send("recent.changed", new RecentChangedNotification(Wire.Of(recent), origin), WireJson.Default.RecentChangedNotification);

    public void ElementsChanged(ElementsChange change, string origin) =>
        Send("elements.changed", Wire.Of(change, origin), WireJson.Default.ElementsChangedNotification);

    public void AmbienceChanged(IReadOnlyList<OwnAmbienceView> own, string origin) =>
        Send("ambience.changed", new AmbienceChangedNotification(Wire.Of(own), origin), WireJson.Default.AmbienceChangedNotification);

    private void Send<T>(string method, T payload, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> type) =>
        writer.Notification(method, JsonSerializer.SerializeToNode(payload, type));
}
