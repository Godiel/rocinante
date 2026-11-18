using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;
using Rocinante.Application;
using Rocinante.Domain;
using Rocinante.Sidecar.Protocol;

namespace Rocinante.Sidecar;

/// <summary>The use cases behind each method of the contract.</summary>
internal sealed record CoreServices(ProjectUseCases Projects, DocumentUseCases Documents, VersionUseCases Versions, NoteUseCases Notes, SettingsUseCases Settings);

/// <summary>
/// Binds every method of the contract to a use case: params come in already validated against the
/// contract, are read into their wire record, and the result goes back as its wire shape.
/// </summary>
internal static class CoreMethods
{
    public static IReadOnlyDictionary<string, Func<JsonNode?, JsonNode?>> Create(ProtocolContract contract, CoreServices core)
    {
        var table = new Table();
        var json = WireJson.Default;

        table.On("system.info", json.SystemInfoResult, () => new SystemInfoResult(contract.ProtocolVersion, CoreVersion()));
        table.On("system.ping", () => JsonValue.Create("pong"));

        table.On("app.start", json.OriginParams, json.StartStateDto, p => Wire.Of(core.Settings.Start(p.Origin)));
        table.On("preferences.update", json.UpdatePreferencesParams, json.PreferencesDto, p =>
            Wire.Of(core.Settings.UpdatePreferences(Wire.ToChange(p.Changes), p.Origin)));
        table.On("recent.list", json.IReadOnlyListRecentProjectDto, () => Wire.Of(core.Settings.Recent()));
        table.On("recent.remove", json.PathParams, json.IReadOnlyListRecentProjectDto, p => Wire.Of(core.Settings.RemoveRecent(p.Path, p.Origin)));
        table.On("place.get", () => core.Settings.CurrentPlace() is { } place ? JsonSerializer.SerializeToNode(Wire.Of(place), json.PlaceDto) : null);
        table.On("place.save", json.PlaceDto, p => core.Settings.SavePlace(Wire.ToPlace(p)));

        table.On("project.create", json.CreateProjectParams, json.ProjectStateDto, p => Wire.Of(core.Projects.Create(p.Path, p.Title, p.Origin)));
        table.On("project.open", json.PathParams, json.ProjectStateDto, p => Wire.Of(core.Projects.Open(p.Path, p.Origin)));
        table.On("project.get", json.ProjectStateDto, () => Wire.Of(core.Projects.Current()));
        table.On("project.rename", json.TitleParams, json.ProjectStateDto, p => Wire.Of(core.Projects.Rename(p.Title, p.Origin)));
        table.On("project.saveAs", json.PathParams, json.ProjectStateDto, p => Wire.Of(core.Projects.SaveAs(p.Path, p.Origin)));
        table.On("project.close", json.OriginParams, p => core.Projects.Close(p.Origin));

        table.On("document.create", json.CreateDocumentParams, json.DocumentEntryDto, p =>
            Wire.Of(core.Documents.Create(Wire.ParseKind(p.Kind), p.Title, p.Position, p.Origin)));
        table.On("document.rename", json.RenameDocumentParams, json.DocumentEntryDto, p =>
            Wire.Of(core.Documents.Rename(new DocumentId(p.Id), p.Title, p.Origin)));
        table.On("document.move", json.MoveDocumentParams, json.ProjectIndexDto, p =>
            Wire.IndexOf(core.Documents.Move(new DocumentId(p.Id), Wire.ParseKind(p.Kind), p.Position, p.Origin)));
        table.On("document.delete", json.IdOriginParams, json.ProjectIndexDto, p =>
            Wire.IndexOf(core.Documents.Delete(new DocumentId(p.Id), p.Origin)));
        table.On("document.restore", json.IdOriginParams, json.ProjectIndexDto, p =>
            Wire.IndexOf(core.Documents.Restore(new DocumentId(p.Id), p.Origin)));
        table.On("document.get", json.IdParams, json.DocumentStateDto, p => Wire.Of(core.Documents.Get(new DocumentId(p.Id))));
        table.On("document.save", json.SaveDocumentParams, json.DocumentSavedResult, p =>
        {
            var saved = core.Documents.Save(new DocumentId(p.Id), p.Content.ToJsonString(), p.Origin);
            return new DocumentSavedResult(
                saved.Changed,
                saved.Document.Revision,
                Wire.Of(saved.Document.Content.Statistics),
                Wire.Of(saved.Work),
                saved.AutomaticVersion is { } version ? Wire.Of(version) : null);
        });

        table.On("version.create", json.CreateVersionParams, json.VersionSummaryDto, p =>
            Wire.Of(core.Versions.Create(new DocumentId(p.DocumentId), p.Name, p.Origin)));
        table.On("version.list", json.DocumentReferenceParams, json.IReadOnlyListVersionSummaryDto, p =>
            [.. core.Versions.List(new DocumentId(p.DocumentId)).Select(Wire.Of)]);
        table.On("version.get", json.IdParams, json.VersionDetailResult, p =>
        {
            var version = core.Versions.Get(new VersionId(p.Id));
            return new VersionDetailResult(Wire.Of(Application.Ports.VersionSummary.Of(version)), Wire.Content(version.Content));
        });
        table.On("version.restore", json.IdOriginParams, json.VersionRestoredResult, p =>
        {
            var restored = core.Versions.Restore(new VersionId(p.Id), p.Origin);
            return new VersionRestoredResult(Wire.Of(restored.Document), restored.Before is { } before ? Wire.Of(before) : null);
        });

        table.On("note.create", json.CreateNoteParams, json.NoteDto, p =>
            Wire.Of(core.Notes.Create(new DocumentId(p.DocumentId), p.Text, p.Anchored, p.Origin)));
        table.On("note.update", json.UpdateNoteParams, json.NoteDto, p => Wire.Of(core.Notes.Update(new NoteId(p.Id), p.Text, p.Origin)));
        table.On("note.delete", json.IdOriginParams, p => core.Notes.Delete(new NoteId(p.Id), p.Origin));
        table.On("note.list", json.DocumentReferenceParams, json.IReadOnlyListNoteDto, p =>
            [.. core.Notes.List(new DocumentId(p.DocumentId)).Select(Wire.Of)]);

        return table.Handlers;
    }

    private static string CoreVersion() =>
        typeof(CoreMethods).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";

    private sealed class Table
    {
        public Dictionary<string, Func<JsonNode?, JsonNode?>> Handlers { get; } = [];

        public void On(string method, Func<JsonNode?> handler) => Handlers.Add(method, _ => handler());

        public void On<TResult>(string method, JsonTypeInfo<TResult> result, Func<TResult> handler) =>
            Handlers.Add(method, _ => JsonSerializer.SerializeToNode(handler(), result));

        public void On<TParams, TResult>(string method, JsonTypeInfo<TParams> parameters, JsonTypeInfo<TResult> result, Func<TParams, TResult> handler) =>
            Handlers.Add(method, node => JsonSerializer.SerializeToNode(handler(Read(node, parameters)), result));

        /// <summary>A method whose result is <c>null</c>.</summary>
        public void On<TParams>(string method, JsonTypeInfo<TParams> parameters, Action<TParams> handler) =>
            Handlers.Add(method, node =>
            {
                handler(Read(node, parameters));
                return null;
            });

        private static T Read<T>(JsonNode? node, JsonTypeInfo<T> type) =>
            node.Deserialize(type) ?? throw new JsonException($"Missing params for {typeof(T).Name}.");
    }
}
