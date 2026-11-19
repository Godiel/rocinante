using static Rocinante.Sidecar.Tests.ContractTests;

namespace Rocinante.Sidecar.Tests;

public sealed class DiagnosticsTests : IDisposable
{
    private readonly ServerHarness _harness = new();

    public void Dispose() => _harness.Dispose();

    [Fact]
    public void Problems_seen_by_the_interface_or_the_host_reach_the_log_with_who_saw_them()
    {
        _harness.Call("diagnostics.report", Params(
            ("source", "interface"),
            ("level", "error"),
            ("message", "TypeError: Cannot read properties of undefined"),
            ("detail", "at WritingView (WritingView.tsx:120:14)")));
        _harness.Call("diagnostics.report", Params(("source", "host"), ("level", "warning"), ("message", "core restarted")));

        _harness.Problems.Reports.ShouldBe(
        [
            ("interface", "error", "TypeError: Cannot read properties of undefined", "at WritingView (WritingView.tsx:120:14)"),
            ("host", "warning", "core restarted", null),
        ]);
    }

    [Fact]
    public void A_report_that_breaks_the_contract_is_refused_and_not_logged()
    {
        var response = _harness.Request("diagnostics.report", Params(("source", "browser"), ("level", "error"), ("message", "x")));

        response["error"]!["code"]!.GetValue<int>().ShouldBe(-32602);
        _harness.Problems.Reports.ShouldBeEmpty();
    }
}
