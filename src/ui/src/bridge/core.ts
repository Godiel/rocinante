import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

/** A JSON-RPC notification broadcast by the core to every window. */
export interface CoreNotification<T = unknown> {
  method: string;
  params: T;
}

/** Sends a request to the .NET core through the host relay. */
export function request<T>(method: string, params?: unknown): Promise<T> {
  return invoke<T>("core_request", { method, params: params ?? null });
}

/** Subscribes to notifications from the core. Returns the unsubscribe function. */
export function onNotification(
  handler: (notification: CoreNotification) => void,
): Promise<UnlistenFn> {
  return listen<CoreNotification>("core://notification", (event) => handler(event.payload));
}
