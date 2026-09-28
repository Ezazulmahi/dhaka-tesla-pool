/** Thin fetch wrapper: same-origin /api, JSON in/out, the API's error envelope as an exception. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First validation message per field, for forms. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (this.code !== "VALIDATION_ERROR" || !this.details) return out;
    for (const [field, messages] of Object.entries(this.details)) {
      if (Array.isArray(messages) && messages[0]) out[field] = String(messages[0]);
    }
    return out;
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers: init.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "You seem to be offline. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const e = payload?.error;
    throw new ApiError(res.status, e?.code ?? "UNKNOWN", e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return payload as T;
}

export const toApiError = (e: unknown) =>
  e instanceof ApiError ? e : new ApiError(0, "UNKNOWN", e instanceof Error ? e.message : "Something went wrong");
