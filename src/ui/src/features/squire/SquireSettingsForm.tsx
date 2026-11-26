import { useEffect, useId, useState } from "react";
import { CoreError, request } from "../../bridge/core";
import type { SquireProvider, SquireSettings } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { OLLAMA_HELP, PROVIDERS, consentNotice, providerInfo } from "./providers";

export interface SquireSettingsFormProps {
  settings: SquireSettings;
  origin: string;
  onProblem(message: string | null): void;
}

interface Draft {
  provider: SquireProvider | "";
  model: string;
  endpoint: string;
}

function draftOf(settings: SquireSettings): Draft {
  return {
    provider: settings.provider ?? "",
    model: settings.model ?? "",
    endpoint: settings.endpoint ?? "",
  };
}

/**
 * The settings of the squire: the provider, its model and address, the writer's key, kept in the system's
 * store and never shown again, a test of the connection and the switch that lets it read this work.
 */
export function SquireSettingsForm({ settings, origin, onProblem }: SquireSettingsFormProps) {
  const id = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings));
  const [key, setKey] = useState("");
  const [models, setModels] = useState<{ provider: string; list: readonly string[] }>({
    provider: "",
    list: [],
  });
  const [ollamaMissing, setOllamaMissing] = useState(false);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const info = draft.provider ? providerInfo(draft.provider) : null;
  const saved = draftOf(settings);
  const dirty =
    draft.provider !== saved.provider ||
    draft.model.trim() !== saved.model ||
    draft.endpoint.trim() !== saved.endpoint;
  const complete =
    info !== null &&
    draft.model.trim() !== "" &&
    (info.endpoint !== "required" || draft.endpoint.trim() !== "");
  const configured = settings.provider !== null && settings.model !== null;
  const keyShown = info?.needsKey && draft.provider === settings.provider;

  // Ollama says which models the writer has; if it does not answer, the writer is told how to start it.
  const endpoint = draft.endpoint.trim();
  useEffect(() => {
    if (draft.provider !== "ollama") return;
    let current = true;
    const timer = setTimeout(() => {
      request("squire.models", { provider: "ollama", endpoint: endpoint || null }).then(
        (list) => {
          if (!current) return;
          setOllamaMissing(false);
          setModels({ provider: "ollama", list });
        },
        () => {
          if (current) setOllamaMissing(true);
        },
      );
    }, 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [draft.provider, endpoint]);

  const suggestions =
    draft.provider === "ollama"
      ? models.provider === "ollama"
        ? models.list
        : []
      : (info?.models ?? []);

  async function run<T>(work: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    onProblem(null);
    try {
      return await work();
    } catch (error) {
      onProblem(messageFor(error));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const configure = () =>
    request("squire.configure", {
      provider: draft.provider as SquireProvider,
      model: draft.model.trim(),
      endpoint: info?.endpoint ? endpoint || null : null,
      origin,
    });

  async function save() {
    setTest(null);
    await run(configure);
  }

  async function saveKey() {
    if (!draft.provider || key.trim() === "") return;
    const done = await run(() =>
      request("squire.setKey", { provider: draft.provider as SquireProvider, key, origin }),
    );
    if (done) setKey("");
  }

  async function forgetKey() {
    if (!draft.provider) return;
    await run(() =>
      request("squire.forgetKey", { provider: draft.provider as SquireProvider, origin }),
    );
  }

  async function probe() {
    setTest(null);
    const result = await run(async () => {
      if (dirty) await configure();
      return request("squire.test");
    });
    if (!result) return;
    setTest(
      result.ok
        ? { ok: true, message: "Funciona: el escudero puede leer con este modelo." }
        : {
            ok: false,
            message:
              result.reason === "squireUnavailable" && draft.provider === "ollama"
                ? OLLAMA_HELP
                : messageFor(new CoreError(0, "", result.reason ?? undefined)),
          },
    );
  }

  async function enable(enabled: boolean) {
    await run(() => request("squire.enable", { enabled, origin }));
  }

  return (
    <div className="squire-settings format-form">
      <fieldset className="format-group">
        <legend className="format-legend small-caps">Proveedor</legend>
        <p className="format-field">
          <label htmlFor={`${id}-provider`}>Inteligencia artificial</label>
          <select
            id={`${id}-provider`}
            value={draft.provider}
            onChange={(event) => {
              setTest(null);
              setDraft({
                provider: event.target.value as SquireProvider | "",
                model: "",
                endpoint: "",
              });
            }}
          >
            <option value="">Elige uno…</option>
            {PROVIDERS.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </p>

        {info && (
          <>
            <p className="format-field">
              <label htmlFor={`${id}-model`}>Modelo</label>
              <input
                id={`${id}-model`}
                className="squire-text"
                list={`${id}-models`}
                value={draft.model}
                spellCheck={false}
                autoComplete="off"
                onChange={(event) => setDraft({ ...draft, model: event.target.value })}
              />
              <datalist id={`${id}-models`}>
                {suggestions.map((model) => (
                  <option key={model} value={model} />
                ))}
              </datalist>
            </p>
            {info.endpoint && (
              <p className="format-field">
                <label htmlFor={`${id}-endpoint`}>Dirección</label>
                <input
                  id={`${id}-endpoint`}
                  className="squire-text"
                  value={draft.endpoint}
                  placeholder={info.endpointHint}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => setDraft({ ...draft, endpoint: event.target.value })}
                />
              </p>
            )}
            {draft.provider === "ollama" && ollamaMissing && (
              <p className="squire-note" role="status">
                {OLLAMA_HELP}
              </p>
            )}
            <p className="squire-actions">
              <button
                type="button"
                className="action"
                disabled={busy || !dirty || !complete}
                onClick={() => void save()}
              >
                Guardar
              </button>
              <button
                type="button"
                className="action"
                disabled={busy || !complete}
                onClick={() => void probe()}
              >
                Probar
              </button>
            </p>
            {test && (
              <p className={test.ok ? "squire-note" : "squire-note squire-bad"} role="status">
                {test.message}
              </p>
            )}
          </>
        )}
      </fieldset>

      {keyShown && (
        <fieldset className="format-group">
          <legend className="format-legend small-caps">Clave de API</legend>
          {settings.hasKey ? (
            <p className="format-field">
              <span>Guardada en el almacén del sistema.</span>
              <button
                type="button"
                className="action"
                disabled={busy}
                onClick={() => void forgetKey()}
              >
                Borrar clave
              </button>
            </p>
          ) : (
            <form
              className="format-field"
              onSubmit={(event) => {
                event.preventDefault();
                void saveKey();
              }}
            >
              <label htmlFor={`${id}-key`}>Tu clave</label>
              <input
                id={`${id}-key`}
                className="squire-text"
                type="password"
                value={key}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setKey(event.target.value)}
              />
              <button type="submit" className="action" disabled={busy || key.trim() === ""}>
                Guardar clave
              </button>
            </form>
          )}
          <p className="squire-note">
            Se guarda en el almacén de credenciales del sistema, nunca en la obra ni en los ajustes.
          </p>
        </fieldset>
      )}

      {configured && settings.provider && (
        <fieldset className="format-group">
          <legend className="format-legend small-caps">En esta obra</legend>
          <p className="squire-note">{consentNotice(settings.provider)}</p>
          <label className="format-choice">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={busy}
              onChange={(event) => void enable(event.target.checked)}
            />{" "}
            El escudero lee esta obra
          </label>
        </fieldset>
      )}
    </div>
  );
}
