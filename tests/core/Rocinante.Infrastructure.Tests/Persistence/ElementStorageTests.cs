using System.Globalization;
using System.Text.Json.Nodes;
using Microsoft.Data.Sqlite;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Domain.Content;
using Rocinante.Domain.Elements;
using Rocinante.Infrastructure.Persistence;

namespace Rocinante.Infrastructure.Tests.Persistence;

public sealed class ElementStorageTests : IDisposable
{
    private static readonly RelationshipKindId _childOf = RelationshipKindId.Builtin("child-of");
    private static readonly StoredImage _portrait = new(new byte[] { 0x52, 0x49, 0x46, 0x46, 1, 2, 3 }, "image/webp");
    private static readonly StoredImage _thumbnail = new(new byte[] { 0xFF, 0xD8, 0xFF, 4 }, "image/jpeg");

    private readonly ProjectFixture _fixture = new();

    public void Dispose() => _fixture.Dispose();

    private ElementRepository Repository => new(_fixture.Database);

    private static DocumentContent Description(string text) =>
        DocumentContent.Parse(new JsonObject
        {
            ["type"] = "doc",
            ["content"] = new JsonArray(new JsonObject
            {
                ["type"] = "paragraph",
                ["content"] = new JsonArray(new JsonObject { ["type"] = "text", ["text"] = text }),
            }),
        }.ToJsonString());

    [Fact]
    public void A_new_work_has_no_elements()
    {
        var board = Repository.LoadBoard();

        board.Elements.ShouldBeEmpty();
        board.Trash.ShouldBeEmpty();
        board.Relationships.ShouldBeEmpty();
        board.OwnKinds.ShouldBeEmpty();
    }

    [Fact]
    public void Elements_relationships_and_own_kinds_survive_closing_the_file()
    {
        var board = new ElementBoard();
        var quixote = board.Create(
            ElementKind.Character, null, "Alonso Quijano",
            [new ElementAttribute("Edad", "Cincuenta años"), new ElementAttribute("Carácter", "")],
            new BoardPosition(-120.5, 40), Moments.Start);
        quixote.SetAliases(["Don Quijote", "el Caballero de la Triste Figura"]);
        quixote.Describe(Description("Hidalgo de lanza en astillero."));
        var helmet = board.Create(ElementKind.Other, "Objeto", "Yelmo de Mambrino", null, null, Moments.At(1));
        var sancho = board.Create(ElementKind.Character, null, "Sancho Panza", null, null, Moments.At(2));
        var squire = board.OwnKind("escudero de", "señor de", Moments.At(3));
        var service = board.Relate(sancho.Id, quixote.Id, squire.KindId, Moments.At(3));
        var son = board.Relate(helmet.Id, quixote.Id, _childOf, Moments.At(4));
        board.Delete(helmet.Id, Moments.At(5));

        var repository = Repository;
        foreach (var element in new[] { quixote, helmet, sancho })
        {
            repository.Save(element);
        }

        repository.Save(squire);
        repository.Save(service);
        repository.Save(son);

        var reopened = new ElementRepository(_fixture.Reopen()).LoadBoard();

        var loaded = reopened.Find(quixote.Id);
        loaded.Name.ShouldBe("Alonso Quijano");
        loaded.Kind.ShouldBe(ElementKind.Character);
        loaded.Aliases.ShouldBe(["Don Quijote", "el Caballero de la Triste Figura"]);
        loaded.Attributes.ShouldBe([new ElementAttribute("Edad", "Cincuenta años"), new ElementAttribute("Carácter", "")]);
        loaded.Description.ShouldBe(Description("Hidalgo de lanza en astillero."));
        loaded.Position.ShouldBe(new BoardPosition(-120.5, 40));
        loaded.CreatedAt.ShouldBe(Moments.Start);
        loaded.ImageVersion.ShouldBeNull();

        var trashed = reopened.Trash.ShouldHaveSingleItem();
        trashed.Id.ShouldBe(helmet.Id);
        trashed.OtherKind.ShouldBe("Objeto");
        trashed.DeletedAt.ShouldBe(Moments.At(5));

        reopened.OwnKinds.ShouldHaveSingleItem().ShouldBe(squire);
        var shown = reopened.Relationships.ShouldHaveSingleItem();
        (shown.Id, shown.From, shown.To, shown.Kind).ShouldBe((service.Id, sancho.Id, quixote.Id, squire.KindId));

        reopened.Restore(helmet.Id);
        reopened.Relationships.Select(relationship => relationship.Id).ShouldBe([service.Id, son.Id], ignoreOrder: true);
    }

