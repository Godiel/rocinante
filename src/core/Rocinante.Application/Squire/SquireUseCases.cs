using System.Security.Cryptography;
using System.Text;
using Rocinante.Application.Ports;
using Rocinante.Application.Settings;
using Rocinante.Domain;
using Rocinante.Domain.Elements;
using Rocinante.Domain.Squire;

namespace Rocinante.Application.Squire;

/// <summary>How the squire is, as the interface shows it. The key itself never leaves the credential store.</summary>
public sealed record SquireState(
    SquireProvider? Provider,
    string? Model,
    string? Endpoint,
    bool HasKey,
    bool Enabled,
    SquireStatus Status,
    DomainError? Problem,
    int Pending);

public enum SquireStatus
{
    Off,
    Idle,
    Working,
    Problem,
}

/// <summary>What the writer corrected in a proposal before accepting it; null leaves what was proposed.</summary>
public sealed record ProposalCorrection(
    string? Name = null, ElementKind? Kind = null, string? OtherKind = null, string? Forward = null, string? Inverse = null, string? Value = null);

/// <summary>
/// Everything that happens one at a time with the rest of the core: the requests of the windows and what
/// the squire stores when an answer arrives. The squire waits for its provider outside of it.
/// </summary>
public interface IWorkGate
{
    T Run<T>(Func<T> work);
}

/// <summary>Runs the work at once, for the tests and for a core that has only one thread.</summary>
public sealed class ImmediateGate : IWorkGate
{
    public T Run<T>(Func<T> work)
    {
        ArgumentNullException.ThrowIfNull(work);
        return work();
    }
}

