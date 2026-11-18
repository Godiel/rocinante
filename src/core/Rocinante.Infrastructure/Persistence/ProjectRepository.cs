using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Projects;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores the project and its index: the <c>project</c> row and the index columns of <c>document</c>.</summary>
public sealed class ProjectRepository(ProjectDatabase database)
{
    public Project Load()
    {
        using var command = database.Command("SELECT id, title, created_at FROM project;");
        using var reader = command.ExecuteReader();
        if (!reader.Read())
        {
            throw new ProjectFileException(ProjectFileError.Corrupted, database.FilePath, "The file has no project row.");
        }

        return Project.Rehydrate(new ProjectId(reader.GetId(0)), reader.GetString(1), reader.GetTime(2), LoadEntries());
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

            foreach (var entry in project.Chapters.Concat(project.Fragments).Concat(project.Trash))
            {
                SaveEntry(entry);
            }
        });
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
