import type { SquireProvider } from "../../bridge/generated/protocol";

/** How the settings of the squire present each provider. */
export interface ProviderInfo {
  id: SquireProvider;
  label: string;
  /** Whether the text leaves the writer's computer. */
  cloud: boolean;
  /** Whether it needs an API key of the writer's. */
  needsKey: boolean;
  /** Whether the writer gives its address: always for a compatible service, optionally for Ollama. */
  endpoint: "required" | "optional" | null;
  endpointHint?: string;
  /** Models to suggest; the writer may write any other. */
  models: readonly string[];
}

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    cloud: true,
    needsKey: true,
    endpoint: null,
    models: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"],
  },
  {
    id: "openai",
    label: "OpenAI",
    cloud: true,
    needsKey: true,
    endpoint: null,
    models: ["gpt-5-mini", "gpt-5"],
  },
  {
    id: "gemini",
    label: "Google (Gemini)",
    cloud: true,
    needsKey: true,
    endpoint: null,
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    cloud: true,
    needsKey: true,
    endpoint: null,
    models: ["grok-4", "grok-3-mini"],
  },
  {
    id: "compatible",
    label: "Compatible con OpenAI",
    cloud: true,
    needsKey: true,
    endpoint: "required",
    endpointHint: "https://servicio.ejemplo/v1",
    models: [],
  },
  {
    id: "ollama",
    label: "Ollama (en tu equipo)",
    cloud: false,
    needsKey: false,
    endpoint: "optional",
    endpointHint: "http://127.0.0.1:11434",
    models: [],
  },
];

export function providerInfo(id: SquireProvider): ProviderInfo {
  return PROVIDERS.find((provider) => provider.id === id)!;
}

/** What the writer is told before letting the squire read the work. */
export function consentNotice(id: SquireProvider): string {
  const provider = providerInfo(id);
  return provider.cloud
    ? `Con el escudero encendido, cada párrafo que termines en esta obra y los nombres de sus fichas irán a ${provider.label}, con tu clave.`
    : "Con Ollama el texto no sale de tu equipo: lo lee el modelo que tienes instalado.";
}

/** Said when Ollama does not answer. */
export const OLLAMA_HELP =
  "Ollama no responde. Instálalo desde ollama.com, ábrelo y descarga un modelo, por ejemplo con «ollama pull llama3.1».";
