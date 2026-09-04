import {
  GoogleSignin,
  isSuccessResponse,
  isErrorWithCode,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { signInWithGoogleToken } from "./api";

export class GoogleSignInNotConfiguredError extends Error {}
export class GoogleSignInCanceledError extends Error {}

// A real OAuth Web client ID from Google Cloud Console — not a secret (it's a public
// identifier, safe to embed in the client; see docs/PRODUCT_AND_COMPLIANCE.md §7), but this
// project has no Google Cloud project configured yet. See EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in
// .env.example — until it's set, this deliberately fails fast instead of attempting a native
// OAuth handshake with a bogus client id.
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const PLACEHOLDER_MARKER = "replace-with-google";

let configured = false;

function ensureConfigured(): void {
  if (!WEB_CLIENT_ID || WEB_CLIENT_ID.includes(PLACEHOLDER_MARKER)) {
    throw new GoogleSignInNotConfiguredError(
      "Google Sign-In isn't configured for this build yet — set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID " +
        "to a real Google Cloud OAuth web client id.",
    );
  }
  if (!configured) {
    GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
    configured = true;
  }
}

export async function signInWithGoogle(): Promise<void> {
  ensureConfigured();

  try {
    await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      throw new GoogleSignInCanceledError("Google sign-in was canceled");
    }

    const idToken = response.data.idToken;
    if (!idToken) {
      throw new Error("Google did not return an id token");
    }

    await signInWithGoogleToken({
      idToken,
      displayName: response.data.user.name ?? undefined,
    });
  } catch (err) {
    if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new GoogleSignInCanceledError("Google sign-in was canceled");
    }
    throw err;
  }
}