    [Fact]
    public void Saving_again_replaces_the_aliases_and_attributes_and_keeps_their_order()
    {
        var element = new ElementBoard().Create(ElementKind.Place, null, "La Mancha", [new ElementAttribute("Situación", "")], null, Moments.Start);
        element.SetAliases(["la Mancha", "Campo de Montiel"]);
        Repository.Save(element);

        element.SetAliases(["Campo de Montiel"]);
        element.SetAttributes([new ElementAttribute("Aspecto", "Llanura"), new ElementAttribute("Situación", "Castilla")]);
        element.ChangeKind(ElementKind.Other, "Región");
        Repository.Save(element);

        var loaded = new ElementRepository(_fixture.Reopen()).LoadBoard().Find(element.Id);
        loaded.Aliases.ShouldBe(["Campo de Montiel"]);
        loaded.Attributes.Select(attribute => attribute.Name).ShouldBe(["Aspecto", "Situación"]);
        loaded.OtherKind.ShouldBe("Región");
    }

    [Fact]
    public void Moving_cards_stores_only_their_places()
    {
        var board = new ElementBoard();
        var quixote = board.Create(ElementKind.Character, null, "Don Quijote", null, null, Moments.Start);
        Repository.Save(quixote);

        quixote.Rename("Nombre que no se guarda");
        board.Move([(quixote.Id, new BoardPosition(500, -250))]);
        Repository.SavePositions([quixote]);

        var loaded = new ElementRepository(_fixture.Reopen()).LoadBoard().Find(quixote.Id);
        loaded.Position.ShouldBe(new BoardPosition(500, -250));
        loaded.Name.ShouldBe("Don Quijote");
    }

    [Fact]
    public void An_image_and_its_thumbnail_are_stored_in_the_file_and_a_removed_one_never_repeats_its_version()
    {
        var element = new ElementBoard().Create(ElementKind.Character, null, "Dulcinea", null, null, Moments.Start);
        element.ReplaceImage(Moments.At(1));
        var repository = Repository;
        repository.Save(element);
        repository.SaveImage(element, _portrait, _thumbnail);
        var first = element.ImageVersion!.Value;

        var reopened = new ElementRepository(_fixture.Reopen());
        reopened.LoadBoard().Find(element.Id).ImageVersion.ShouldBe(first);
        var full = reopened.LoadImage(element.Id, ImageSize.Full).ShouldNotBeNull();
        full.Data.ToArray().ShouldBe(_portrait.Data.ToArray());
        full.MediaType.ShouldBe("image/webp");
        var small = reopened.LoadImage(element.Id, ImageSize.Thumbnail).ShouldNotBeNull();
        small.Data.ToArray().ShouldBe(_thumbnail.Data.ToArray());
        small.MediaType.ShouldBe("image/jpeg");

        element.RemoveImage();
        reopened.Save(element);
        reopened.RemoveImage(element.Id);

        var afterRemoving = new ElementRepository(_fixture.Reopen());
        var loaded = afterRemoving.LoadBoard().Find(element.Id);
        loaded.ImageVersion.ShouldBeNull();
        afterRemoving.LoadImage(element.Id, ImageSize.Full).ShouldBeNull();
        loaded.ReplaceImage(Moments.At(1));
        loaded.ImageVersion!.Value.ShouldBeGreaterThan(first);
    }

    [Fact]
    public void An_image_needs_a_version_before_it_is_stored()
    {
        var element = new ElementBoard().Create(ElementKind.Character, null, "Dulcinea", null, null, Moments.Start);
        Repository.Save(element);

        Should.Throw<InvalidOperationException>(() => Repository.SaveImage(element, _portrait, _thumbnail));
    }

    [Fact]
    public void A_relationship_can_change_its_kind_and_be_taken_away()
    {
        var board = new ElementBoard();
        var antonio = board.Create(ElementKind.Character, null, "Antonio", null, null, Moments.Start);
        var claudio = board.Create(ElementKind.Character, null, "Claudio", null, null, Moments.Start);
        var son = board.Relate(claudio.Id, antonio.Id, _childOf, Moments.Start);
        var repository = Repository;
        repository.Save(antonio);
        repository.Save(claudio);
        repository.Save(son);

        board.ChangeKind(son.Id, RelationshipKindId.Builtin("friend-of"));
        repository.Save(son);
        new ElementRepository(_fixture.Reopen()).LoadBoard().Relationships.ShouldHaveSingleItem().Kind.ShouldBe(RelationshipKindId.Builtin("friend-of"));

        new ElementRepository(_fixture.Database).Delete(son.Id);
        new ElementRepository(_fixture.Reopen()).LoadBoard().Relationships.ShouldBeEmpty();
    }

