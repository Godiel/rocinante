using static Rocinante.Sidecar.Tests.ContractTests;

namespace Rocinante.Sidecar.Tests;

public sealed class StartupTests : IDisposable
{
    private readonly List<ServerHarness> _harnesses = [];

    // Newest first: a later core may hold a file that lives in an earlier harness folder.
    public void Dispose() => Enumerable.Reverse(_harnesses).ToList().ForEach(harness => harness.Dispose());

    [Fact]
    public void The_file_the_app_was_launched_with_opens_in_the_first_window()
    {
        var first = Harness();
        var path = first.PathOf("Don Quijote.rocinante");
        first.Call("project.create", Params(("path", path), ("title", "Don Quijote"), ("origin", "main")));
        first.Call("project.close", Params(("origin", "main")));

        var start = Harness(launchFile: path).Call("app.start", Params(("origin", "main")))!;

        start["project"]!["title"]!.GetValue<string>().ShouldBe("Don Quijote");
        start["problem"].ShouldBeNull();
        start["defaultFolder"]!.GetValue<string>().ShouldEndWith("Rocinante");
    }

    [Fact]
    public void A_launch_file_that_is_not_a_project_comes_back_as_a_problem_with_its_reason()
    {
        var harness = Harness();
        var path = harness.PathOf("carta.rocinante");
        File.WriteAllText(path, "Querido Sancho:");

        var start = Harness(launchFile: path).Call("app.start", Params(("origin", "main")))!;

        start["project"].ShouldBeNull();
        start["problem"]!["reason"]!.GetValue<string>().ShouldBe("notAProject");
        ServerHarness.Contract.ValidateDefinition("StartState", start).ShouldBeNull();
        File.ReadAllText(path).ShouldBe("Querido Sancho:");
    }

    private ServerHarness Harness(string? launchFile = null)
    {
        var harness = new ServerHarness(launchFile);
        _harnesses.Add(harness);
        return harness;
    }

}
