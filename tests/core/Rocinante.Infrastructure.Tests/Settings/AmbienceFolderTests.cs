using Rocinante.Application.Ports;
using Rocinante.Infrastructure.Settings;

namespace Rocinante.Infrastructure.Tests.Settings;

public sealed class AmbienceFolderTests : IDisposable
{
    private readonly TempFolder _folder = new();

    public void Dispose() => _folder.Dispose();

    private AmbienceFolder Folder() => new(_folder.Path);

    [Fact]
    public void A_copy_lands_whole_in_the_ambience_folder_and_nothing_else_is_left()
    {
        var source = _folder.File("molinos.png");
        File.WriteAllBytes(source, [1, 2, 3, 4, 5]);

        Folder().Copy(source, "copia.png");

        File.ReadAllBytes(Folder().PathOf("copia.png")).ShouldBe([1, 2, 3, 4, 5]);
        Folder().Files().ShouldBe(["copia.png"]);
        File.Exists(source).ShouldBeTrue();
    }

    [Fact]
    public void A_sample_has_the_size_and_the_first_bytes()
    {
        var source = _folder.File("lluvia.ogg");
        File.WriteAllBytes(source, [.. "OggS"u8, 9, 9, 9]);

        var sample = Folder().Sample(source, 4);

        sample.Length.ShouldBe(7);
        sample.Head.ShouldBe("OggS"u8.ToArray());
        Folder().Sample(source, 100).Head.Length.ShouldBe(7);
    }

    [Fact]
    public void A_missing_file_is_not_found()
    {
        Should.Throw<ProjectFileException>(() => Folder().Sample(_folder.File("no-existe.ogg"), 12)).Error.ShouldBe(ProjectFileError.NotFound);
        Should.Throw<ProjectFileException>(() => Folder().Copy(_folder.File("no-existe.ogg"), "x.ogg")).Error.ShouldBe(ProjectFileError.NotFound);
    }

    [Fact]
    public void Without_the_folder_there_are_no_files_and_deleting_does_nothing()
    {
        Folder().Files().ShouldBeEmpty();
        Should.NotThrow(() => Folder().Delete("nada.png"));
    }

    [Theory]
    [InlineData("../settings.json")]
    [InlineData("sub/fondo.png")]
    [InlineData("..")]
    [InlineData("")]
    public void A_name_can_never_leave_the_folder(string name)
    {
        Should.Throw<ArgumentException>(() => Folder().PathOf(name));
        Should.Throw<ArgumentException>(() => Folder().Delete(name));
    }
}
