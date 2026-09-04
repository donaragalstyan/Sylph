import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSigninButton } from "@react-native-google-signin/google-signin";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/Button";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { Spacing } from "@/constants/theme";
import { useAuth } from "@/auth/AuthContext";
import { AppleSignInCanceledError, AppleSignInUnavailableError } from "@/auth/appleSignIn";
import { GoogleSignInCanceledError, GoogleSignInNotConfiguredError } from "@/auth/googleSignIn";

export default function SignInScreen() {
  const scheme = useColorScheme();
  const { signInWithApple, signInWithGoogle, signInWithDevAccount } = useAuth();
  const [pending, setPending] = useState<"apple" | "google" | "dev" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(kind: "apple" | "google" | "dev", action: () => Promise<void>) {
    setError(null);
    setPending(kind);
    try {
      await action();
    } catch (err) {
      if (err instanceof AppleSignInCanceledError || err instanceof GoogleSignInCanceledError) {
        // user-initiated cancellation — not an error worth surfacing
      } else if (err instanceof GoogleSignInNotConfiguredError || err instanceof AppleSignInUnavailableError) {
        setError(err.message);
      } else {
        setError("Sign-in failed. Please try again.");
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.hero}>
        <ThemedText type="title">Sylph</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.tagline}>
          Your closet, your outfits, your style — in one place.
        </ThemedText>
      </View>

      <View style={styles.actions}>
        {Platform.OS === "ios" && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={
              scheme === "dark"
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={10}
            style={styles.appleButton}
            onPress={() => handle("apple", signInWithApple)}
          />
        )}

        <GoogleSigninButton
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          style={styles.googleButton}
          onPress={() => handle("google", signInWithGoogle)}
          disabled={pending !== null}
        />

        {__DEV__ && (
          <View style={styles.devSection}>
            <ThemedText themeColor="textSecondary" type="small">
              Local development only
            </ThemedText>
            <Button
              label="Continue as Test User"
              variant="secondary"
              loading={pending === "dev"}
              disabled={pending !== null}
              onPress={() => handle("dev", signInWithDevAccount)}
            />
          </View>
        )}

        {error && (
          <ThemedText themeColor="danger" type="small" style={styles.error}>
            {error}
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: Spacing.five,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
  },
  hero: { marginTop: Spacing.six },
  tagline: { marginTop: Spacing.two, maxWidth: 280 },
  actions: { gap: Spacing.three },
  appleButton: { width: "100%", height: 50 },
  googleButton: { alignSelf: "stretch" },
  devSection: { gap: Spacing.two, marginTop: Spacing.four },
  error: { textAlign: "center" },
});
