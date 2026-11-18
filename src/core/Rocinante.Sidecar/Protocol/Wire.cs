using System.Text.Json.Nodes;
using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Versions;

namespace Rocinante.Sidecar.Protocol;

/// <summary>Translates between domain values and their wire shapes.</summary>
internal static class Wire
{
    public static DocumentKind ParseKind(string kind) => kind switch
    {
        "chapter" => DocumentKind.Chapter,
        "fragment" => DocumentKind.Fragment,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown document kind."),
    };

    public static string Kind(DocumentKind kind) => kind == DocumentKind.Chapter ? "chapter" : "fragment";

    public static string Kind(VersionKind kind) => kind switch
    {
        VersionKind.Automatic => "automatic",
        VersionKind.Manual => "manual",
        VersionKind.BeforeRestore => "beforeRestore",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown version kind."),
    };

    public static StatisticsDto Of(TextStatistics statistics) =>
        new(statistics.Words, statistics.Characters, statistics.Paragraphs);

    public static DocumentEntryDto Of(DocumentEntry entry) =>
        new(entry.Id.Value, Kind(entry.Kind), entry.Title, entry.Position, entry.CreatedAt, entry.DeletedAt);

    public static ProjectIndexDto IndexOf(Project project) =>
        new([.. project.Chapters.Select(Of)], [.. project.Fragments.Select(Of)], [.. project.Trash.Select(Of)]);

    public static ProjectStateDto Of(ProjectSnapshot snapshot) =>
        new(
            snapshot.Project.Id.Value,
            snapshot.Path,
            snapshot.Project.Title,
            snapshot.Project.CreatedAt,
            IndexOf(snapshot.Project),
            Of(snapshot.Work));

    public static DocumentStateDto Of(Document document) =>
        new(document.Id.Value, Content(document.Content), document.Revision, Of(document.Content.Statistics), document.UpdatedAt);

    public static VersionSummaryDto Of(VersionSummary version) =>
        new(version.Id.Value, version.DocumentId.Value, Kind(version.Kind), version.Name, version.CreatedAt, Of(version.Statistics));

    public static NoteDto Of(Note note) =>
        new(note.Id.Value, note.DocumentId.Value, note.Text, note.IsAnchored, note.CreatedAt, note.UpdatedAt);

    public static JsonNode Content(DocumentContent content) => JsonNode.Parse(content.Json)!;

    public static PreferencesDto Of(Preferences preferences) =>
        new(
            preferences.Theme == Theme.Candlelight ? "candlelight" : "paper",
            preferences.Outline == OutlineMode.Floating ? "floating" : "docked",
            preferences.CounterVisible,
            preferences.TypewriterScrolling);

    public static PreferencesChange ToChange(PreferencesChangeDto change) =>
        new(
            change.Theme switch { null => null, "candlelight" => Theme.Candlelight, _ => Theme.Paper },
            change.Outline switch { null => null, "floating" => OutlineMode.Floating, _ => OutlineMode.Docked },
            change.CounterVisible,
            change.TypewriterScrolling);

    public static PlaceDto Of(Place place) => new(place.DocumentId.Value, place.Anchor, place.Head);

    public static Place ToPlace(PlaceDto place) => new(new Domain.DocumentId(place.DocumentId), place.Anchor, place.Head);

    public static IReadOnlyList<RecentProjectDto> Of(IReadOnlyList<RecentProjectView> recent) =>
        [.. recent.Select(entry => new RecentProjectDto(entry.Path, entry.Title, entry.LastOpenedAt, entry.Exists))];

    public static StartStateDto Of(StartState state) =>
        new(
            state.Project is { } project ? Of(project) : null,
            state.Place is { } place ? Of(place) : null,
            state.Problem is { } problem ? new StartProblemDto(problem.Path, JsonRpcServer.Reason(problem.Error.ToString())) : null,
            Of(state.Recent),
            Of(state.Preferences),
            state.DefaultFolder);
}
