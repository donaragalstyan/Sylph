import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { ThemedView } from "@/components/themed-view";
import { LoadingState } from "@/components/StateViews";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { status } = useAuth();

  useEffect(() => {
    if (status !== "loading") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [status]);

  if (status === "loading") {
    return (
      <ThemedView style={{ flex: 1 }}>
        <LoadingState />
      </ThemedView>
    );
  }

  return (
    <Stack>
      {/* Always registered so "/" itself resolves to something — it just redirects (see
          index.tsx) based on the now-resolved auth status. Without this, expo-router has no
          screen matching the bare "/" path once the two branches below are gated. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </QueryClientProvider>
  );
}
