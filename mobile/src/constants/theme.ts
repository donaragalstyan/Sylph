import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#211b1d",
    textSecondary: "#5c5250",
    background: "#f7f2ed",
    surface: "#fffdfb",
    border: "#ddd0c4",
    accent: "#93123f",
    accentText: "#ffffff",
    danger: "#b3261e",
  },
  dark: {
    text: "#f3e9e2",
    textSecondary: "#c9bab3",
    background: "#18131a",
    surface: "#211a23",
    border: "#3a3038",
    accent: "#e8618b",
    accentText: "#1a0510",
    danger: "#ffb4ab",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: "system-ui", mono: "ui-monospace" },
  default: { sans: "normal", mono: "monospace" },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
