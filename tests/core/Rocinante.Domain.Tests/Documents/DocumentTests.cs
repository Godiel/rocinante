using Rocinante.Domain.Content;
using Rocinante.Domain.Documents;
using Rocinante.Domain.Versions;
using static Rocinante.Domain.Tests.Contents;

namespace Rocinante.Domain.Tests.Documents;

public sealed class DocumentTests
{
    private readonly Document _document = Document.Create(DocumentId.New(Moments.Start), Moments.Start);

    [Fact]
    public void A_new_document_is_empty_and_never_edited()
    {
        _document.Content.ShouldBe(DocumentContent.Empty);
        _document.Revision.ShouldBe(0);
        _document.UpdatedAt.ShouldBe(Moments.Start);
        _document.Session.ShouldBe(WritingSession.None);
    }

    [Fact]
    public void Saving_new_text_replaces_it_and_increases_the_revision()
    {
        var text = Paragraphs("En un lugar de la Mancha");

        var result = _document.Save(text, Moments.At(1));

        result.ShouldBe(new SaveResult(Changed: true, Revision: 1, AutomaticVersion: null));
        _document.Content.ShouldBe(text);
        _document.Revision.ShouldBe(1);
        _document.UpdatedAt.ShouldBe(Moments.At(1));
        _document.Session.HasUnversionedChanges.ShouldBeTrue();
    }

    [Fact]
    public void Saving_the_same_text_again_changes_nothing()
    {
        _document.Save(Paragraphs("Igual"), Moments.At(1));

        var result = _document.Save(Paragraphs("Igual"), Moments.At(2));

        result.Changed.ShouldBeFalse();
        result.Revision.ShouldBe(1);
        _document.UpdatedAt.ShouldBe(Moments.At(1));
    }

    [Fact]
    public void Ten_minutes_of_active_writing_save_an_automatic_version()
    {
        SaveEveryMinute(from: 0, to: 9);

        var result = _document.Save(Paragraphs("minuto 10"), Moments.At(10));

        var version = result.AutomaticVersion.ShouldNotBeNull();
        version.Kind.ShouldBe(VersionKind.Automatic);
        version.Name.ShouldBeNull();
        version.DocumentId.ShouldBe(_document.Id);
        version.CreatedAt.ShouldBe(Moments.At(10));
        version.Content.ShouldBe(Paragraphs("minuto 10"));
        _document.Session.ActiveTime.ShouldBe(TimeSpan.Zero);
        _document.Session.HasUnversionedChanges.ShouldBeFalse();
    }

    [Fact]
    public void Nine_minutes_are_not_enough()
    {
        SaveEveryMinute(from: 0, to: 8);

        _document.Save(Paragraphs("minuto 9"), Moments.At(9)).AutomaticVersion.ShouldBeNull();
        _document.Session.ActiveTime.ShouldBe(TimeSpan.FromMinutes(9));
    }

    [Fact]
    public void Pauses_do_not_count_as_writing_time()
    {
        SaveEveryMinute(from: 0, to: 5);

        // An hour away from the desk, then five more minutes of writing.
        var results = Enumerable.Range(65, 5).Select(minute => _document.Save(Paragraphs($"minuto {minute}"), Moments.At(minute))).ToList();

        results.ShouldAllBe(result => result.AutomaticVersion == null);
        _document.Session.ActiveTime.ShouldBe(TimeSpan.FromMinutes(9));
    }

    [Fact]
    public void The_count_starts_again_after_each_automatic_version()
    {
        var versions = Enumerable.Range(0, 21)
            .Select(minute => _document.Save(Paragraphs($"minuto {minute}"), Moments.At(minute)).AutomaticVersion)
            .OfType<DocumentVersion>()
            .ToList();

        versions.Select(version => version.CreatedAt).ShouldBe([Moments.At(10), Moments.At(20)]);
    }

    [Fact]
    public void Without_changes_there_is_no_automatic_version()
    {
        SaveEveryMinute(from: 0, to: 9);
        _document.SaveVersion(name: null, Moments.At(9));

        // Saving the very same text keeps the clock still and creates nothing.
        _document.Save(Paragraphs("minuto 9"), Moments.At(30)).AutomaticVersion.ShouldBeNull();
        _document.Session.HasUnversionedChanges.ShouldBeFalse();
    }

