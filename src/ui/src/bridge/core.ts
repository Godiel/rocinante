import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  ErrorCodes,
  PROTOCOL_VERSION,
  type CoreMethods,
  type CoreNotifications,
  type ErrorReason,
} from "./generated/protocol";

export type MethodName = keyof CoreMethods;
export type Params<M extends MethodName> = CoreMethods[M]["params"];
export type Result<M extends MethodName> = CoreMethods[M]["result"];
export type NotificationName = keyof CoreNotifications;

/** Arguments of `request`: methods without params take none. */
type RequestArgs<M extends MethodName> = Params<M> extends undefined ? [] : [params: Params<M>];

/**
 * An error returned by the core, following the JSON-RPC error object. Expected failures carry a
 * `reason` (see `ErrorReason` in the contract) that the UI turns into a message in Spanish.
 */
export class CoreError extends Error {
  readonly code: number;
  readonly reason: ErrorReason | undefined;

  constructor(code: number, message: string, reason?: ErrorReason) {
    super(message);
    this.name = "CoreError";
    this.code = code;
    this.reason = reason;
  }

  static from(value: unknown): CoreError {
    if (typeof value === "object" && value !== null && "code" in value && "message" in value) {
      return new CoreError(Number(value.code), String(value.message), reasonOf(value));
    }
    return new CoreError(ErrorCodes.CoreUnavailable, String(value));
  }
}

function reasonOf(error: object): ErrorReason | undefined {
  if (!("data" in error) || typeof error.data !== "object" || error.data === null) return undefined;
  return "reason" in error.data ? (error.data.reason as ErrorReason) : undefined;
}

/** Sent by the host when it had to start the core again after it stopped, and when it gave up. */
export const CORE_RESTARTED = "core://restarted";
export const CORE_FAILED = "core://failed";

/** Event name used by the host relay to broadcast core notifications. */
export const NOTIFICATION_EVENT = "core://notification";

interface NotificationEnvelope {
  method: string;
  params: unknown;
}

/** Sends a typed request to the .NET core through the host relay. */
export async function request<M extends MethodName>(
  method: M,
  ...args: RequestArgs<M>
): Promise<Result<M>> {
  try {
    return await invoke<Result<M>>("core_request", { method, params: args[0] ?? null });
  } catch (error) {
    throw CoreError.from(error);
  }
}

/** Subscribes to one notification from the core. Returns the unsubscribe function. */
export function onNotification<N extends NotificationName>(
  method: N,
  handler: (params: CoreNotifications[N]) => void,
): Promise<UnlistenFn> {
  return listen<NotificationEnvelope>(NOTIFICATION_EVENT, (event) => {
    if (event.payload.method === method) {
      handler(event.payload.params as CoreNotifications[N]);
    }
  });
}

/** Subscribes to an event of the host itself (`CORE_RESTARTED`, `CORE_FAILED`). */
export function onHostEvent(name: string, handler: () => void): Promise<UnlistenFn> {
  return listen(name, () => handler());
}

/** Fails if the running core speaks a different protocol version than this UI. */
export async function ensureCompatibleCore(): Promise<void> {
  const info = await request("system.info");
  if (info.protocolVersion !== PROTOCOL_VERSION) {
    throw new CoreError(
      ErrorCodes.InternalError,
      `Protocol mismatch: UI speaks v${PROTOCOL_VERSION}, core ${info.coreVersion} speaks v${info.protocolVersion}.`,
    );
  }
}
