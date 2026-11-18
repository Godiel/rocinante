using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Rocinante.Sidecar.Protocol;

// Wire shapes of src/contracts/protocol.json. They only carry data: the contract tests check that
// what these records serialize to matches the schemas, so the two cannot drift apart.

// Shared definitions.
internal sealed record StatisticsDto(int Words, int Characters, int Paragraphs);

internal sealed record DocumentEntryDto(Guid Id, string Kind, string Title, int Position, DateTimeOffset CreatedAt, DateTimeOffset? DeletedAt);

internal sealed record ProjectIndexDto(IReadOnlyList<DocumentEntryDto> Chapters, IReadOnlyList<DocumentEntryDto> Fragments, IReadOnlyList<DocumentEntryDto> Trash);

internal sealed record ProjectStateDto(Guid Id, string Path, string Title, DateTimeOffset CreatedAt, ProjectIndexDto Index, StatisticsDto Work);

internal sealed record DocumentStateDto(Guid Id, JsonNode Content, long Revision, StatisticsDto Statistics, DateTimeOffset UpdatedAt);

internal sealed record VersionSummaryDto(Guid Id, Guid DocumentId, string Kind, string? Name, DateTimeOffset CreatedAt, StatisticsDto Statistics);

internal sealed record NoteDto(Guid Id, Guid DocumentId, string Text, bool Anchored, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);

// Params.
internal sealed record OriginParams(string Origin);

internal sealed record PathParams(string Path, string Origin);

internal sealed record CreateProjectParams(string Path, string Title, string Origin);

internal sealed record TitleParams(string Title, string Origin);

internal sealed record CreateDocumentParams(string Kind, string Title, int? Position, string Origin);

internal sealed record RenameDocumentParams(Guid Id, string Title, string Origin);

internal sealed record MoveDocumentParams(Guid Id, string Kind, int Position, string Origin);

internal sealed record IdParams(Guid Id);

internal sealed record IdOriginParams(Guid Id, string Origin);

internal sealed record DocumentReferenceParams(Guid DocumentId);

internal sealed record SaveDocumentParams(Guid Id, JsonObject Content, string Origin);

internal sealed record CreateVersionParams(Guid DocumentId, string? Name, string Origin);

internal sealed record CreateNoteParams(Guid DocumentId, string Text, bool Anchored, string Origin);

internal sealed record UpdateNoteParams(Guid Id, string Text, string Origin);

// Results.
internal sealed record SystemInfoResult(int ProtocolVersion, string CoreVersion);

internal sealed record DocumentSavedResult(bool Changed, long Revision, StatisticsDto Statistics, StatisticsDto Work, VersionSummaryDto? AutomaticVersion);

internal sealed record VersionDetailResult(VersionSummaryDto Version, JsonNode Content);

internal sealed record VersionRestoredResult(DocumentStateDto Document, VersionSummaryDto? Before);

// Notifications.
internal sealed record ProjectNotification(ProjectStateDto Project, string Origin);

internal sealed record ProjectClosedNotification(string Origin);

internal sealed record DocumentChangedNotification(DocumentStateDto Document, StatisticsDto Work, string Origin);

internal sealed record VersionsChangedNotification(Guid DocumentId, string Origin);

internal sealed record NotesChangedNotification(Guid DocumentId, IReadOnlyList<NoteDto> Notes, string Origin);

/// <summary>
/// Source-generated serialization for every wire shape. The core is published trimmed, where
/// reflection-based serialization is unavailable.
/// </summary>
[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    RespectNullableAnnotations = true)]
[JsonSerializable(typeof(OriginParams))]
[JsonSerializable(typeof(PathParams))]
[JsonSerializable(typeof(CreateProjectParams))]
[JsonSerializable(typeof(TitleParams))]
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
internal sealed partial class WireJson : JsonSerializerContext;