    [Fact]
    public void A_manual_version_captures_the_current_text_with_its_name()
    {
        _document.Save(Paragraphs("Primer borrador"), Moments.At(1));

        var version = _document.SaveVersion("  Antes de la venta  ", Moments.At(2));

        version.Kind.ShouldBe(VersionKind.Manual);
        version.Name.ShouldBe("Antes de la venta");
        version.Content.ShouldBe(Paragraphs("Primer borrador"));
        version.CreatedAt.ShouldBe(Moments.At(2));
        _document.Session.HasUnversionedChanges.ShouldBeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void The_name_of_a_manual_version_is_optional(string? name)
    {
        _document.SaveVersion(name, Moments.At(1)).Name.ShouldBeNull();
    }

    [Fact]
    public void A_version_name_has_a_limit()
    {
        Should.Throw<DomainException>(() => _document.SaveVersion(new string('a', DocumentVersion.MaxNameLength + 1), Moments.At(1)))
            .Error.ShouldBe(DomainError.VersionNameTooLong);
    }

    [Fact]
    public void A_manual_version_resets_the_writing_clock()
    {
        SaveEveryMinute(from: 0, to: 8);
        _document.SaveVersion("Pausa", Moments.At(8));

        _document.Save(Paragraphs("minuto 10"), Moments.At(10)).AutomaticVersion.ShouldBeNull();
    }

    [Fact]
    public void Restoring_brings_back_the_old_text_and_keeps_the_current_one()
    {
        _document.Save(Paragraphs("Versión antigua"), Moments.At(1));
        var old = _document.SaveVersion("Antigua", Moments.At(2));
        _document.Save(Paragraphs("Texto de hoy"), Moments.At(3));

        var before = _document.Restore(old, Moments.At(4)).ShouldNotBeNull();

        _document.Content.ShouldBe(Paragraphs("Versión antigua"));
        _document.Revision.ShouldBe(3);
        _document.UpdatedAt.ShouldBe(Moments.At(4));
        before.Kind.ShouldBe(VersionKind.BeforeRestore);
        before.Content.ShouldBe(Paragraphs("Texto de hoy"));
        before.CreatedAt.ShouldBe(Moments.At(4));
        _document.Session.HasUnversionedChanges.ShouldBeFalse();
    }

    [Fact]
    public void A_restore_can_itself_be_undone()
    {
        _document.Save(Paragraphs("A"), Moments.At(1));
        var a = _document.SaveVersion(name: null, Moments.At(1));
        _document.Save(Paragraphs("B"), Moments.At(2));
        var b = _document.Restore(a, Moments.At(3)).ShouldNotBeNull();

        _document.Restore(b, Moments.At(4));

        _document.Content.ShouldBe(Paragraphs("B"));
    }

    [Fact]
    public void Restoring_the_text_already_there_changes_nothing()
    {
        _document.Save(Paragraphs("Igual"), Moments.At(1));
        var same = _document.SaveVersion(name: null, Moments.At(2));

        _document.Restore(same, Moments.At(3)).ShouldBeNull();
        _document.Revision.ShouldBe(1);
    }

    [Fact]
    public void Versions_of_another_document_cannot_be_restored()
    {
        var other = Document.Create(DocumentId.New(Moments.At(1)), Moments.At(1));
        var foreign = other.SaveVersion(name: null, Moments.At(2));

        Should.Throw<DomainException>(() => _document.Restore(foreign, Moments.At(3)))
            .Error.ShouldBe(DomainError.VersionOfAnotherDocument);
    }

    [Fact]
    public void Rehydrating_keeps_every_value()
    {
        var id = DocumentId.New(Moments.Start);
        var session = new WritingSession(TimeSpan.FromMinutes(4), Moments.At(3), HasUnversionedChanges: true);

        var document = Document.Rehydrate(id, Paragraphs("Texto"), revision: 42, Moments.At(3), session);

        document.Id.ShouldBe(id);
        document.Content.ShouldBe(Paragraphs("Texto"));
        document.Revision.ShouldBe(42);
        document.UpdatedAt.ShouldBe(Moments.At(3));
        document.Session.ShouldBe(session);
    }

    [Fact]
    public void Rehydrated_versions_keep_every_value()
    {
        var id = VersionId.New(Moments.Start);
        var documentId = DocumentId.New(Moments.Start);

        var version = DocumentVersion.Rehydrate(id, documentId, VersionKind.Manual, "Nombre", Moments.At(1), Paragraphs("Texto"));

        version.Id.ShouldBe(id);
        version.DocumentId.ShouldBe(documentId);
        version.Kind.ShouldBe(VersionKind.Manual);
        version.Name.ShouldBe("Nombre");
        version.CreatedAt.ShouldBe(Moments.At(1));
        version.Content.ShouldBe(Paragraphs("Texto"));
    }

    private void SaveEveryMinute(int from, int to)
    {
        for (var minute = from; minute <= to; minute++)
        {
            _document.Save(Paragraphs($"minuto {minute}"), Moments.At(minute)).AutomaticVersion.ShouldBeNull();
        }
    }
}
