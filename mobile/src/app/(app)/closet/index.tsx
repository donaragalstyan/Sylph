import { useState } from "react";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { router, Stack } from "expo-router";
import { useClosetItems, CLOSET_CATEGORIES, type ClosetCategory } from "@/api/closet";
import { ClosetItemCard } from "@/components/ClosetItemCard";
import { Chip } from "@/components/Chip";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { LoadingState, ErrorState, EmptyState } from "@/components/StateViews";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

export default function ClosetListScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ClosetCategory | undefined>();
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const { data, isPending, isError, refetch, isRefetching } = useClosetItems({
    category,
    favorite: favoriteOnly ? true : undefined,
    q: query,
  });

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add closet item"
              onPress={() => router.push("/closet/new")}
              hitSlop={12}
            >
              <ThemedText themeColor="accent" type="title" style={styles.addGlyph}>
                +
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <View style={styles.filters}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your closet"
          placeholderTextColor={theme.textSecondary}
          style={[styles.search, { borderColor: theme.border, color: theme.text }]}
          testID="closet-search-input"
          returnKeyType="search"
        />
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={["ALL", "FAVORITES", ...CLOSET_CATEGORIES] as const}
          keyExtractor={(c) => c}
          style={styles.chipRow}
          renderItem={({ item }) => {
            if (item === "ALL") {
              return (
                <Chip
                  label="All"
                  selected={!category && !favoriteOnly}
                  onPress={() => {
                    setCategory(undefined);
                    setFavoriteOnly(false);
                  }}
                />
              );
            }
            if (item === "FAVORITES") {
              return (
                <Chip
                  label="Favorites"
                  selected={favoriteOnly}
                  onPress={() => setFavoriteOnly((v) => !v)}
                />
              );
            }
            return (
              <Chip
                label={titleCase(item)}
                selected={category === item}
                onPress={() => setCategory((c) => (c === item ? undefined : item))}
              />
            );
          }}
        />
      </View>

      {isPending ? (
        <LoadingState label="Loading your closet…" />
      ) : isError ? (
        <ErrorState message="Couldn't load your closet." onRetry={() => refetch()} />
      ) : data.items.length === 0 ? (
        <EmptyState
          title={query || category || favoriteOnly ? "No matches" : "Your closet is empty"}
          message={
            query || category || favoriteOnly
              ? "Try a different search or filter."
              : "Add your first piece to get started."
          }
          actionLabel={query || category || favoriteOnly ? undefined : "Add an item"}
          onAction={
            query || category || favoriteOnly ? undefined : () => router.push("/closet/new")
          }
        />
      ) : (
        <FlatList
          data={data.items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <ClosetItemCard item={item} onPress={() => router.push(`/closet/${item.id}`)} />
          )}
        />
      )}
    </ThemedView>
  );
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.two },
  search: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  chipRow: { flexGrow: 0 },
  grid: { padding: Spacing.two },
  addGlyph: { marginRight: Spacing.two, lineHeight: 28 },
});
