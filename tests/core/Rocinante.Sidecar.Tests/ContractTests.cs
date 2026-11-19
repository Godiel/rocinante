using System.Text.Json.Nodes;
using Rocinante.Application.Ports;
using Rocinante.Domain;
using Rocinante.Infrastructure.Persistence;

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

    public void Dispose() => _harness.Dispose();

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
    public void Valid_examples_conform_to_the_contract(string method, int index)
    {
        ServerHarness.Contract.ValidateParams(method, ContractExamples.Valid(method)[index]).ShouldBeNull();
    }

    [Theory]
    [MemberData(nameof(InvalidExamples))]
    public void Invalid_examples_are_rejected_with_invalid_params(string method, int index)
    {
        var response = _harness.Request(method, ContractExamples.Invalid(method)[index]);

        ErrorCode(response).ShouldBe(InvalidParams);
    }

    [Fact]
    public void A_full_writing_session_uses_every_method_and_notification_and_all_of_it_conforms()
    {
        new WritingSession(_harness).Run();

        foreach (var (method, response) in _harness.Responses)
        {
            response["error"].ShouldBeNull($"{method} failed: {response["error"]?.ToJsonString()}");
            ServerHarness.Contract.ValidateResult(method, response["result"]).ShouldBeNull($"result of {method}");
        }

        foreach (var notification in _harness.Notifications)
        {
            var name = notification["method"]!.GetValue<string>();
            ServerHarness.Contract.Notifications.ShouldContain(name);
            ServerHarness.Contract.ValidateNotification(name, notification["params"]).ShouldBeNull($"notification {name}");
        }

        _harness.Responses.Select(pair => pair.Method).Distinct().ShouldBe(ServerHarness.Contract.Methods, ignoreOrder: true);
        _harness.Notifications.Select(message => message["method"]!.GetValue<string>()).Distinct()
            .ShouldBe(ServerHarness.Contract.Notifications, ignoreOrder: true);
    }

    [Fact]
    public void Every_error_reason_the_core_can_give_is_in_the_contract()
    {
        var reasons = Contract()["$defs"]!["ErrorReason"]!["enum"]!.AsArray().Select(node => node!.GetValue<string>()).ToList();

        var produced = Enum.GetNames<DomainError>()
            .Concat(Enum.GetNames<ProjectFileError>())
            .Select(JsonRpcServer.Reason)
            .Append("projectNotOpen")
            .ToList();

        reasons.ShouldBe(produced, ignoreOrder: true);
    }

    [Theory]
    [InlineData("project.get", null, -32001, "projectNotOpen")]
    [InlineData("project.open", """{ "path": "no-existe.rocinante", "origin": "main" }""", -32003, "notFound")]
    public void Expected_failures_carry_a_code_and_a_reason(string method, string? parameters, int code, string reason)
    {
        var response = _harness.Request(method, parameters is null ? null : JsonNode.Parse(parameters));

        AssertError(response, code, reason);
    }

    [Fact]
    public void Broken_rules_are_reported_as_rule_violations()
    {
        _harness.Call("project.create", Params(("path", _harness.PathOf("obra.rocinante")), ("title", "Obra"), ("origin", "main")));

        var response = _harness.Request("project.rename", Params(("title", "   "), ("origin", "main")));

        AssertError(response, -32002, "titleRequired");
    }

    [Fact]
    public void A_file_that_is_not_a_project_is_reported_and_left_alone()
    {
        var path = _harness.PathOf("carta.rocinante");
        File.WriteAllText(path, "Querido Sancho:");

        AssertError(_harness.Request("project.open", Params(("path", path), ("origin", "main"))), -32003, "notAProject");
        File.ReadAllText(path).ShouldBe("Querido Sancho:");
    }

    [Fact]
    public void System_info_reports_the_protocol_version_of_the_contract_file()
    {
        var expected = Contract()["protocolVersion"]!.GetValue<int>();

        _harness.Call("system.info")!["protocolVersion"]!.GetValue<int>().ShouldBe(expected);
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

    internal static JsonObject Params(params (string Name, JsonNode? Value)[] values)
    {
        var parameters = new JsonObject();
        foreach (var (name, value) in values)
        {
            parameters[name] = value;
        }

        return parameters;
    }

    private static void AssertError(JsonObject response, int code, string reason)
    {
        ErrorCode(response).ShouldBe(code);
        var data = response["error"]!["data"];
        ServerHarness.Contract.ValidateDefinition("ErrorData", data).ShouldBeNull();
        data!["reason"]!.GetValue<string>().ShouldBe(reason);
    }

    private static JsonObject Contract() => JsonNode.Parse(File.ReadAllText(ContractExamples.ProtocolPath))!.AsObject();

    private static int ErrorCode(JsonObject response) => response["error"]!["code"]!.GetValue<int>();
}
