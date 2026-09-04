import * as Crypto from "expo-crypto";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generates the raw, cryptographically random nonce for one Sign in with Apple attempt, per
 * backend/src/auth/apple.ts's expected flow (docs/PRODUCT_AND_COMPLIANCE.md §7): the SHA-256
 * hash of this value is what actually gets passed to AppleAuthentication.signInAsync(), and
 * this raw value travels to the backend alongside the resulting identityToken so it can
 * recompute and compare the hash.
 */
export async function generateRawNonce(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return toHex(bytes);
}

export async function hashNonce(rawNonce: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce, {
    encoding: Crypto.CryptoEncoding.HEX,
  });
}