    [Fact]
    public void Storing_the_same_own_kind_twice_changes_nothing()
    {
        var kind = new ElementBoard().OwnKind("rival de", null, Moments.Start);

        Repository.Save(kind);
        Repository.Save(kind);

        Repository.LoadBoard().OwnKinds.ShouldHaveSingleItem().IsSymmetric.ShouldBeTrue();
    }

    [Fact]
    public void A_change_cut_short_leaves_nothing_half_written()
    {
        var element = new ElementBoard().Create(ElementKind.Character, null, "Rocinante", null, null, Moments.Start);
        element.SetAliases(["el rocín"]);

        Should.Throw<InvalidOperationException>(() => _fixture.Database.InTransaction(() =>
        {
            Repository.Save(element);
            throw new InvalidOperationException("The power went out.");
        }));

        new ElementRepository(_fixture.Reopen()).LoadBoard().Elements.ShouldBeEmpty();
    }

    [Fact]
    public void A_copy_of_the_work_takes_its_elements_and_images()
    {
        var board = new ElementBoard();
        var quixote = board.Create(ElementKind.Character, null, "Don Quijote", null, null, Moments.Start);
        quixote.ReplaceImage(Moments.At(1));
        Repository.Save(quixote);
        Repository.SaveImage(quixote, _portrait, _thumbnail);

        using var folder = new TempFolder();
        var copyPath = folder.File("copia.rocinante");
        _fixture.Database.SaveCopyAs(copyPath);

        using var copy = ProjectDatabase.Open(copyPath);
        var repository = new ElementRepository(copy);
        repository.LoadBoard().Elements.ShouldHaveSingleItem().Name.ShouldBe("Don Quijote");
        repository.LoadImage(quixote.Id, ImageSize.Thumbnail).ShouldNotBeNull().Data.ToArray().ShouldBe(_thumbnail.Data.ToArray());
    }

    [Theory]
    [InlineData("INSERT INTO element (id, kind, other_kind, name, description, board_x, board_y, created_at) VALUES ('a', 'other', NULL, 'x', '{}', 0, 0, 0);")]
    [InlineData("INSERT INTO element (id, kind, other_kind, name, description, board_x, board_y, created_at) VALUES ('a', 'villain', NULL, 'x', '{}', 0, 0, 0);")]
    [InlineData("INSERT INTO element (id, kind, other_kind, name, description, board_x, board_y, created_at) VALUES ('a', 'place', NULL, '', '{}', 0, 0, 0);")]
    [InlineData("INSERT INTO element (id, kind, other_kind, name, description, board_x, board_y, created_at) VALUES ('a', 'place', NULL, 'x', '{}', 2000000, 0, 0);")]
    [InlineData("INSERT INTO relationship (id, from_id, to_id, kind) VALUES ('r', 'nadie', 'nadie', 'builtin:child-of');")]
    [InlineData("INSERT INTO relationship_kind (id, forward, inverse) VALUES ('k', 'hijo de', '');")]
    public void The_file_itself_refuses_impossible_elements(string insert)
    {
        Should.Throw<SqliteException>(() => _fixture.Database.Execute(insert));
    }

    [Fact]
    public void A_work_written_with_schema_version_2_opens_ready_for_elements_and_nothing_lost()
    {
        using var folder = new TempFolder();
        var path = folder.File("segunda.rocinante");
        using (var connection = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, Pooling = false }.ToString()))
        {
            connection.Open();
            using var command = connection.CreateCommand();
            command.CommandText = string.Create(
                CultureInfo.InvariantCulture,
                $$"""
                PRAGMA application_id = {{ProjectDatabase.ApplicationId}};
                {{Migrations.All[0].Sql}}
                {{Migrations.All[1].Sql}}
                INSERT INTO meta (key, value) VALUES ('schema_version', '2');
                INSERT INTO project (id, title, created_at) VALUES ('0196a3b2-7c4d-7e8f-9a0b-1c2d3e4f5a6b', 'Escrita con la 002', 0);
                """);
            command.ExecuteNonQuery();
        }

        using var database = ProjectDatabase.Open(path);

        database.ReadSchemaVersion().ShouldBe(Migrations.Latest);
        new ProjectRepository(database).Load().Title.ShouldBe("Escrita con la 002");
        var repository = new ElementRepository(database);
        repository.LoadBoard().Elements.ShouldBeEmpty();
        repository.Save(new ElementBoard().Create(ElementKind.Plot, null, "La venta", null, null, Moments.Start));
        repository.LoadBoard().Elements.ShouldHaveSingleItem().Kind.ShouldBe(ElementKind.Plot);
    }
}
