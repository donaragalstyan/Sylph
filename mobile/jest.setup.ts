// jest-expo auto-mocks first-party expo-* native modules, but third-party native modules like
// this one need an explicit mock — otherwise importing it under Jest (no real native binary)
// throws immediately (TurboModuleRegistry.getEnforcing can't find it).
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
  },
  GoogleSigninButton: "GoogleSigninButton",
  isSuccessResponse: jest.fn(),
  isErrorWithCode: jest.fn(),
  statusCodes: { SIGN_IN_CANCELLED: "SIGN_IN_CANCELLED", IN_PROGRESS: "IN_PROGRESS" },
}));
