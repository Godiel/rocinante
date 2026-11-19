namespace Rocinante.Sidecar.Tests;

public sealed class CommandLineTests
{
    [Fact]
    public void No_arguments_is_a_plain_start()
    {
        CommandLine.Parse([]).ShouldBe(new CommandLine(null, null));
    }

    [Fact]
    public void Reads_the_data_folder_and_the_file_to_open_in_any_order()
    {
        CommandLine.Parse(["--open", "C:/Obras/Don Quijote.rocinante", "--data-dir", "C:/Datos"])
            .ShouldBe(new CommandLine("C:/Datos", "C:/Obras/Don Quijote.rocinante"));
    }

    [Theory]
    [InlineData("--data-dir")]
    [InlineData("--verbose")]
    [InlineData("obra.rocinante")]
    public void Anything_else_is_refused(string argument)
    {
        CommandLine.Parse([argument]).ShouldBeNull();
    }
}
