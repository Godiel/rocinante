using Microsoft.Data.Sqlite;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;

namespace Rocinante.Infrastructure.Persistence;

/// <summary>
/// Stores the elements of the work in <c>element</c>, <c>element_alias</c>, <c>element_attribute</c> and
/// <c>element_image</c>, and their relationships in <c>relationship</c> and <c>relationship_kind</c>.
/// </summary>
public sealed class ElementRepository(ProjectDatabase database) : IElementRepository
{
    public ElementBoard LoadBoard()
    {
        var aliases = ReadLists("SELECT element_id, alias FROM element_alias ORDER BY element_id, position;", reader => reader.GetString(1));
        var attributes = ReadLists(
            "SELECT element_id, name, value FROM element_attribute ORDER BY element_id, position;",
            reader => new ElementAttribute(reader.GetString(1), reader.GetString(2)));

        var elements = new List<Element>();
        using (var command = database.Command(
            """
            SELECT e.id, e.kind, e.other_kind, e.name, e.description, e.board_x, e.board_y,
                   e.last_image_version, i.element_id IS NOT NULL, e.created_at, e.deleted_at
            FROM element e LEFT JOIN element_image i ON i.element_id = e.id;
            """))
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                var id = reader.GetId(0);
                elements.Add(Element.Rehydrate(
                    new ElementId(id),
                    reader.GetElementKind(1),
                    reader.GetNullableString(2),
                    reader.GetString(3),
                    aliases.GetValueOrDefault(id, []),
                    attributes.GetValueOrDefault(id, []),
                    DocumentContent.Parse(reader.GetString(4)),
                    new BoardPosition(reader.GetDouble(5), reader.GetDouble(6)),
                    reader.GetInt64(7),
                    reader.GetFlag(8),
                    reader.GetTime(9),
                    reader.GetNullableTime(10)));
            }
        }

        var kinds = new List<RelationshipKind>();
        using (var command = database.Command("SELECT id, forward, inverse FROM relationship_kind ORDER BY id;"))
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                kinds.Add(RelationshipKind.Rehydrate(reader.GetId(0), reader.GetString(1), reader.GetNullableString(2)));
            }
        }

        var relationships = new List<Relationship>();
        using (var command = database.Command("SELECT id, from_id, to_id, kind FROM relationship ORDER BY id;"))
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                relationships.Add(Relationship.Rehydrate(
                    new RelationshipId(reader.GetId(0)),
                    new ElementId(reader.GetId(1)),
                    new ElementId(reader.GetId(2)),
                    RelationshipKindId.Parse(reader.GetString(3))));
            }
        }

        return ElementBoard.Rehydrate(elements, relationships, kinds);
    }

    public void Save(Element element)
    {
        ArgumentNullException.ThrowIfNull(element);

        database.InTransaction(() =>
        {
            var id = Columns.Id(element.Id.Value);
            database.Execute(
                """
                INSERT INTO element (id, kind, other_kind, name, description, board_x, board_y, last_image_version, created_at, deleted_at)
                VALUES ($id, $kind, $otherKind, $name, $description, $x, $y, $lastImageVersion, $createdAt, $deletedAt)
                ON CONFLICT (id) DO UPDATE SET
                    kind = excluded.kind,
                    other_kind = excluded.other_kind,
                    name = excluded.name,
                    description = excluded.description,
                    board_x = excluded.board_x,
                    board_y = excluded.board_y,
                    last_image_version = excluded.last_image_version,
                    deleted_at = excluded.deleted_at;
                """,
                ("$id", id),
                ("$kind", Columns.Kind(element.Kind)),
                ("$otherKind", element.OtherKind),
                ("$name", element.Name),
                ("$description", element.Description.Json),
                ("$x", element.Position.X),
                ("$y", element.Position.Y),
                ("$lastImageVersion", element.LastImageVersion),
                ("$createdAt", Columns.Time(element.CreatedAt)),
                ("$deletedAt", Columns.Time(element.DeletedAt)));

            database.Execute("DELETE FROM element_alias WHERE element_id = $id;", ("$id", id));
            for (var position = 0; position < element.Aliases.Count; position++)
            {
                database.Execute(
                    "INSERT INTO element_alias (element_id, position, alias) VALUES ($id, $position, $alias);",
                    ("$id", id),
                    ("$position", position),
                    ("$alias", element.Aliases[position]));
            }

            database.Execute("DELETE FROM element_attribute WHERE element_id = $id;", ("$id", id));
            for (var position = 0; position < element.Attributes.Count; position++)
            {
                database.Execute(
                    "INSERT INTO element_attribute (element_id, position, name, value) VALUES ($id, $position, $name, $value);",
                    ("$id", id),
                    ("$position", position),
                    ("$name", element.Attributes[position].Name),
                    ("$value", element.Attributes[position].Value));
            }
        });
    }

    public void SavePositions(IEnumerable<Element> elements)
    {
        ArgumentNullException.ThrowIfNull(elements);

        database.InTransaction(() =>
        {
            foreach (var element in elements)
            {
                database.Execute(
                    "UPDATE element SET board_x = $x, board_y = $y WHERE id = $id;",
                    ("$id", Columns.Id(element.Id.Value)),
                    ("$x", element.Position.X),
                    ("$y", element.Position.Y));
            }
        });
    }

    public void SaveImage(Element element, StoredImage image, StoredImage thumbnail)
    {
        ArgumentNullException.ThrowIfNull(element);
        ArgumentNullException.ThrowIfNull(image);
        ArgumentNullException.ThrowIfNull(thumbnail);
        var version = element.ImageVersion
            ?? throw new InvalidOperationException("Give the element a new image version before storing its image.");

        database.InTransaction(() => database.Execute(
            """
            INSERT INTO element_image (element_id, version, image, image_type, thumbnail, thumbnail_type)
            VALUES ($id, $version, $image, $imageType, $thumbnail, $thumbnailType)
            ON CONFLICT (element_id) DO UPDATE SET
                version = excluded.version,
                image = excluded.image,
                image_type = excluded.image_type,
                thumbnail = excluded.thumbnail,
                thumbnail_type = excluded.thumbnail_type;
            """,
            ("$id", Columns.Id(element.Id.Value)),
            ("$version", version),
            ("$image", image.Data.ToArray()),
            ("$imageType", image.MediaType),
            ("$thumbnail", thumbnail.Data.ToArray()),
            ("$thumbnailType", thumbnail.MediaType)));
    }

    public void RemoveImage(ElementId id) =>
        database.InTransaction(() => database.Execute("DELETE FROM element_image WHERE element_id = $id;", ("$id", Columns.Id(id.Value))));

    public StoredImage? LoadImage(ElementId id, ImageSize size)
    {
        var columns = size switch
        {
            ImageSize.Full => "image, image_type",
            ImageSize.Thumbnail => "thumbnail, thumbnail_type",
            _ => throw new ArgumentOutOfRangeException(nameof(size), size, "Unknown image size."),
        };
        using var command = database.Command($"SELECT {columns} FROM element_image WHERE element_id = $id;", ("$id", Columns.Id(id.Value)));
        using var reader = command.ExecuteReader();
        return reader.Read() ? new StoredImage((byte[])reader.GetValue(0), reader.GetString(1)) : null;
    }

    public void Save(RelationshipKind kind)
    {
        ArgumentNullException.ThrowIfNull(kind);

        database.InTransaction(() => database.Execute(
            "INSERT INTO relationship_kind (id, forward, inverse) VALUES ($id, $forward, $inverse) ON CONFLICT (id) DO NOTHING;",
            ("$id", Columns.Id(kind.Id)),
            ("$forward", kind.Forward),
            ("$inverse", kind.Inverse)));
    }

    public IReadOnlySet<string> DismissedNames()
    {
        using var command = database.Command("SELECT name FROM dismissed_name;");
        using var reader = command.ExecuteReader();
        var names = new HashSet<string>(StringComparer.Ordinal);
        while (reader.Read())
        {
            names.Add(reader.GetString(0));
        }

        return names;
    }

    public void Dismiss(string key, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);

        database.InTransaction(() => database.Execute(
            "INSERT INTO dismissed_name (name, dismissed_at) VALUES ($name, $at) ON CONFLICT (name) DO NOTHING;",
            ("$name", key),
            ("$at", Columns.Time(now))));
    }

    public void Save(Relationship relationship)
    {
        ArgumentNullException.ThrowIfNull(relationship);

        database.InTransaction(() => database.Execute(
            """
            INSERT INTO relationship (id, from_id, to_id, kind) VALUES ($id, $from, $to, $kind)
            ON CONFLICT (id) DO UPDATE SET kind = excluded.kind;
            """,
            ("$id", Columns.Id(relationship.Id.Value)),
            ("$from", Columns.Id(relationship.From.Value)),
            ("$to", Columns.Id(relationship.To.Value)),
            ("$kind", relationship.Kind.Value)));
    }

    public void Delete(RelationshipId id) =>
        database.InTransaction(() => database.Execute("DELETE FROM relationship WHERE id = $id;", ("$id", Columns.Id(id.Value))));

    /// <summary>Rows grouped by the element in their first column, in the order the query gives them.</summary>
    private Dictionary<Guid, List<T>> ReadLists<T>(string sql, Func<SqliteDataReader, T> read)
    {
        var lists = new Dictionary<Guid, List<T>>();
        using var command = database.Command(sql);
        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var id = reader.GetId(0);
            if (!lists.TryGetValue(id, out var list))
            {
                lists[id] = list = [];
            }

            list.Add(read(reader));
        }

        return lists;
    }
}
