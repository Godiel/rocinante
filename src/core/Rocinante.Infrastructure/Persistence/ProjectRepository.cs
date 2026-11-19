using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Formats;
using Rocinante.Domain.Projects;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>
/// Stores the project, its format and its index: the <c>project</c> and <c>work_format</c> rows and
/// the index columns of <c>document</c>.
/// </summary>
public sealed class ProjectRepository(ProjectDatabase database) : IProjectRepository
{
    public Project Load()
    {
        using var command = database.Command("SELECT id, title, created_at FROM project;");
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new ProjectFileException(ProjectFileError.Corrupted, database.FilePath, "The file has no project row.");
        }

        return Project.Rehydrate(
            new ProjectId(reader.GetId(0)), reader.GetString(1), reader.GetTime(2), LoadEntries(), LoadFormat());
    }

    /// <summary>
    /// Saves the title and the whole index. A new entry gets its row here, with empty text; its
    /// text is then saved through <see cref="DocumentRepository"/>.
    /// </summary>
    public void Save(Project project)
    {
        ArgumentNullException.ThrowIfNull(project);

        database.InTransaction(() =>
        {
            database.Execute(
                """
                INSERT INTO project (id, title, created_at) VALUES ($id, $title, $createdAt)
                ON CONFLICT (id) DO UPDATE SET title = excluded.title;
                """,
                ("$id", Columns.Id(project.Id.Value)),
                ("$title", project.Title),
                ("$createdAt", Columns.Time(project.CreatedAt)));

            SaveFormat(project.Format);

            foreach (var entry in project.Chapters.Concat(project.Fragments).Concat(project.Trash))
            {
                SaveEntry(entry);
            }
        });
    }

    private void SaveFormat(WorkFormat format)
    {
        database.Execute(
            """
            INSERT INTO work_format (
                singleton, page_size, page_width, page_height,
                margin_top, margin_bottom, margin_inside, margin_outside,
                typeface, body_size, leading, first_line_indent, justified, drop_cap)
            VALUES (
                1, $pageSize, $pageWidth, $pageHeight,
                $top, $bottom, $inside, $outside,
                $typeface, $bodySize, $leading, $indent, $justified, $dropCap)
            ON CONFLICT (singleton) DO UPDATE SET
                page_size = excluded.page_size,
                page_width = excluded.page_width,
                page_height = excluded.page_height,
                margin_top = excluded.margin_top,
                margin_bottom = excluded.margin_bottom,
                margin_inside = excluded.margin_inside,
                margin_outside = excluded.margin_outside,
                typeface = excluded.typeface,
                body_size = excluded.body_size,
                leading = excluded.leading,
                first_line_indent = excluded.first_line_indent,
                justified = excluded.justified,
                drop_cap = excluded.drop_cap;
            """,
            ("$pageSize", Columns.Size(format.PageSize)),
            ("$pageWidth", format.PageWidth),
            ("$pageHeight", format.PageHeight),
            ("$top", format.Margins.Top),
            ("$bottom", format.Margins.Bottom),
            ("$inside", format.Margins.Inside),
            ("$outside", format.Margins.Outside),
            ("$typeface", Columns.Face(format.Typeface)),
            ("$bodySize", format.BodySize),
            ("$leading", format.Leading),
            ("$indent", Columns.Flag(format.FirstLineIndent)),
            ("$justified", Columns.Flag(format.Justified)),
            ("$dropCap", Columns.Flag(format.DropCap)));
    }

    private WorkFormat LoadFormat()
    {
        using var command = database.Command(
            """
            SELECT page_size, page_width, page_height, margin_top, margin_bottom, margin_inside, margin_outside,
                   typeface, body_size, leading, first_line_indent, justified, drop_cap
            FROM work_format;
            """);
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new ProjectFileException(ProjectFileError.Corrupted, database.FilePath, "The file has no format row.");
        }

        return WorkFormat.Create(
            reader.GetPageSize(0),
            reader.GetDouble(1),
            reader.GetDouble(2),
            new PageMargins(reader.GetDouble(3), reader.GetDouble(4), reader.GetDouble(5), reader.GetDouble(6)),
            reader.GetTypeface(7),
            reader.GetDouble(8),
            reader.GetDouble(9),
            reader.GetFlag(10),
            reader.GetFlag(11),
            reader.GetFlag(12));
    }

    private void SaveEntry(DocumentEntry entry)
    {
        var empty = DocumentContent.Empty;
        database.Execute(
            """
            INSERT INTO document (
                id, kind, title, position, created_at, deleted_at,
                content, revision, updated_at, words, characters, paragraphs,
                active_writing_ms, last_edit_at, unversioned_changes)
            VALUES (
                $id, $kind, $title, $position, $createdAt, $deletedAt,
                $content, 0, $createdAt, $words, $characters, $paragraphs,
                0, NULL, 0)
            ON CONFLICT (id) DO UPDATE SET
                kind = excluded.kind,
                title = excluded.title,
                position = excluded.position,
                deleted_at = excluded.deleted_at;
            """,
            ("$id", Columns.Id(entry.Id.Value)),
            ("$kind", Columns.Kind(entry.Kind)),
            ("$title", entry.Title),
            ("$position", entry.Position),
            ("$createdAt", Columns.Time(entry.CreatedAt)),
            ("$deletedAt", Columns.Time(entry.DeletedAt)),
            ("$content", empty.Json),
            ("$words", empty.Statistics.Words),
            ("$characters", empty.Statistics.Characters),
            ("$paragraphs", empty.Statistics.Paragraphs));
    }

    private List<DocumentEntry> LoadEntries()
    {
        using var command = database.Command("SELECT id, kind, title, position, created_at, deleted_at FROM document;");
        using var reader = command.ExecuteReader();

        var entries = new List<DocumentEntry>();
        while (reader.Read())
        {
            entries.Add(DocumentEntry.Rehydrate(
                new DocumentId(reader.GetId(0)),
                reader.GetDocumentKind(1),
                reader.GetString(2),
                reader.GetInt32(3),
                reader.GetTime(4),
                reader.GetNullableTime(5)));
        }

        return entries;
    }
}
