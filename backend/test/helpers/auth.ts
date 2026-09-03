import type { FastifyInstance } from "fastify";

/** Creates a signed-in user via the real Apple sign-in route (mocked verifier upstream in
 * whichever test file imports this) and returns their access token + id, for closet-route
 * tests that need an authenticated caller. */
export async function signInTestUser(
  app: FastifyInstance,
  providerUserId: string,
): Promise<{ userId: string; accessToken: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/v1/auth/apple",
    payload: {
      identityToken: JSON.stringify({ providerUserId, email: null, emailVerified: false }),
      rawNonce: "test-raw-nonce-0123456789abcdef",
    },
  });
  const body = res.json();
  return { userId: body.user.id, accessToken: body.accessToken };
}
