import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { generateRawNonce, hashNonce } from "./nonce";
import { signInWithAppleToken } from "./api";

export class AppleSignInUnavailableError extends Error {}
export class AppleSignInCanceledError extends Error {}

/**
 * expo-apple-authentication does not hash the nonce for you — the hashed value goes to Apple's
 * native request, and the raw value travels to our backend, which recomputes the hash and
 * compares it against the identityToken's `nonce` claim (backend/src/auth/apple.ts). Apple's
 * own docs note Simulator support for this flow is limited (getCredentialStateAsync in
 * particular always throws there) — real-device verification is still required before launch.
 */
export async function signInWithApple(): Promise<void> {
  if (Platform.OS !== "ios") {
    throw new AppleSignInUnavailableError("Sign in with Apple is only offered on iOS");
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new AppleSignInUnavailableError("Sign in with Apple is not available on this device");
  }

  const rawNonce = await generateRawNonce();
  const hashedNonce = await hashNonce(rawNonce);

  let credential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ERR_REQUEST_CANCELED") {
      throw new AppleSignInCanceledError("Sign in with Apple was canceled");
    }
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token");
  }

  const displayName = credential.fullName?.givenName
    ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(" ")
    : undefined;

  await signInWithAppleToken({
    identityToken: credential.identityToken,
    rawNonce,
    displayName,
  });
}
