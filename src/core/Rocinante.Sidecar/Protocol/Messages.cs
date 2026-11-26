using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Rocinante.Sidecar.Protocol;

// Wire shapes of src/contracts/protocol.json. They only carry data: the contract tests check that
// what these records serialize to matches the schemas, so the two cannot drift apart.

// Shared definitions.
internal sealed record StatisticsDto(int Words, int Characters, int Paragraphs);

internal sealed record DocumentEntryDto(Guid Id, string Kind, string Title, int Position, DateTimeOffset CreatedAt, DateTimeOffset? DeletedAt);

internal sealed record ProjectIndexDto(IReadOnlyList<DocumentEntryDto> Chapters, IReadOnlyList<DocumentEntryDto> Fragments, IReadOnlyList<DocumentEntryDto> Trash);

internal sealed record PageMarginsDto(double Top, double Bottom, double Inside, double Outside);

internal sealed record WorkFormatDto(
    string PageSize,
    double PageWidth,
    double PageHeight,
    PageMarginsDto Margins,
    string Typeface,
    double BodySize,
    double Leading,
    bool FirstLineIndent,
    bool Justified,
    bool DropCap);

internal sealed record ProjectStateDto(Guid Id, string Path, string Title, DateTimeOffset CreatedAt, ProjectIndexDto Index, StatisticsDto Work, WorkFormatDto Format);

internal sealed record ManuscriptChapterDto(Guid Id, string Title, JsonNode Content);

internal sealed record ManuscriptDto(IReadOnlyList<ManuscriptChapterDto> Chapters);

internal sealed record DocumentStateDto(Guid Id, JsonNode Content, long Revision, StatisticsDto Statistics, DateTimeOffset UpdatedAt);

internal sealed record VersionSummaryDto(Guid Id, Guid DocumentId, string Kind, string? Name, DateTimeOffset CreatedAt, StatisticsDto Statistics);