/// <summary>
/// The squire: it reads the paragraphs the writer finishes, one at a time in the background, and proposes the
/// fichas, relationships and attributes it finds. Nothing enters the work until the writer accepts it.
/// </summary>
public sealed class SquireUseCases(
    Workspace workspace,
    WriterSettings settings,
    ISecretStore secrets,
    ISquireClient client,
    ElementUseCases elements,
    IChangeNotifier notifier,
    TimeProvider clock,
    IWorkGate gate)
{
    /// <summary>The origin of what the squire announces on its own.</summary>
    public const string Origin = "squire";

    private static readonly TimeSpan _patience = TimeSpan.FromMinutes(2);

    private readonly object _queue = new();
    private readonly Dictionary<string, bool> _keys = [];
    private Task _tail = Task.CompletedTask;
    private SquireStatus _status = SquireStatus.Idle;
    private DomainError? _problem;

    public SquireState State()
    {
        var choice = settings.Squire;
        var provider = choice is null ? (SquireProvider?)null : ProviderOf(choice.Provider);
        var enabled = workspace.IsOpen && workspace.Session.Proposals.SquireEnabled();
        var pending = workspace.IsOpen ? workspace.Session.Proposals.Pending().Count : 0;
        return new SquireState(
            provider,
            choice?.Model,
            choice?.Endpoint,
            provider is { } chosen && HasKey(chosen),
            enabled,
            enabled ? _status : SquireStatus.Off,
            enabled ? _problem : null,
            pending);
    }

    public SquireState Configure(SquireProvider provider, string model, string? endpoint, string origin)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(model);
        settings.ChooseSquire(new SquireChoice(NameOf(provider), model.Trim(), string.IsNullOrWhiteSpace(endpoint) ? null : endpoint.Trim()));
        _problem = null;
        _status = SquireStatus.Idle;
        return Announce(origin);
    }

    public SquireState SetKey(SquireProvider provider, string key, string origin)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(key);
        secrets.Write(NameOf(provider), key.Trim());
        _keys[NameOf(provider)] = true;
        return Announce(origin);
    }

    public SquireState ForgetKey(SquireProvider provider, string origin)
    {
        secrets.Delete(NameOf(provider));
        _keys[NameOf(provider)] = false;
        return Announce(origin);
    }

    /// <summary>Asks the provider something small, to see that the key and the model work.</summary>
    public async Task<DomainError?> TestAsync(CancellationToken cancellation)
    {
        try
        {
            var connection = Connection();
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation);
            timeout.CancelAfter(_patience);
            await client.AskAsync(connection, SquireAsk.Instructions, SquireAsk.Question("Hola.", []), timeout.Token).ConfigureAwait(false);
            return null;
        }
        catch (DomainException exception)
        {
            return exception.Error;
        }
    }

    public Task<IReadOnlyList<string>> ModelsAsync(SquireProvider provider, string? endpoint, CancellationToken cancellation) =>
        client.ModelsAsync(provider, endpoint, cancellation);

    public SquireState Enable(bool enabled, string origin)
    {
        var session = workspace.Session;
        session.InTransaction(() =>
        {
            session.Proposals.SetSquireEnabled(enabled);
            return enabled;
        });
        _problem = null;
        _status = SquireStatus.Idle;
        return Announce(origin);
    }

    /// <summary>
    /// A paragraph the writer just finished. If the squire may read the work and the paragraph changed since it
    /// last read it, it goes to the queue; the answer arrives later as proposals.
    /// </summary>
    public void Analyze(DocumentId documentId, string text, string origin)
    {
        ArgumentNullException.ThrowIfNull(text);
        if (!workspace.IsOpen || string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        workspace.ActiveEntry(documentId);
        var session = workspace.Session;
        var paragraph = Fingerprint(text);
        if (!session.Proposals.SquireEnabled() || settings.Squire is null || session.Proposals.WasRead(documentId, paragraph))
        {
            return;
        }

        lock (_queue)
        {
            _tail = _tail.ContinueWith(_ => ReadAsync(documentId, paragraph, text.Trim()), TaskScheduler.Default).Unwrap();
        }
    }

    /// <summary>Waits until the squire has read everything it was given; for the tests.</summary>
    public Task WhenIdle()
    {
        lock (_queue)
        {
            return _tail;
        }
    }

    public IReadOnlyList<Proposal> Pending() => workspace.Session.Proposals.Pending();

    /// <summary>Makes what a proposal says, as corrected by the writer, as if the writer had done it.</summary>
    public void Accept(ProposalId id, ProposalCorrection? correction, string origin)
    {
        var session = workspace.Session;
        var proposal = session.Proposals.Load(id);
        if (proposal.State != ProposalState.Pending)
        {
            throw new DomainException(DomainError.ProposalNotFound, $"Proposal {id} is no longer waiting.");
        }

        var fix = correction ?? new ProposalCorrection();
        switch (proposal.Kind)
        {
            case ProposalKind.Element:
                var element = proposal.Element!;
                var kind = fix.Kind ?? element.Kind;
                elements.Create(kind, kind == ElementKind.Other ? fix.OtherKind ?? element.OtherKind ?? "Otro" : null, fix.Name ?? element.Name, null, null, origin);
                break;
            case ProposalKind.Relationship:
                var relationship = proposal.Relationship!;
                elements.Relate(
                    Named(relationship.From),
                    Named(relationship.To),
                    RelationshipKindChoice.New(fix.Forward ?? relationship.Forward, fix.Forward is null ? relationship.Inverse : fix.Inverse),
                    origin);
                break;
            default:
                var detail = proposal.Attribute!;
                var target = workspace.Board.InWork(Named(detail.Element));
                var value = fix.Value ?? detail.Value;
                var attributes = target.Attributes.Any(attribute => MentionFinder.Key(attribute.Name) == MentionFinder.Key(detail.Name))
                    ? [.. target.Attributes.Select(attribute => MentionFinder.Key(attribute.Name) == MentionFinder.Key(detail.Name)
                        ? new ElementAttribute(attribute.Name, value)
                        : attribute)]
                    : (IReadOnlyList<ElementAttribute>)[.. target.Attributes, new ElementAttribute(detail.Name, value)];
                elements.Update(target.Id, new ElementUpdate(Attributes: attributes), origin);
                break;
        }

        Decide(proposal, accepted: true, origin);
    }

    public void Dismiss(ProposalId id, string origin) => Decide(workspace.Session.Proposals.Load(id), accepted: false, origin);

    private void Decide(Proposal proposal, bool accepted, string origin)
    {
        if (accepted)
        {
            proposal.Accept();
        }
        else
        {
            proposal.Dismiss();
        }

        var session = workspace.Session;
        session.InTransaction(() =>
        {
            session.Proposals.Save(proposal);
            return proposal;
        });
        notifier.SquireChanged(State(), [], [proposal.Id], origin);
    }

    /// <summary>The element in the work with this name or alias.</summary>
    private ElementId Named(string name)
    {
        var key = MentionFinder.Key(name);
        return workspace.Board.Elements
            .FirstOrDefault(element => MentionFinder.Key(element.Name) == key || element.Aliases.Any(alias => MentionFinder.Key(alias) == key))
            ?.Id ?? throw new DomainException(DomainError.ProposalElementMissing, "The proposal names an element the work does not have.");
    }

    private async Task ReadAsync(DocumentId documentId, string paragraph, string text)
    {
        // What to ask is read with the rest of the core; the provider is waited for outside of it.
        var asked = gate.Run(() =>
        {
            if (!workspace.IsOpen || !workspace.Session.Proposals.SquireEnabled())
            {
                return null;
            }

            _status = SquireStatus.Working;
            notifier.SquireChanged(State(), [], [], Origin);
            return new { Connection = TryConnection(), Question = SquireAsk.Question(text, workspace.Board.Elements), Session = workspace.Session };
        });
        if (asked is null)
        {
            return;
        }

        SquireReading reading;
        try
        {
            if (asked.Connection is not { } connection)
            {
                throw new DomainException(_problem ?? DomainError.SquireNotConfigured, "The squire cannot reach a provider.");
            }

            using var timeout = new CancellationTokenSource(_patience);
            var answer = await client.AskAsync(connection, SquireAsk.Instructions, asked.Question, timeout.Token).ConfigureAwait(false);
            reading = SquireAsk.Read(answer);
        }
        catch (DomainException exception)
        {
            gate.Run(() =>
            {
                _status = SquireStatus.Problem;
                _problem = exception.Error;
                if (workspace.IsOpen)
                {
                    notifier.SquireChanged(State(), [], [], Origin);
                }

                return 0;
            });
            return;
        }

        gate.Run(() =>
        {
            // The work may have closed, or another opened, while the provider answered.
            if (!workspace.IsOpen || !ReferenceEquals(workspace.Session, asked.Session))
            {
                return 0;
            }

            var proposals = Propose(documentId, paragraph, text, reading);
            _status = SquireStatus.Idle;
            _problem = null;
            notifier.SquireChanged(State(), proposals, [], Origin);
            return 0;
        });
    }

    /// <summary>Keeps what is new: not a ficha of the work already, nor proposed or dismissed for this paragraph.</summary>
    private List<Proposal> Propose(DocumentId documentId, string paragraph, string text, SquireReading reading)
    {
        var session = workspace.Session;
        var known = session.Proposals.KeysOf(documentId, paragraph).ToHashSet(StringComparer.Ordinal);
        var names = workspace.Board.Elements
            .SelectMany(element => element.Aliases.Prepend(element.Name))
            .Select(MentionFinder.Key)
            .ToHashSet(StringComparer.Ordinal);
        var now = clock.GetUtcNow();
        var made = new List<Proposal>();

        void Keep(Func<Proposal> make)
        {
            try
            {
                var proposal = make();
                if (known.Add(proposal.Key))
                {
                    made.Add(proposal);
                }
            }
            catch (DomainException)
            {
                // What does not make sense is left out.
            }
        }

        foreach (var element in reading.Elements.Where(element => !names.Contains(MentionFinder.Key(element.Name))))
        {
            Keep(() => Proposal.ForElement(documentId, paragraph, text, element, now));
        }

        foreach (var relationship in reading.Relationships)
        {
            Keep(() => Proposal.ForRelationship(documentId, paragraph, text, relationship, now));
        }

        foreach (var detail in reading.Details)
        {
            Keep(() => Proposal.ForAttribute(documentId, paragraph, text, detail, now));
        }

        session.InTransaction(() =>
        {
            foreach (var proposal in made)
            {
                session.Proposals.Save(proposal);
            }

            session.Proposals.MarkRead(documentId, paragraph, now);
            return made.Count;
        });
        return made;
    }

    private SquireState Announce(string origin)
    {
        var state = State();
        notifier.SquireChanged(state, [], [], origin);
        return state;
    }

    private SquireConnection Connection()
    {
        var choice = settings.Squire ?? throw new DomainException(DomainError.SquireNotConfigured, "The squire has no provider yet.");
        var provider = ProviderOf(choice.Provider);
        var key = provider == SquireProvider.Ollama ? null : secrets.Read(NameOf(provider));
        if (provider is not SquireProvider.Ollama and not SquireProvider.Compatible && string.IsNullOrEmpty(key))
        {
            throw new DomainException(DomainError.SquireKeyMissing, "The provider has no key.");
        }

        return new SquireConnection(provider, choice.Model, choice.Endpoint, key);
    }

    private SquireConnection? TryConnection()
    {
        try
        {
            return Connection();
        }
        catch (DomainException exception)
        {
            _problem = exception.Error;
            return null;
        }
    }

    private bool HasKey(SquireProvider provider)
    {
        if (provider is SquireProvider.Ollama)
        {
            return true;
        }

        var name = NameOf(provider);
        if (!_keys.TryGetValue(name, out var has))
        {
            try
            {
                has = !string.IsNullOrEmpty(secrets.Read(name));
            }
            catch (DomainException)
            {
                has = false;
            }

            _keys[name] = has;
        }

        return has;
    }

    /// <summary>The fingerprint of a paragraph: the same words give the same one.</summary>
    public static string Fingerprint(string text) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(text.Trim())));

    public static string NameOf(SquireProvider provider) => provider switch
    {
        SquireProvider.Anthropic => "anthropic",
        SquireProvider.OpenAI => "openai",
        SquireProvider.Gemini => "gemini",
        SquireProvider.XAI => "xai",
        SquireProvider.Compatible => "compatible",
        _ => "ollama",
    };

    public static SquireProvider ProviderOf(string name) => name switch
    {
        "anthropic" => SquireProvider.Anthropic,
        "openai" => SquireProvider.OpenAI,
        "gemini" => SquireProvider.Gemini,
        "xai" => SquireProvider.XAI,
        "compatible" => SquireProvider.Compatible,
        _ => SquireProvider.Ollama,
    };
}
