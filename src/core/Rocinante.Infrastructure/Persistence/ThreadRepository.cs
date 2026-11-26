using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Threads;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>Stores the milestones in <c>milestone</c> and the elements shown in the threads in <c>thread_choice</c>.</summary>
public sealed class ThreadRepository(ProjectDatabase database) : IThreadRepository
{
    public IReadOnlyList<Milestone> Milestones()
    {
        using var command = database.Command(
            "SELECT id, element_id, document_id, paragraph, block, text, lost, created_at FROM milestone ORDER BY document_id, block, id;");
        using var reader = command.ExecuteReader();
        var found = new List<Milestone>();
        while (reader.Read())
        {
            found.Add(Milestone.Rehydrate(
                new MilestoneId(reader.GetId(0)),
                new ElementId(reader.GetId(1)),
                new DocumentId(reader.GetId(2)),
                reader.GetString(3),
                checked((int)reader.GetInt64(4)),
                reader.GetString(5),
                reader.GetFlag(6),
                reader.GetTime(7)));
        }

        return found;
    }

    public void Save(Milestone milestone)
    {
        ArgumentNullException.ThrowIfNull(milestone);

        database.InTransaction(() => database.Execute(
            """
            INSERT INTO milestone (id, element_id, document_id, paragraph, block, text, lost, created_at)
            VALUES ($id, $element, $document, $paragraph, $block, $text, $lost, $created)
            ON CONFLICT (id) DO UPDATE SET
                paragraph = excluded.paragraph, block = excluded.block, text = excluded.text, lost = excluded.lost;
            """,
            ("$id", Columns.Id(milestone.Id.Value)),
            ("$element", Columns.Id(milestone.ElementId.Value)),
            ("$document", Columns.Id(milestone.DocumentId.Value)),
            ("$paragraph", milestone.Paragraph),
            ("$block", milestone.Block),
            ("$text", milestone.Text),
            ("$lost", Columns.Flag(milestone.Lost)),
            ("$created", Columns.Time(milestone.CreatedAt))));
    }

    public void Delete(MilestoneId id) =>
        database.InTransaction(() => database.Execute("DELETE FROM milestone WHERE id = $id;", ("$id", Columns.Id(id.Value))));

    public IReadOnlyList<ElementId>? Chosen()
    {
        using (var chosen = database.Command("SELECT threads_chosen FROM project LIMIT 1;"))
        {
            if (chosen.ExecuteScalar() is not long flag || flag == 0)
            {
                return null;
            }
        }

        using var command = database.Command("SELECT element_id FROM thread_choice ORDER BY position;");
        using var reader = command.ExecuteReader();
        var elements = new List<ElementId>();
        while (reader.Read())
        {
            elements.Add(new ElementId(reader.GetId(0)));
        }

        return elements;
    }

    public void Choose(IReadOnlyList<ElementId> elements)
    {
        ArgumentNullException.ThrowIfNull(elements);

        database.InTransaction(() =>
        {
            database.Execute("DELETE FROM thread_choice;");
            for (var position = 0; position < elements.Count; position++)
            {
                database.Execute(
                    "INSERT INTO thread_choice (element_id, position) VALUES ($element, $position);",
                    ("$element", Columns.Id(elements[position].Value)),
                    ("$position", position));
            }

            database.Execute("UPDATE project SET threads_chosen = 1;");
        });
    }
}
