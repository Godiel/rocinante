using Microsoft.Data.Sqlite;

namespace Rocinante.Sidecar.Tests;

public sealed class SkeletonDocumentStoreTests : IDisposable
{
    private readonly string _path =
        Path.Combine(Path.GetTempPath(), "rocinante-tests", $"{Guid.NewGuid():N}.rocinante");

    [Fact]
    public void A_new_project_has_no_content_and_revision_zero()
    {
        using var store = SkeletonDocumentStore.Open(_path);

        store.Read().ShouldBe((null, 0L));
    }

    [Fact]
    public void Each_save_increments_the_revision()
    {
        using var store = SkeletonDocumentStore.Open(_path);

        store.Save("""{"type":"doc"}""").ShouldBe(1);
        store.Save("""{"type":"doc","content":[]}""").ShouldBe(2);
        store.Read().ShouldBe(("""{"type":"doc","content":[]}""", 2L));
    }

    [Fact]
    public void Saved_content_survives_reopening_the_project()
    {
        using (var store = SkeletonDocumentStore.Open(_path))
        {
            store.Save("""{"type":"doc"}""");
        }

        using var reopened = SkeletonDocumentStore.Open(_path);
        reopened.Read().ShouldBe(("""{"type":"doc"}""", 1L));
    }

    public void Dispose()
    {
        SqliteConnection.ClearAllPools();
        foreach (var file in new[] { _path, $"{_path}-wal", $"{_path}-shm" })
        {
            File.Delete(file);
        }
    }
}
