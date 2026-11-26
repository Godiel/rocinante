using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization.Metadata;
using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Sidecar.Protocol;

namespace Rocinante.Sidecar;

/// <summary>The use cases behind each method of the contract.</summary>
internal sealed record CoreServices(
    ProjectUseCases Projects,
    DocumentUseCases Documents,
    VersionUseCases Versions,
    NoteUseCases Notes,
    SettingsUseCases Settings,
    AmbienceUseCases Ambience,
    ElementUseCases Elements,
    IReportedProblems Problems);

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
        table.On("diagnostics.report", json.ReportParams, p => core.Problems.Report(p.Source, p.Level, p.Message, p.Detail));

        table.On("app.start", json.OriginParams, json.StartStateDto, p => Wire.Of(core.Settings.Start(p.Origin)));
        table.On("preferences.update", json.UpdatePreferencesParams, json.PreferencesDto, p =>
            Wire.Of(core.Settings.UpdatePreferences(Wire.ToChange(p.Changes), p.Origin)));
        table.On("recent.list", json.IReadOnlyListRecentProjectDto, () => Wire.Of(core.Settings.Recent()));
        table.On("recent.remove", json.PathParams, json.IReadOnlyListRecentProjectDto, p => Wire.Of(core.Settings.RemoveRecent(p.Path, p.Origin)));
        table.On("ambience.import", json.ImportAmbienceParams, json.OwnAmbienceDto, p =>
            Wire.Of(core.Ambience.Import(p.Path, Wire.ParseOwnKind(p.Kind), p.Origin)));
        table.On("ambience.remove", json.IdOriginParams, json.IReadOnlyListOwnAmbienceDto, p => Wire.Of(core.Ambience.Remove(p.Id, p.Origin)));
        table.On("place.get", () => core.Settings.CurrentPlace() is { } place ? JsonSerializer.SerializeToNode(Wire.Of(place), json.PlaceDto) : null);
        table.On("place.save", json.PlaceDto, p => core.Settings.SavePlace(Wire.ToPlace(p)));

        table.On("project.create", json.CreateProjectParams, json.ProjectStateDto, p => Wire.Of(core.Projects.Create(p.Path, p.Title, p.Format is { } format ? Wire.ToFormat(format) : null, p.Origin)));
        table.On("project.open", json.PathParams, json.ProjectStateDto, p => Wire.Of(core.Projects.Open(p.Path, p.Origin)));
        table.On("project.get", json.ProjectStateDto, () => Wire.Of(core.Projects.Current()));
        table.On("project.rename", json.TitleParams, json.ProjectStateDto, p => Wire.Of(core.Projects.Rename(p.Title, p.Origin)));
        table.On("project.setFormat", json.SetFormatParams, json.ProjectStateDto, p => Wire.Of(core.Projects.SetFormat(Wire.ToFormat(p.Format), p.Origin)));
        table.On("project.manuscript", json.ManuscriptDto, () => Wire.Of(core.Projects.Manuscript()));
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

        table.On("notes.get", json.IReadOnlyListNoteDto, () => [.. core.Notes.All().Select(Wire.Of)]);
        table.On("note.create", json.CreateNoteParams, json.NoteDto, p => Wire.Of(core.Notes.Create(
            p.DocumentId is { } document ? new DocumentId(document) : null,
            Wire.ToContent(p.Content),
            p.Anchored,
            Wire.ToElements(p.Elements),
            p.Origin)));
        table.On("note.update", json.UpdateNoteParams, json.NoteDto, p =>
            Wire.Of(core.Notes.Update(new NoteId(p.Id), Wire.ToUpdate(p.Changes), p.Origin)));
        table.On("note.delete", json.IdOriginParams, p => core.Notes.Delete(new NoteId(p.Id), p.Origin));
        table.On("note.restore", json.IdOriginParams, json.NoteDto, p => Wire.Of(core.Notes.Restore(new NoteId(p.Id), p.Origin)));

        table.On("board.get", json.BoardDto, () => Wire.Of(core.Elements.Board()));
        table.On("board.move", json.MoveCardsParams, p => core.Elements.Move(
            [.. p.Positions.Select(move => (new ElementId(move.Id), new BoardPosition(move.X, move.Y)))], p.Origin));
        table.On("element.create", json.CreateElementParams, json.ElementDto, p => Wire.Of(core.Elements.Create(
            Wire.ParseElementKind(p.Kind),
            p.OtherKind,
            p.Name,
            Wire.ToAttributes(p.Attributes),
            p.Position is { } position ? new BoardPosition(position.X, position.Y) : null,
            p.Origin)));
        table.On("element.get", json.IdParams, json.ElementDto, p => Wire.Of(core.Elements.Get(new ElementId(p.Id))));
        table.On("board.mentions", json.BoardMentionsDto, () => Wire.Of(core.Elements.BoardMentions()));
        table.On("suggestions.get", json.IReadOnlyListSuggestionDto, () =>
            [.. core.Elements.Suggestions().Select(suggestion => new SuggestionDto(suggestion.Name, suggestion.Count))]);
        table.On("suggestion.dismiss", json.DismissSuggestionParams, p => core.Elements.DismissSuggestion(p.Name, p.Origin));
        table.On("element.references", json.IdParams, json.ElementReferencesDto, p =>
            Wire.Of(core.Elements.References(new ElementId(p.Id))));
        table.On("element.update", json.UpdateElementParams, json.ElementDto, p =>
            Wire.Of(core.Elements.Update(new ElementId(p.Id), Wire.ToUpdate(p.Changes), p.Origin)));
        table.On("element.delete", json.IdOriginParams, p => core.Elements.Delete(new ElementId(p.Id), p.Origin));
        table.On("element.restore", json.IdOriginParams, json.ElementDto, p => Wire.Of(core.Elements.Restore(new ElementId(p.Id), p.Origin)));
        table.On("element.readImage", json.ImagePathParams, json.ImageDataDto, p => Wire.Of(core.Elements.ReadImage(p.Path)));
        table.On("element.setImage", json.SetImageParams, json.ElementSummaryDto, p => Wire.Summary(core.Elements.SetImage(
            new ElementId(p.Id), Convert.FromBase64String(p.Image), Convert.FromBase64String(p.Thumbnail), p.Origin)));
        table.On("element.removeImage", json.IdOriginParams, json.ElementSummaryDto, p =>
            Wire.Summary(core.Elements.RemoveImage(new ElementId(p.Id), p.Origin)));
        table.On("element.image", json.ElementImageParams, json.ImageDataDto, p => Wire.Of(core.Elements.Image(
            new ElementId(p.Id), p.Size == "thumbnail" ? ImageSize.Thumbnail : ImageSize.Full)));
        table.On("relationship.create", json.RelateParams, json.RelationshipDto, p => Wire.Of(core.Elements.Relate(
            new ElementId(p.From), new ElementId(p.To), Wire.ToChoice(p.Kind, p.NewKind), p.Origin)));
        table.On("relationship.update", json.ChangeRelationshipParams, json.RelationshipDto, p => Wire.Of(core.Elements.ChangeRelationship(
            new RelationshipId(p.Id), Wire.ToChoice(p.Kind, p.NewKind), p.Origin)));
        table.On("relationship.delete", json.IdOriginParams, p => core.Elements.Unrelate(new RelationshipId(p.Id), p.Origin));

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
