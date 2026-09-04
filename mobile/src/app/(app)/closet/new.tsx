import { useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useCreateClosetItem, CLOSET_CATEGORIES, type ClosetCategory } from "@/api/closet";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/Button";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

/**
 * Deliberately minimal for Step 3 (name + category only) so the closet list/search/filter
 * screens have something real to show without pulling in Step 4's photo-capture flow. The
 * full Add Item form (camera/picker + full metadata) is Step 4 scope.
 */
export default function QuickAddClosetItemScreen() {
  const theme = useTheme();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory>("TOPS");
  const [error, setError] = useState<string | null>(null);
  const createItem = useCreateClosetItem();

  async function handleSave() {
    if (!name.trim()) {
      setError("Give this item a name.");
      return;
    }
    setError(null);
    try {
      await createItem.mutateAsync({ name: name.trim(), category });
      router.back();
    } catch {
      setError("Couldn't save this item. Please try again.");
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText type="smallBold">Name</ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Black pleated mini skirt"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { borderColor: theme.border, color: theme.text }]}
          testID="new-item-name-input"
        />

        <ThemedText type="smallBold" style={styles.sectionSpacing}>
          Category
        </ThemedText>
        <View style={styles.chipWrap}>
          {CLOSET_CATEGORIES.map((c) => (
            <Chip key={c} label={titleCase(c)} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </View>

        {error && (
          <ThemedText themeColor="danger" type="small" style={styles.sectionSpacing}>
            {error}
          </ThemedText>
        )}

        <View style={styles.sectionSpacing}>
          <Button label="Save" onPress={handleSave} loading={createItem.isPending} testID="save-item-button" />
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.four, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  sectionSpacing: { marginTop: Spacing.four },
});
