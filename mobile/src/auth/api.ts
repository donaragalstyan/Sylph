import { apiRequest } from "../api/client";
import { setStoredTokens, clearStoredTokens, getStoredTokens } from "./tokenStorage";

export interface SylphUser {
  id: string;
  displayName: string | null;
  identities: { provider: "APPLE" | "GOOGLE"; createdAt: string }[];
}

interface SignInResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; displayName: string | null };
}

async function completeSignIn(response: SignInResponse): Promise<void> {
  await setStoredTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken });
}

export async function signInWithAppleToken(input: {
  identityToken: string;
  rawNonce: string;
  displayName?: string;
}): Promise<void> {
  const res = await apiRequest<SignInResponse>("/v1/auth/apple", {
    method: "POST",
    auth: false,
    body: input,
  });
  await completeSignIn(res);
}

export async function signInWithGoogleToken(input: {
  idToken: string;
  displayName?: string;
}): Promise<void> {
  const res = await apiRequest<SignInResponse>("/v1/auth/google", {
    method: "POST",
    auth: false,
    body: input,
  });
  await completeSignIn(res);
}

/** Local development only — see backend/src/auth/devRoutes.ts. Never reachable unless the
 * backend explicitly opts in via ENABLE_DEV_AUTH, and never rendered in a release build (§7). */
export async function signInDev(displayName?: string): Promise<void> {
  const res = await apiRequest<SignInResponse>("/v1/auth/dev-login", {
    method: "POST",
    auth: false,
    body: { displayName },
  });
  await completeSignIn(res);
}

export async function fetchMe(): Promise<SylphUser> {
  return apiRequest<SylphUser>("/v1/me");
}

export async function signOutRemote(): Promise<void> {
  const tokens = await getStoredTokens();
  if (tokens) {
    try {
      await apiRequest("/v1/auth/logout", {
        method: "POST",
        body: { refreshToken: tokens.refreshToken },
      });
    } catch {
      // best-effort — the local session is cleared regardless (see clearStoredTokens below)
    }
  }
  await clearStoredTokens();
}
