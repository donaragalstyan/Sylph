import { SignJWT, exportJWK, generateKeyPair, type JWTVerifyGetKey, createLocalJWKSet } from "jose";

export interface TestIdentityKit {
  jwks: JWTVerifyGetKey;
  signToken: (claims: Record<string, unknown>) => Promise<string>;
}

/**
 * Builds a local RSA keypair + JWKS so tests can sign identity tokens and verify them through
 * the real `verifyAppleIdentityToken`/`verifyGoogleIdToken` logic, without any network call to
 * Apple or Google's real JWKS endpoints.
 */
export async function buildTestIdentityKit(): Promise<TestIdentityKit> {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const kid = "test-key-1";
  const publicJwk = await exportJWK(publicKey);
  const jwks = createLocalJWKSet({ keys: [{ ...publicJwk, kid, alg: "RS256" }] });

  const signToken = async (claims: Record<string, unknown>): Promise<string> => {
    return new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid })
      .setIssuedAt()
      .sign(privateKey);
  };

  return { jwks, signToken };
}
