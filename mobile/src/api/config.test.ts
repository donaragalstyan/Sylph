// jest.doMock + require() (not import) is the correct pattern here: each test needs a fresh
// module evaluation of ./config against a *different* mocked Platform.OS, and doMock is
// deliberately not hoisted, unlike jest.mock — that only works paired with a synchronous
// require() taken after the mock is registered.
/* eslint-disable @typescript-eslint/no-require-imports */

describe("API_BASE_URL platform resolution", () => {
  afterEach(() => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  it("uses the Android emulator's host-loopback alias, not localhost, on Android", () => {
    jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
    const { API_BASE_URL } = require("./config");
    expect(API_BASE_URL).toBe("http://10.0.2.2:3000");
  });

  it("uses localhost on iOS, since the Simulator shares the host network namespace", () => {
    jest.doMock("react-native", () => ({ Platform: { OS: "ios" } }));
    const { API_BASE_URL } = require("./config");
    expect(API_BASE_URL).toBe("http://localhost:3000");
  });

  it("prefers an explicit EXPO_PUBLIC_API_URL override on either platform", () => {
    process.env.EXPO_PUBLIC_API_URL = "http://192.168.1.50:3000";
    jest.doMock("react-native", () => ({ Platform: { OS: "android" } }));
    const { API_BASE_URL } = require("./config");
    expect(API_BASE_URL).toBe("http://192.168.1.50:3000");
  });
});
