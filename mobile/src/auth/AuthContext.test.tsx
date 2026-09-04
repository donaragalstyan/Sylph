import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "./AuthContext";
import { getStoredTokens } from "./tokenStorage";
import { fetchMe } from "./api";

// babel-jest hoists jest.mock() above every import in this file regardless of source position.
jest.mock("./tokenStorage", () => ({
  getStoredTokens: jest.fn(),
  setStoredTokens: jest.fn(),
  clearStoredTokens: jest.fn(),
}));
jest.mock("./api", () => ({
  fetchMe: jest.fn(),
  signInDev: jest.fn(),
  signOutRemote: jest.fn(),
}));
jest.mock("../api/client", () => ({ setSessionExpiredHandler: jest.fn() }));

function Probe() {
  const { status, user } = useAuth();
  return <Text testID="status">{`${status}:${user?.displayName ?? "none"}`}</Text>;
}

describe("AuthProvider bootstrap", () => {
  beforeEach(() => jest.resetAllMocks());

  it("resolves to signedOut when no tokens are stored", async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue(null);

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signedOut:none"));
  });

  it("resolves to signedIn and loads the profile when stored tokens are still valid", async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: "a",
      refreshToken: "b",
    });
    (fetchMe as jest.Mock).mockResolvedValue({
      id: "u1",
      displayName: "Riley",
      identities: [],
    });

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signedIn:Riley"));
  });

  it("falls back to signedOut if the stored session no longer validates", async () => {
    (getStoredTokens as jest.Mock).mockResolvedValue({ accessToken: "a", refreshToken: "b" });
    (fetchMe as jest.Mock).mockRejectedValue(new Error("401"));

    await render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signedOut:none"));
  });
});
