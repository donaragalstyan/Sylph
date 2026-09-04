import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import type { ClosetItemSummary } from "@/api/closet";

export function ClosetItemCard({
  item,
  onPress,
}: {
  item: ClosetItemSummary;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      testID={`closet-item-${item.id}`}
    >
      <View style={[styles.thumb, { backgroundColor: theme.background }]}>
        {item.primaryImageUrl ? (
          <Image source={{ uri: item.primaryImageUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <ThemedText themeColor="textSecondary" type="small">
            No photo
          </ThemedText>
        )}
      </View>
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText themeColor="textSecondary" type="small" numberOfLines={1}>
          {item.brand ?? item.category}
        </ThemedText>
      </View>
      {item.favorite && (
        <ThemedText themeColor="accent" style={styles.favoriteMark}>
          ♥
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: Spacing.two,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  thumb: {
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    padding: Spacing.two,
  },
  favoriteMark: {
    position: "absolute",
    top: Spacing.two,
    right: Spacing.two,
  },
});
