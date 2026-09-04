import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  useClosetItem,
  useSetClosetItemFavorite,
  useDeleteClosetItem,
} from "@/api/closet";
import { Button } from "@/components/Button";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LoadingState, ErrorState } from "@/components/StateViews";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export default function ClosetItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { data: item, isPending, isError, refetch } = useClosetItem(id);
  const setFavorite = useSetClosetItemFavorite();
  const deleteItem = useDeleteClosetItem();

  if (isPending) return <LoadingState label="Loading item…" />;
  if (isError || !item) return <ErrorState message="Couldn't load this item." onRetry={refetch} />;

  const primary = item.images.find((img) => img.isPrimary) ?? item.images[0] ?? null;

  function confirmDelete() {
    Alert.alert("Remove item?", `"${item!.name}" will be permanently removed from your closet.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteItem.mutateAsync(item!.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: theme.surface }]}>
          {primary ? (
            <Image source={{ uri: primary.url }} style={styles.hero} contentFit="cover" />
          ) : (
            <ThemedText themeColor="textSecondary">No photo yet</ThemedText>
          )}
        </View>

        <View style={styles.headerRow}>
          <ThemedText type="subtitle" style={styles.name}>
            {item.name}
          </ThemedText>
          <Button
            label={item.favorite ? "♥ Saved" : "♡ Favorite"}
            variant="secondary"
            loading={setFavorite.isPending}
            onPress={() => setFavorite.mutate({ id: item.id, favorite: !item.favorite })}
          />
        </View>

        <ThemedText themeColor="textSecondary">{item.category}</ThemedText>
        {item.brand && <ThemedText themeColor="textSecondary">{item.brand}</ThemedText>}
        {item.colors.length > 0 && (
          <ThemedText themeColor="textSecondary">{item.colors.join(", ")}</ThemedText>
        )}
        {item.notes && (
          <ThemedText style={styles.notes} type="small">
            {item.notes}
          </ThemedText>
        )}

        <View style={styles.deleteSection}>
          <Button
            label="Remove from closet"
            variant="danger"
            loading={deleteItem.isPending}
            onPress={confirmDelete}
          />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two },
  hero: {
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.three,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: Spacing.two },
  name: { flex: 1 },
  notes: { marginTop: Spacing.two },
  deleteSection: { marginTop: Spacing.six },
});
