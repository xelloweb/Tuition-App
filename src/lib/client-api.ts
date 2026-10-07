/**
 * Browser-side helper for calling the JSON API. Every failure becomes a
 * ClientApiError with a message that is safe to show to staff.
 */

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;
  readonly reference?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors: Record<string, string> = {},
    reference?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.reference = reference;
    this.details = details;
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  401: "Your session has expired. Sign in again in another tab, then retry here — your entries have been kept.",
  403: "You do not have permission to do this. Ask the owner if you need access.",
  404: "This record no longer exists. Refresh the page.",
  409: "This conflicts with an existing record. Review the details and try again.",
  429: "Too many requests. Wait a moment and try again.",
};

/** Random key used to make a create request safe to retry. */
export function newIdempotencyKey(): string {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // randomUUID needs a secure context (https / localhost); fall back for LAN testing.
  if (cryptoObj?.getRandomValues) {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  options: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ClientApiError(
      0,
      "NETWORK",
      "Could not reach the server. Check your connection and try again — your entries have been kept."
    );
  }

  if (res.redirected && new URL(res.url).pathname === "/login") {
    throw new ClientApiError(401, "UNAUTHENTICATED", FALLBACK_MESSAGES[401]);
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const serverMessage = typeof data?.error === "string" ? data.error : null;
    const message =
      res.status === 401
        ? FALLBACK_MESSAGES[401]
        : serverMessage ??
          FALLBACK_MESSAGES[res.status] ??
          (res.status >= 500
            ? "The server is temporarily unavailable. Nothing was saved — please try again in a moment."
            : "The request could not be completed. Please try again.");
    throw new ClientApiError(
      res.status,
      typeof data?.code === "string" ? data.code : `HTTP_${res.status}`,
      message,
      (data?.fieldErrors as Record<string, string>) ?? {},
      typeof data?.reference === "string" ? data.reference : undefined,
      (data?.details as Record<string, unknown>) ?? undefined
    );
  }
  return (data ?? {}) as T;
}

/** Parses a fetch Response the same way apiRequest does (for older call sites). */
export async function readApiResponse<T = Record<string, unknown>>(res: Response, fallback: string): Promise<T> {
  if (res.redirected && new URL(res.url).pathname === "/login") {
    throw new ClientApiError(401, "UNAUTHENTICATED", FALLBACK_MESSAGES[401]);
  }
  let data: Record<string, unknown> | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const serverMessage = typeof data?.error === "string" ? data.error : null;
    throw new ClientApiError(
      res.status,
      typeof data?.code === "string" ? data.code : `HTTP_${res.status}`,
      res.status === 401
        ? FALLBACK_MESSAGES[401]
        : serverMessage ?? FALLBACK_MESSAGES[res.status] ?? (res.status >= 500 ? "The server is temporarily unavailable. Nothing was saved — please try again." : fallback),
      (data?.fieldErrors as Record<string, string>) ?? {}
    );
  }
  return (data ?? {}) as T;
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  // fetch() rejects with a TypeError when the network is down.
  if (err instanceof TypeError) return "Could not reach the server. Check your connection and try again — your entries have been kept.";
  if (err instanceof ClientApiError || err instanceof Error) return err.message || fallback;
  return fallback;
}
