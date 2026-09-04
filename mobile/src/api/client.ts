import { API_BASE_URL } from "./config";
import { getStoredTokens, setStoredTokens, clearStoredTokens } from "../auth/tokenStorage";

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `Request failed with status ${status}`);
  }
}

/** Called when a refresh attempt fails outright (refresh token invalid/expired/revoked) — the
 * app is signed out. Set by AuthContext at startup; kept decoupled so this module doesn't
 * import React state directly. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

async function rawRequest(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

async function refreshSession(): Promise<string | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const res = await rawRequest("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  if (!res.ok) {
    await clearStoredTokens();
    onSessionExpired?.();
    return null;
  }

  const body = (await res.json()) as { accessToken: string; refreshToken: string };
  await setStoredTokens(body);
  return body.accessToken;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Most endpoints require a session; a handful (sign-in, refresh) don't. */
  auth?: boolean;
}

function buildQueryString(query?: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * The single entry point for talking to the Sylph backend. Attaches the access token,
 * transparently retries once after a silent refresh on a 401, and otherwise throws a typed
 * ApiError so callers can render specific error states rather than a generic failure.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, auth = true } = options;
  const url = `${path}${buildQueryString(query)}`;

  const doRequest = async (accessToken: string | null): Promise<Response> =>
    rawRequest(url, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    });

  let accessToken: string | null = null;
  if (auth) {
    const tokens = await getStoredTokens();
    accessToken = tokens?.accessToken ?? null;
  }

  let res = await doRequest(accessToken);

  if (auth && res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      res = await doRequest(refreshed);
    }
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(res.status, payload, typeof payload?.error === "string" ? payload.error : undefined);
  }

  return payload as T;
}
