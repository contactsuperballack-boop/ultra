import React from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Heart, MapPin, Ruler } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";
import type { SavedStackParamList } from "./SavedStack";

function formatNaira(n: number) {
  return n >= 1_000_000 ? `\u20a6${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${n.toLocaleString()}`;
}

// Sprint B — migrated to useTheme().
export function SavedListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SavedStackParamList>>();
  const { colors } = useTheme();
  const { data: listings, isLoading, error } = trpc.savedListings.list.useQuery();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Saved</Text>

      {error && (
        <Text style={[styles.errorText, { color: colors.inkSoft }]}>
          {error.message === "Sign in required." ? "Sign in from the Profile tab to save listings." : error.message}
        </Text>
      )}

      {!error && listings?.length === 0 && (
        <View style={styles.empty}>
          <Heart size={26} color={colors.inkSoft} style={{ opacity: 0.5, marginBottom: 10 }} />
          <Text style={[styles.emptyText, { color: colors.inkSoft }]}>Tap the heart on any listing to save it here.</Text>
        </View>
      )}

      <FlatList
        data={listings ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, gap: 12 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}
            onPress={() => navigation.navigate("ListingDetail", { id: item.id })}
          >
            <View style={[styles.cardImage, { backgroundColor: colors.brandNavy }]} />
            <View style={{ padding: 12, flex: 1 }}>
              <Text style={[styles.price, { color: colors.ink }]}>{formatNaira(Number(item.priceNaira))}</Text>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{item.title}</Text>
              <View style={styles.row}>
                <MapPin size={11} color={colors.inkSoft} />
                <Text style={[styles.metaText, { color: colors.inkSoft }]}>{item.area}, Abuja</Text>
                <Ruler size={11} color={colors.inkSoft} style={{ marginLeft: 8 }} />
                <Text style={[styles.metaText, { color: colors.inkSoft }]}>{item.sizeSqm}m\u00b2</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: "600", padding: 16, paddingBottom: 4 },
  errorText: { fontSize: 12.5, paddingHorizontal: 16 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyText: { fontSize: 13, textAlign: "center" },
  card: { flexDirection: "row", borderRadius: 16, overflow: "hidden", borderWidth: 1 },
  cardImage: { width: 90 },
  price: { fontSize: 15, fontWeight: "600" },
  cardTitle: { fontSize: 12.5, fontWeight: "600", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  metaText: { fontSize: 11 },
});
