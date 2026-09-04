import { Stack } from "expo-router";
import { useTheme } from "@/hooks/use-theme";

export default function ClosetStackLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Closet" }} />
      <Stack.Screen name="[id]" options={{ title: "Item" }} />
      <Stack.Screen name="new" options={{ title: "Add item", presentation: "modal" }} />
    </Stack>
  );
}
