import { ActivityIndicator, Pressable, StyleSheet, type GestureResponderEvent } from "react-native";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

interface ButtonProps {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  variant?: "primary" | "secondary" | "danger";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function Button({ label, onPress, variant = "primary", loading, disabled, testID }: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === "primary" ? theme.accent : variant === "danger" ? theme.danger : "transparent";
  const borderColor = variant === "secondary" ? theme.border : "transparent";
  const textColor = variant === "secondary" ? theme.text : theme.accentText;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, borderColor, borderWidth: variant === "secondary" ? 1 : 0 },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <ThemedText style={{ color: textColor }} type="smallBold">
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
