import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, Check, Sparkles, MapPin } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";
import type { SearchStackParamList } from "./SearchStack";

// Mobile port of apps/web/app/(public)/services/page.tsx — Phase 2's
// customer-facing provider discovery was previously web-only; this is
// the first mobile entry point into it, reachable from the "Services"
// category on the home screen.
const SPECIALTY_LABELS: Record<string, string> = {
  PAINTING: "Painting", PLUMBING: "Plumbing", FUMIGATION: "Fumigation", ELECTRICAL: "Electrical",
  SOLAR: "Solar installations", CCTV: "CCTV installations", SECURITY_SYSTEMS: "Security systems",
  FURNITURE: "Furniture", CLEANING: "Cleaning", MOVE_IN: "Move-In", PEST_CONTROL: "Pest control",
};

const CATEGORIES = [
  { value: "SMART_HOME_INSTALLATIONS", label: "Smart Home Installations" },
  { value: "LUXURY", label: "Luxury" },
  { value: "ELECTRICAL_PLUMBING", label: "Electrical & Plumbing" },
  { value: "CLEANING_MOVE_IN", label: "Cleaning & Move-In" },
  { value: "FUMIGATION_PEST_CONTROL", label: "Fumigation & Pest Control" },
] as const;

export function ServicesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const { colors } = useTheme();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["value"] | undefined>(undefined);

  const { data, isLoading, error } = trpc.providers.search.useQuery({ department: category, limit: 20 });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.line, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: colors.ink }]}>Services</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setCategory(undefined)}
          style={[styles.chip, { borderColor: colors.line }, !category && { backgroundColor: colors.accent, borderColor: colors.accent }]}
        >
          <Text style={[styles.chipText, { color: !category ? "#fff" : colors.ink }]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.value}
            onPress={() => setCategory(c.value)}
            style={[styles.chip, { borderColor: colors.line }, category === c.value && { backgroundColor: colors.accent, borderColor: colors.accent }]}
          >
            <Text style={[styles.chipText, { color: category === c.value ? "#fff" : colors.ink }]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />}
      {error && <Text style={[styles.errorText]}>Couldn't load providers ({error.message}).</Text>}

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 14 }}
        contentContainerStyle={{ paddingVertical: 14, gap: 12 }}
        renderItem={({ item }) => {
          const isPremium =
            item.subscriptionTier === "PREMIUM" && item.subscriptionExpiresAt && new Date(item.subscriptionExpiresAt) > new Date();
          return (
            <TouchableOpacity
              style={[styles.providerCard, { backgroundColor: colors.card, borderColor: colors.line }]}
              onPress={() => navigation.navigate("ServiceProviderDetail", { id: item.id })}
            >
              <View style={styles.providerCardTop}>
                <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.avatarText, { color: colors.accent }]}>
                    {item.businessName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </Text>
                </View>
                {isPremium && (
                  <View style={[styles.premiumBadge, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                    <Sparkles size={9} color={colors.accent} />
                    <Text style={[styles.premiumText, { color: colors.accent }]}>PREMIUM</Text>
                  </View>
                )}
              </View>
              <View style={styles.providerNameRow}>
                <Text style={[styles.providerName, { color: colors.ink }]} numberOfLines={1}>
                  {item.businessName}
                </Text>
                <View style={[styles.seal, { backgroundColor: "#D2A03E" }]}>
                  <Check size={8} color="#fff" strokeWidth={3} />
                </View>
              </View>
              <Text style={[styles.providerMeta, { color: colors.inkSoft }]} numberOfLines={1}>
                {[...new Set(item.offerings.map((o: any) => SPECIALTY_LABELS[o.category] ?? o.category.replaceAll("_", " ")))].join(", ")}
              </Text>
              <View style={styles.row}>
                <MapPin size={11} color={colors.accent} />
                <Text style={[styles.rating, { color: colors.inkSoft }]}>{item.serviceArea}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={!isLoading ? <Text style={[styles.errorText, { color: colors.inkSoft }]}>No providers match these filters yet.</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 54, paddingBottom: 14, borderBottomWidth: 1 },
  topBarTitle: { fontSize: 16, fontWeight: "600" },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 14 },
  chip: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: "500" },
  errorText: { fontSize: 12, padding: 16, textAlign: "center" },
  providerCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 12 },
  providerCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 12, fontWeight: "700" },
  premiumBadge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 10, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  premiumText: { fontSize: 8, fontWeight: "700" },
  providerNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  providerName: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  seal: { width: 12, height: 12, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  providerMeta: { fontSize: 10.5, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  rating: { fontSize: 10.5, fontWeight: "500" },
});
