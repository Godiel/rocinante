using System.Text.Json;
using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;
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

    public void NotesChanged(DocumentId documentId, IReadOnlyList<Note> notes, string origin) =>
        Send(
            "notes.changed",
            new NotesChangedNotification(documentId.Value, [.. notes.Select(Wire.Of)], origin),
            WireJson.Default.NotesChangedNotification);

    private void Send<T>(string method, T payload, System.Text.Json.Serialization.Metadata.JsonTypeInfo<T> type) =>
        writer.Notification(method, JsonSerializer.SerializeToNode(payload, type));
}