internal sealed record NoteDto(
    Guid Id,
    Guid? DocumentId,
    JsonNode Content,
    string Text,
    bool Anchored,
    int? Order,
    DateTimeOffset? ResolvedAt,
    IReadOnlyList<Guid> Elements,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

internal sealed record TypingDto(string Sound, double Volume, bool Muted);

internal sealed record AmbientDto(string Id, double Level);

/// <summary>amount is left out when there is no goal, as the contract asks.</summary>
internal sealed record SessionGoalDto(string Kind, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? Amount);

internal sealed record AmbienceDto(
    string Background, TypingDto Typing, IReadOnlyList<AmbientDto> Ambients, double AmbientVolume, bool AmbientMuted, bool DimOthers, SessionGoalDto Goal);

internal sealed record OwnAmbienceDto(Guid Id, string Kind, string Name, string File);

internal sealed record PreferencesDto(
    string Theme, string Outline, bool CounterVisible, bool TypewriterScrolling, AmbienceDto Ambience, bool MentionsVisible);

internal sealed record PreferencesChangeDto(
    string? Theme, string? Outline, bool? CounterVisible, bool? TypewriterScrolling, AmbienceDto? Ambience, bool? MentionsVisible);

internal sealed record PlaceDto(Guid DocumentId, int Anchor, int Head);

internal sealed record RecentProjectDto(string Path, string Title, DateTimeOffset LastOpenedAt, bool Exists);

internal sealed record StartProblemDto(string Path, string Reason);

internal sealed record StartStateDto(
    ProjectStateDto? Project,
    PlaceDto? Place,
    StartProblemDto? Problem,
    IReadOnlyList<RecentProjectDto> Recent,
    PreferencesDto Preferences,
    string DefaultFolder,
    WorkFormatDto SuggestedFormat,
    IReadOnlyList<OwnAmbienceDto> OwnAmbience);

internal sealed record BoardPositionDto(double X, double Y);

internal sealed record ElementAttributeDto(string Name, string Value);

internal sealed record ElementImageInfoDto(long Version);

internal sealed record ElementSummaryDto(
    Guid Id, string Kind, string? OtherKind, string Name, IReadOnlyList<string> Aliases, BoardPositionDto Position, ElementImageInfoDto? Image);

internal sealed record ElementDto(
    Guid Id,
    string Kind,
    string? OtherKind,
    string Name,
    IReadOnlyList<string> Aliases,
    IReadOnlyList<ElementAttributeDto> Attributes,
    JsonNode Description,
    BoardPositionDto Position,
    ElementImageInfoDto? Image);

internal sealed record RelationshipDto(Guid Id, Guid From, Guid To, string Kind);

internal sealed record RelationshipKindDto(string Id, string Forward, string? Inverse);

internal sealed record NewRelationshipKindDto(string Forward, string? Inverse);

internal sealed record BoardDto(
    IReadOnlyList<ElementSummaryDto> Elements, IReadOnlyList<RelationshipDto> Relationships, IReadOnlyList<RelationshipKindDto> OwnKinds, IReadOnlyList<ElementSummaryDto> Trash);

internal sealed record ImageDataDto(string Data, string MediaType);

// Params.
internal sealed record UpdatePreferencesParams(PreferencesChangeDto Changes, string Origin);

internal sealed record OriginParams(string Origin);

internal sealed record ImportAmbienceParams(string Path, string Kind, string Origin);

internal sealed record ReportParams(string Source, string Level, string Message, string? Detail);

internal sealed record PathParams(string Path, string Origin);

internal sealed record CreateProjectParams(string Path, string Title, WorkFormatDto? Format, string Origin);

internal sealed record SetFormatParams(WorkFormatDto Format, string Origin);

internal sealed record TitleParams(string Title, string Origin);

internal sealed record CreateDocumentParams(string Kind, string Title, int? Position, string Origin);

internal sealed record RenameDocumentParams(Guid Id, string Title, string Origin);

internal sealed record MoveDocumentParams(Guid Id, string Kind, int Position, string Origin);

internal sealed record IdParams(Guid Id);

internal sealed record IdOriginParams(Guid Id, string Origin);

internal sealed record DocumentReferenceParams(Guid DocumentId);

internal sealed record SaveDocumentParams(Guid Id, JsonObject Content, string Origin);

internal sealed record CreateVersionParams(Guid DocumentId, string? Name, string Origin);

internal sealed record CreateNoteParams(Guid? DocumentId, JsonObject Content, bool Anchored, IReadOnlyList<Guid>? Elements, string Origin);

internal sealed record MentionDto(int Ordinal, string Before, string Text, string After);

internal sealed record DocumentMentionsDto(Guid DocumentId, IReadOnlyList<MentionDto> Mentions);

internal sealed record MentionPlaceDto(Guid DocumentId, int Ordinal);

internal sealed record CoincidenceDto(Guid ElementId, int Paragraphs);

internal sealed record ElementReferencesDto(
    int Total, int Chapters, MentionPlaceDto? First, IReadOnlyList<DocumentMentionsDto> Documents, IReadOnlyList<CoincidenceDto> Together);

internal sealed record MentionCountDto(Guid Id, int Total, int Chapters);

internal sealed record BoardMentionsDto(IReadOnlyList<MentionCountDto> Elements);

internal sealed record SuggestionDto(string Name, int Count);

internal sealed record DismissSuggestionParams(string Name, string Origin);

internal sealed record SuggestionsChangedNotification(string Origin);

internal sealed record NoteChangesDto(JsonObject? Content, bool? Resolved, IReadOnlyList<Guid>? Elements);

internal sealed record UpdateNoteParams(Guid Id, NoteChangesDto Changes, string Origin);

internal sealed record CardPositionDto(Guid Id, double X, double Y);

internal sealed record MoveCardsParams(IReadOnlyList<CardPositionDto> Positions, string Origin);

internal sealed record CreateElementParams(
    string Kind, string? OtherKind, string Name, IReadOnlyList<ElementAttributeDto>? Attributes, BoardPositionDto? Position, string Origin);

internal sealed record ElementChangesDto(
    string? Name, string? Kind, string? OtherKind, IReadOnlyList<string>? Aliases, IReadOnlyList<ElementAttributeDto>? Attributes, JsonObject? Description);

internal sealed record UpdateElementParams(Guid Id, ElementChangesDto Changes, string Origin);

internal sealed record ImagePathParams(string Path);

internal sealed record SetImageParams(Guid Id, string Image, string Thumbnail, string Origin);

internal sealed record ElementImageParams(Guid Id, string Size);

internal sealed record RelateParams(Guid From, Guid To, string? Kind, NewRelationshipKindDto? NewKind, string Origin);

internal sealed record ChangeRelationshipParams(Guid Id, string? Kind, NewRelationshipKindDto? NewKind, string Origin);

// Results.
internal sealed record SystemInfoResult(int ProtocolVersion, string CoreVersion);

internal sealed record DocumentSavedResult(bool Changed, long Revision, StatisticsDto Statistics, StatisticsDto Work, VersionSummaryDto? AutomaticVersion);

internal sealed record VersionDetailResult(VersionSummaryDto Version, JsonNode Content);

internal sealed record VersionRestoredResult(DocumentStateDto Document, VersionSummaryDto? Before);

// Notifications.
internal sealed record PreferencesChangedNotification(PreferencesDto Preferences, string Origin);

internal sealed record AmbienceChangedNotification(IReadOnlyList<OwnAmbienceDto> Own, string Origin);

internal sealed record RecentChangedNotification(IReadOnlyList<RecentProjectDto> Recent, string Origin);

internal sealed record ProjectNotification(ProjectStateDto Project, string Origin);

internal sealed record ProjectClosedNotification(string Origin);

internal sealed record DocumentChangedNotification(DocumentStateDto Document, StatisticsDto Work, string Origin);

internal sealed record VersionsChangedNotification(Guid DocumentId, string Origin);

internal sealed record NotesChangedNotification(IReadOnlyList<NoteDto> Notes, IReadOnlyList<Guid> Removed, string Origin);

internal sealed record ElementsChangedNotification(
    IReadOnlyList<ElementSummaryDto> Elements,
    IReadOnlyList<ElementSummaryDto> Trash,
    IReadOnlyList<ElementDto> Details,
    IReadOnlyList<RelationshipDto> Relationships,
    IReadOnlyList<Guid> RemovedRelationships,
    IReadOnlyList<RelationshipKindDto> OwnKinds,
    string Origin);

/// <summary>
/// Source-generated serialization for every wire shape. The core is published trimmed, where
/// reflection-based serialization is unavailable.
/// </summary>
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    RespectNullableAnnotations = true)]
[JsonSerializable(typeof(OriginParams))]
[JsonSerializable(typeof(ReportParams))]
[JsonSerializable(typeof(UpdatePreferencesParams))]
[JsonSerializable(typeof(PlaceDto))]
[JsonSerializable(typeof(PreferencesDto))]
[JsonSerializable(typeof(StartStateDto))]
[JsonSerializable(typeof(IReadOnlyList<RecentProjectDto>))]
[JsonSerializable(typeof(PreferencesChangedNotification))]
[JsonSerializable(typeof(RecentChangedNotification))]
[JsonSerializable(typeof(ImportAmbienceParams))]
[JsonSerializable(typeof(OwnAmbienceDto))]
[JsonSerializable(typeof(IReadOnlyList<OwnAmbienceDto>))]
[JsonSerializable(typeof(AmbienceChangedNotification))]
[JsonSerializable(typeof(PathParams))]
[JsonSerializable(typeof(CreateProjectParams))]
[JsonSerializable(typeof(TitleParams))]
[JsonSerializable(typeof(SetFormatParams))]
[JsonSerializable(typeof(ManuscriptDto))]
[JsonSerializable(typeof(CreateDocumentParams))]
[JsonSerializable(typeof(RenameDocumentParams))]
[JsonSerializable(typeof(MoveDocumentParams))]
[JsonSerializable(typeof(IdParams))]
[JsonSerializable(typeof(IdOriginParams))]
[JsonSerializable(typeof(DocumentReferenceParams))]
[JsonSerializable(typeof(SaveDocumentParams))]
[JsonSerializable(typeof(CreateVersionParams))]
[JsonSerializable(typeof(CreateNoteParams))]
[JsonSerializable(typeof(UpdateNoteParams))]
[JsonSerializable(typeof(NoteChangesDto))]
[JsonSerializable(typeof(ElementReferencesDto))]
[JsonSerializable(typeof(BoardMentionsDto))]
[JsonSerializable(typeof(IReadOnlyList<SuggestionDto>))]
[JsonSerializable(typeof(DismissSuggestionParams))]
[JsonSerializable(typeof(SuggestionsChangedNotification))]
[JsonSerializable(typeof(SystemInfoResult))]
[JsonSerializable(typeof(ProjectStateDto))]
[JsonSerializable(typeof(DocumentEntryDto))]
[JsonSerializable(typeof(ProjectIndexDto))]
[JsonSerializable(typeof(DocumentStateDto))]
[JsonSerializable(typeof(DocumentSavedResult))]
[JsonSerializable(typeof(VersionSummaryDto))]
[JsonSerializable(typeof(IReadOnlyList<VersionSummaryDto>))]
[JsonSerializable(typeof(VersionDetailResult))]
[JsonSerializable(typeof(VersionRestoredResult))]
[JsonSerializable(typeof(NoteDto))]
[JsonSerializable(typeof(IReadOnlyList<NoteDto>))]
[JsonSerializable(typeof(ProjectNotification))]
[JsonSerializable(typeof(ProjectClosedNotification))]
[JsonSerializable(typeof(DocumentChangedNotification))]
[JsonSerializable(typeof(VersionsChangedNotification))]
[JsonSerializable(typeof(NotesChangedNotification))]
[JsonSerializable(typeof(BoardDto))]
[JsonSerializable(typeof(ElementDto))]
[JsonSerializable(typeof(ElementSummaryDto))]
[JsonSerializable(typeof(RelationshipDto))]
[JsonSerializable(typeof(ImageDataDto))]
[JsonSerializable(typeof(MoveCardsParams))]
[JsonSerializable(typeof(CreateElementParams))]
[JsonSerializable(typeof(UpdateElementParams))]
[JsonSerializable(typeof(ImagePathParams))]
[JsonSerializable(typeof(SetImageParams))]
[JsonSerializable(typeof(ElementImageParams))]
[JsonSerializable(typeof(RelateParams))]
[JsonSerializable(typeof(ChangeRelationshipParams))]
[JsonSerializable(typeof(ElementsChangedNotification))]
internal sealed partial class WireJson : JsonSerializerContext;
