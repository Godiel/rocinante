using System.Text.Json;
using System.Text.Json.Nodes;
using Rocinante.Application;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Application.Squire;
using Rocinante.Domain;
using Rocinante.Domain.Books;
using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Formats;
using Rocinante.Domain.Notes;
using Rocinante.Domain.Projects;
using Rocinante.Domain.Squire;
using Rocinante.Domain.Threads;
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
            Of(snapshot.Work),
            Of(snapshot.Project.Format));

    /// <summary>Enum members go on the wire in camelCase: <c>A5</c> is <c>a5</c>, <c>EbGaramond</c> is <c>ebGaramond</c>.</summary>
    public static WorkFormatDto Of(WorkFormat format) =>
        new(
            JsonNamingPolicy.CamelCase.ConvertName(format.PageSize.ToString()),
            format.PageWidth,
            format.PageHeight,
            new PageMarginsDto(format.Margins.Top, format.Margins.Bottom, format.Margins.Inside, format.Margins.Outside),
            JsonNamingPolicy.CamelCase.ConvertName(format.Typeface.ToString()),
            format.BodySize,
            format.Leading,
            format.FirstLineIndent,
            format.Justified,
            format.DropCap);

    /// <summary>The contract has already checked the names; the domain checks the measures.</summary>
    public static WorkFormat ToFormat(WorkFormatDto format) =>
        WorkFormat.Create(
            Enum.Parse<PageSize>(format.PageSize, ignoreCase: true),
            format.PageWidth,
            format.PageHeight,
            new PageMargins(format.Margins.Top, format.Margins.Bottom, format.Margins.Inside, format.Margins.Outside),
            Enum.Parse<Typeface>(format.Typeface, ignoreCase: true),
            format.BodySize,
            format.Leading,
            format.FirstLineIndent,
            format.Justified,
            format.DropCap);

    public static ManuscriptDto Of(IReadOnlyList<ManuscriptChapter> chapters) =>
        new([.. chapters.Select(chapter => new ManuscriptChapterDto(chapter.Id.Value, chapter.Title, Content(chapter.Content)))]);

    public static DocumentStateDto Of(Document document) =>
        new(document.Id.Value, Content(document.Content), document.Revision, Of(document.Content.Statistics), document.UpdatedAt);

    public static VersionSummaryDto Of(VersionSummary version) =>
        new(version.Id.Value, version.DocumentId.Value, Kind(version.Kind), version.Name, version.CreatedAt, Of(version.Statistics));

    public static NoteDto Of(Note note) =>
        new(
            note.Id.Value,
            note.DocumentId?.Value,
            Content(note.Content),
            note.Text,
            note.IsAnchored,
            note.AnchorOrder,
            note.ResolvedAt,
            [.. note.Elements.Select(element => element.Value)],
            note.CreatedAt,
            note.UpdatedAt);

    public static ElementReferencesDto Of(ElementReferences references) =>
        new(
            references.Total,
            references.Documents,
            references.First is { } first ? new MentionPlaceDto(first.DocumentId.Value, first.Ordinal) : null,
            [.. references.ByDocument.Select(document => new DocumentMentionsDto(
                document.DocumentId.Value,
                [.. document.Mentions.Select(mention => new MentionDto(mention.Ordinal, mention.Before, mention.Text, mention.After))]))],
            [.. references.Together.Select(other => new CoincidenceDto(other.ElementId.Value, other.Paragraphs))]);

    public static BoardMentionsDto Of(IReadOnlyList<MentionCount> counts) =>
        new([.. counts.Select(count => new MentionCountDto(count.ElementId.Value, count.Total, count.Documents))]);

    public static SquireSettingsDto Of(SquireState state) =>
        new(
            state.Provider is { } provider ? SquireUseCases.NameOf(provider) : null,
            state.Model,
            state.Endpoint,
            state.HasKey,
            state.Enabled,
            Name(state.Status),
            state.Problem is { } problem ? JsonRpcServer.Reason(problem.ToString()) : null,
            state.Pending);

    public static ProposalDto Of(Proposal proposal) =>
        new(
            proposal.Id.Value,
            Name(proposal.Kind),
            proposal.DocumentId.Value,
            proposal.Passage,
            proposal.CreatedAt,
            proposal.Element is { } element ? new ProposedElementDto(element.Name, Name(element.Kind), element.OtherKind) : null,
            proposal.Relationship is { } relation
                ? new ProposedRelationshipDto(relation.From, relation.To, relation.Forward, relation.Inverse)
                : null,
            proposal.Attribute is { } detail ? new ProposedDetailDto(detail.Element, detail.Name, detail.Value) : null,
            proposal.Milestone is { } milestone ? new ProposedMilestoneDto(milestone.Element, milestone.Text) : null);

    public static SquireProvider ToProvider(string provider) => SquireUseCases.ProviderOf(provider);

    public static ProposalCorrection ToCorrection(ProposalChangesDto changes) =>
        new(
            changes.Name,
            changes.Kind is { } kind ? ParseElementKind(kind) : null,
            changes.OtherKind,
            changes.Forward,
            changes.Inverse,
            changes.Value,
            changes.Text);

    public static DocumentContent ToContent(JsonObject content) => DocumentContent.Parse(content.ToJsonString());

    public static IReadOnlyList<ElementId> ToElements(IReadOnlyList<Guid>? elements) =>
        elements is null ? [] : [.. elements.Select(element => new ElementId(element))];

    public static NoteUpdate ToUpdate(NoteChangesDto changes) =>
        new(
            changes.Content is { } content ? ToContent(content) : null,
            changes.Resolved,
            changes.Elements is null ? null : ToElements(changes.Elements));

    public static JsonNode Content(DocumentContent content) => JsonNode.Parse(content.Json)!;

    public static PreferencesDto Of(Preferences preferences) =>
        new(
            preferences.Theme == Theme.Candlelight ? "candlelight" : "paper",
            preferences.Outline == OutlineMode.Floating ? "floating" : "docked",
            preferences.CounterVisible,
            preferences.TypewriterScrolling,
            Of(preferences.Ambience),
            preferences.MentionsVisible,
            preferences.CorrectionVisible,
            preferences.CheckForUpdates);

    public static PreferencesChange ToChange(PreferencesChangeDto change) =>
        new(
            change.Theme switch { null => null, "candlelight" => Theme.Candlelight, _ => Theme.Paper },
            change.Outline switch { null => null, "floating" => OutlineMode.Floating, _ => OutlineMode.Docked },
            change.CounterVisible,
            change.TypewriterScrolling,
            change.Ambience is { } ambience ? ToAmbience(ambience) : null,
            change.MentionsVisible,
            change.CorrectionVisible,
            change.CheckForUpdates);

    private static string Name<T>(T value)
        where T : struct, Enum => JsonNamingPolicy.CamelCase.ConvertName(value.ToString());

    public static AmbienceDto Of(Ambience ambience) =>
        new(
            ambience.Background.Value,
            new TypingDto(Name(ambience.Typing.Sound), ambience.Typing.Volume, ambience.Typing.Muted),
            [.. ambience.Ambients.Select(ambient => new AmbientDto(ambient.Id.Value, ambient.Level))],
            ambience.AmbientVolume,
            ambience.AmbientMuted,
            ambience.DimOthers,
            new SessionGoalDto(Name(ambience.Goal.Kind), ambience.Goal.Kind == GoalKind.None ? null : ambience.Goal.Amount));

    /// <summary>The contract has already checked the names, the ids, the volumes and the range of the goal.</summary>
    public static Ambience ToAmbience(AmbienceDto ambience) =>
        new(
            AmbienceId.Parse(ambience.Background),
            new Typing(Enum.Parse<TypingSound>(ambience.Typing.Sound, ignoreCase: true), ambience.Typing.Volume, ambience.Typing.Muted),
            [.. ambience.Ambients.Select(ambient => new Ambient(AmbienceId.Parse(ambient.Id), ambient.Level))],
            ambience.AmbientVolume,
            ambience.AmbientMuted,
            ambience.DimOthers,
            ambience.Goal.Kind switch
            {
                "words" => SessionGoal.Words(ambience.Goal.Amount!.Value),
                "minutes" => SessionGoal.Minutes(ambience.Goal.Amount!.Value),
                _ => SessionGoal.None,
            });

    public static OwnAmbienceKind ParseOwnKind(string kind) => kind == "image" ? OwnAmbienceKind.Image : OwnAmbienceKind.Sound;

    public static OwnAmbienceDto Of(OwnAmbienceView own) => new(own.Id, Name(own.Kind), own.Name, own.File);

    public static IReadOnlyList<OwnAmbienceDto> Of(IReadOnlyList<OwnAmbienceView> own) => [.. own.Select(Of)];

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
            state.DefaultFolder,
            Of(state.SuggestedFormat),
            Of(state.OwnAmbience));

    public static ElementKind ParseElementKind(string kind) => Enum.Parse<ElementKind>(kind, ignoreCase: true);

    public static BoardPositionDto Of(BoardPosition position) => new(position.X, position.Y);

    public static ElementSummaryDto Summary(Element element) =>
        new(
            element.Id.Value,
            Name(element.Kind),
            element.OtherKind,
            element.Name,
            element.Aliases,
            Of(element.Position),
            element.ImageVersion is { } version ? new ElementImageInfoDto(version) : null);

    public static ElementDto Of(Element element) =>
        new(
            element.Id.Value,
            Name(element.Kind),
            element.OtherKind,
            element.Name,
            element.Aliases,
            [.. element.Attributes.Select(attribute => new ElementAttributeDto(attribute.Name, attribute.Value))],
            Content(element.Description),
            Of(element.Position),
            element.ImageVersion is { } version ? new ElementImageInfoDto(version) : null);

    public static RelationshipDto Of(Relationship relationship) =>
        new(
            relationship.Id.Value,
            relationship.From.Value,
            relationship.To.Value,
            relationship.Kind.Value,
            relationship.Starts?.Value,
            relationship.Ends?.Value);

    public static BookDetailsDto Of(BookDetails details) =>
        new(details.Author, details.Credits, details.CoverVersion is { } version ? new CoverDto(version) : null);

    public static ExportFormat ToExportFormat(string format) => format switch
    {
        "pdf" => ExportFormat.Pdf,
        "epub" => ExportFormat.Epub,
        "docx" => ExportFormat.Docx,
        _ => ExportFormat.Markdown,
    };

    public static MilestoneDto Of(Milestone milestone) =>
        new(
            milestone.Id.Value,
            milestone.ElementId.Value,
            milestone.DocumentId.Value,
            milestone.Paragraph.Length <= Proposal.MaxPassageLength ? milestone.Paragraph : milestone.Paragraph[..Proposal.MaxPassageLength],
            milestone.Text,
            milestone.Lost,
            milestone.CreatedAt);

    public static ThreadsDto Of(ThreadsView view) =>
        new(
            [.. view.Chosen.Select(id => id.Value)],
            [.. view.Chapters.Select(chapter => new ThreadChapterDto(chapter.Id.Value, chapter.Title))],
            [.. view.Threads.Select(thread => new FateThreadDto(
                thread.ElementId.Value,
                [.. thread.Points.Select(point => new ThreadPointDto(point.DocumentId.Value, point.Mentions))]))],
            [.. view.Meetings.Select(meeting => new ThreadMeetingDto(
                meeting.DocumentId.Value, meeting.First.Value, meeting.Second.Value, meeting.Paragraphs))],
            [.. view.Milestones.Select(Of)]);

    public static RelationshipKindDto Of(RelationshipKind kind) => new(kind.KindId.Value, kind.Forward, kind.Inverse);

    public static BoardDto Of(ElementBoard board) =>
        new(
            [.. board.Elements.OrderBy(element => element.Id.Value).Select(Summary)],
            [.. board.Relationships.Select(Of)],
            [.. board.OwnKinds.Select(Of)],
            [.. board.Trash.Select(Summary)]);

    public static ElementsChangedNotification Of(ElementsChange change, string origin) =>
        new(
            [.. change.Elements.Select(Summary)],
            [.. change.Trash.Select(Summary)],
            [.. change.Details.Select(Of)],
            [.. change.Relationships.Select(Of)],
            [.. change.RemovedRelationships.Select(id => id.Value)],
            [.. change.OwnKinds.Select(Of)],
            origin);

    public static ElementAttribute[]? ToAttributes(IReadOnlyList<ElementAttributeDto>? attributes) =>
        attributes is null ? null : [.. attributes.Select(attribute => new ElementAttribute(attribute.Name, attribute.Value))];

    public static ElementUpdate ToUpdate(ElementChangesDto changes) =>
        new(
            changes.Name,
            changes.Kind is { } kind ? ParseElementKind(kind) : null,
            changes.OtherKind,
            changes.Aliases,
            ToAttributes(changes.Attributes),
            changes.Description is { } description ? DocumentContent.Parse(description.ToJsonString()) : null);

    public static RelationshipKindChoice ToChoice(string? kind, NewRelationshipKindDto? newKind) =>
        kind is not null
            ? RelationshipKindChoice.Of(RelationshipKindId.Parse(kind))
            : RelationshipKindChoice.New(newKind!.Forward, newKind.Inverse);

    public static ImageDataDto Of(StoredImage image) => new(Convert.ToBase64String(image.Data.Span), image.MediaType);
}
