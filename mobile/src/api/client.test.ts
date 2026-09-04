import * as tokenStorage from "../auth/tokenStorage";
import { apiRequest, ApiError, setSessionExpiredHandler } from "./client";

// babel-jest hoists jest.mock() above every import in this file regardless of source position,
// so placing it after the imports it affects is safe and keeps import/first happy.
jest.mock("./config", () => ({ API_BASE_URL: "http://test-backend" }));

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => "application/json" },
    json: async () => body,
  } as unknown as Response;
}

describe("apiRequest", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(tokenStorage, "getStoredTokens").mockResolvedValue({
      accessToken: "expired-access-token",
      refreshToken: "valid-refresh-token",
    });
    jest.spyOn(tokenStorage, "setStoredTokens").mockResolvedValue(undefined);
    jest.spyOn(tokenStorage, "clearStoredTokens").mockResolvedValue(undefined);
  });

  it("attaches the bearer token and returns parsed JSON on success", async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock;

    const result = await apiRequest<{ ok: boolean }>("/v1/me");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test-backend/v1/me",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer expired-access-token" }),
      }),
    );
  });

  it("silently refreshes and retries once on a 401, then succeeds", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "unauthorized" }))
      .mockResolvedValueOnce(
        jsonResponse(200, { accessToken: "new-access-token", refreshToken: "new-refresh-token" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    global.fetch = fetchMock;

    const result = await apiRequest<{ ok: boolean }>("/v1/me");

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(tokenStorage.setStoredTokens).toHaveBeenCalledWith({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
    });
    // the retried request must use the freshly refreshed token, not the stale one
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://test-backend/v1/me",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer new-access-token" }),
      }),
    );
  });

  it("clears tokens and signals session expiry when the refresh itself fails", async () => {
    const sessionExpired = jest.fn();
    setSessionExpiredHandler(sessionExpired);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { error: "unauthorized" }))
      .mockResolvedValueOnce(jsonResponse(401, { error: "invalid_refresh_token" }));
    global.fetch = fetchMock;

    await expect(apiRequest("/v1/me")).rejects.toBeInstanceOf(ApiError);
    expect(tokenStorage.clearStoredTokens).toHaveBeenCalled();
    expect(sessionExpired).toHaveBeenCalled();
  });

  it("throws a typed ApiError with status and body on a non-auth failure", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(422, { error: "too_many_images" }));

    await expect(apiRequest("/v1/closet-items/x/images", { method: "POST" })).rejects.toMatchObject({
      status: 422,
      body: { error: "too_many_images" },
    });
  });
});
