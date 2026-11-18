using System.Text.Json.Nodes;

namespace Rocinante.Sidecar.Tests;

/// <summary>
/// Checks that the core honours <c>src/contracts/protocol.json</c>: it accepts what the contract
/// allows, rejects what it forbids, and everything it sends back conforms.
/// </summary>
public sealed class ContractTests : IDisposable
{
    private const int MethodNotFound = -32601;
    private const int InvalidParams = -32602;

    private readonly ServerHarness _harness = new();

    public static TheoryData<string, int> ValidExamples => ContractExamples.Cases("valid");

    public static TheoryData<string, int> InvalidExamples => ContractExamples.Cases("invalid");

    public static TheoryData<string> Methods => [.. ServerHarness.Contract.Methods];

    [Theory]
    [MemberData(nameof(Methods))]
    public void Every_contract_method_is_handled_and_returns_a_conforming_result(string method)
    {
        var response = _harness.Request(method, SampleParams(method));

        response["error"].ShouldBeNull($"{method} failed: {response["error"]?.ToJsonString()}");
        ServerHarness.Contract.ValidateResult(method, response["result"]).ShouldBeNull();
    }

    [Theory]
    [MemberData(nameof(Methods))]
    public void Methods_with_params_have_shared_examples(string method)
    {
        var needsExamples = ServerHarness.Contract.ValidateParams(method, null) is not null;

        if (needsExamples)
        {
            ContractExamples.Exists(method).ShouldBeTrue($"add src/contracts/examples/{method}.json");
            ContractExamples.Valid(method).ShouldNotBeEmpty();
            ContractExamples.Invalid(method).ShouldNotBeEmpty();
        }
    }

    [Theory]
    [MemberData(nameof(ValidExamples))]
    public void Valid_examples_are_accepted(string method, int index)
    {
        var response = _harness.Request(method, ContractExamples.Valid(method)[index]);

        response["error"].ShouldBeNull(response["error"]?.ToJsonString());
    }

    [Theory]
    [MemberData(nameof(InvalidExamples))]
    public void Invalid_examples_are_rejected_with_invalid_params(string method, int index)
    {
        var response = _harness.Request(method, ContractExamples.Invalid(method)[index]);

        ErrorCode(response).ShouldBe(InvalidParams);
    }

    [Fact]
    public void Every_contract_notification_is_emitted_and_conforms()
    {
        foreach (var method in ServerHarness.Contract.Methods)
        {
            _harness.Request(method, SampleParams(method));
        }

        foreach (var notification in _harness.Notifications)
        {
            var name = notification["method"]!.GetValue<string>();
            ServerHarness.Contract.Notifications.ShouldContain(name);
            ServerHarness.Contract.ValidateNotification(name, notification["params"]).ShouldBeNull();
        }

        _harness.Notifications
            .Select(notification => notification["method"]!.GetValue<string>())
            .Distinct()
            .ShouldBe(ServerHarness.Contract.Notifications, ignoreOrder: true);
    }

    [Fact]
    public void System_info_reports_the_protocol_version_of_the_contract_file()
    {
        var expected = JsonNode.Parse(File.ReadAllText(ContractExamples.ProtocolPath))!["protocolVersion"]!
            .GetValue<int>();

        var result = _harness.Request("system.info")["result"]!;

        result["protocolVersion"]!.GetValue<int>().ShouldBe(expected);
    }

    [Fact]
    public void Unknown_methods_are_rejected()
    {
        ErrorCode(_harness.Request("document.burn")).ShouldBe(MethodNotFound);
    }

    [Theory]
    [InlineData("not json", -32700)]
    [InlineData("[1, 2]", -32700)]
    [InlineData("""{"id": 1, "method": "system.ping"}""", -32600)]
    [InlineData("""{"jsonrpc": "2.0", "id": 1, "method": 42}""", -32600)]
    public void Malformed_messages_get_a_json_rpc_error(string line, int expectedCode)
    {
        var response = _harness.SendRaw(line).ShouldHaveSingleItem();

        ErrorCode(response).ShouldBe(expectedCode);
    }

    public void Dispose() => _harness.Dispose();

    private static JsonNode? SampleParams(string method) =>
        ContractExamples.Exists(method) ? ContractExamples.Valid(method)[0] : null;

    private static int ErrorCode(JsonObject response) => response["error"]!["code"]!.GetValue<int>();
}
