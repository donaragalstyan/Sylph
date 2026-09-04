import { Platform } from "react-native";

/**
 * Local-dev default only. The Android emulator's `localhost` refers to the emulator itself, not
 * the host machine — `10.0.2.2` is the documented alias back to the host loopback interface.
 * iOS Simulator shares the host's network namespace, so `localhost` works there directly.
 * A real device (either platform) needs the host machine's LAN IP instead of either of these —
 * set EXPO_PUBLIC_API_URL for that case, and for any non-local environment (staging/prod).
 */
function defaultDevApiUrl(): string {
  return Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? defaultDevApiUrl();
