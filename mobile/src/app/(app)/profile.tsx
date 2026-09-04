import { StyleSheet, View } from "react-native";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/Button";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <View>
        <ThemedText type="subtitle">{user?.displayName ?? "Your account"}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.spacedTop}>
          Signed in with{" "}
          {user?.identities.map((i) => (i.provider === "APPLE" ? "Apple" : "Google")).join(", ") ||
            "no linked provider"}
        </ThemedText>
      </View>

      <View style={styles.spacedTop}>
        <Button label="Sign out" variant="secondary" onPress={() => signOut()} />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.four, justifyContent: "space-between", paddingBottom: Spacing.six },
  spacedTop: { marginTop: Spacing.three },
});
