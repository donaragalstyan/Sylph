import { ActivityIndicator, StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";
import { Button } from "./Button";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center} testID="loading-state">
      <ActivityIndicator color={theme.accent} size="large" />
      <ThemedText themeColor="textSecondary" style={styles.spacedTop}>
        {label}
      </ThemedText>
    </View>
  );
}

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center} testID="error-state">
      <ThemedText themeColor="danger" type="smallBold" style={styles.centerText}>
        {message}
      </ThemedText>
      {onRetry && (
        <View style={styles.spacedTop}>
          <Button label="Try again" onPress={onRetry} variant="secondary" />
        </View>
      )}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center} testID="empty-state">
      <ThemedText type="subtitle" style={styles.centerText}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={[styles.spacedTop, styles.centerText]}>
        {message}
      </ThemedText>
      {actionLabel && onAction && (
        <View style={styles.spacedTop}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.five,
  },
  centerText: { textAlign: "center" },
  spacedTop: { marginTop: Spacing.three },
});
