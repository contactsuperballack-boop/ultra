import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapPin, BedDouble, Ruler, Check, Heart, Menu, Bell, Search as SearchIcon, Home, Trees, Key, Landmark, Wrench } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useSaveToggle } from "../lib/useSaveToggle";
import { useTheme } from "../themeContext/ThemeContext";
import { PHASE2_ENABLED } from "../lib/featureFlags";
import type { SearchStackParamList } from "./SearchStack";

function formatNaira(n: number) {
  return n >= 1_000_000 ? `\u20a6${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${n.toLocaleString()}`;
}

// Exact category set requested: For Sale, Land, For Rent, Mortgage, Services.
// "Mortgage" isn't a real feature yet — Blueprint §13 places financial
// services at Phase 4, well after this build — so it's reserved space in
// the nav (same "not built yet, not pretended to exist" pattern the
// Blueprint itself uses for other future lifecycle phases), not a dead
// button pretending to work. "Services" is real: it navigates to Phase
// 2's provider discovery flow, previously web-only.
const CATEGORIES = [
  { key: "SALE", label: "For Sale", icon: Home },
  { key: "LAND", label: "Land", icon: Trees },
  { key: "RENT", label: "For Rent", icon: Key },
  { key: "MORTGAGE", label: "Mortgage", icon: Landmark },
  { key: "SERVICES", label: "Services", icon: Wrench },
] as const;

export function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const { colors } = useTheme();
  const [type, setType] = useState<"SALE" | "RENT" | "LAND" | undefined>(undefined);

  const { data, isLoading, error } = trpc.listings.search.useQuery({ type, limit: 20 });

  const { data: savedIds } = trpc.savedListings.ids.useQuery(undefined, { retry: false });
  const toggleSave = useSaveToggle(() =>
    Alert.alert("Sign in required", "Sign in from the Profile tab to save listings.")
  );

  function onCategoryPress(key: (typeof CATEGORIES)[number]["key"]) {
    if (key === "SERVICES") {
      // Sprint 3 — Phase 2 freeze (Sprint 1B Delta Audit). Reuses the
      // exact same "coming soon" pattern already established for Mortgage
      // below, rather than inventing a new UX for the same underlying
      // idea ("this exists but isn't open yet").
      if (PHASE2_ENABLED) {
        navigation.navigate("Services");
      } else {
        Alert.alert("Coming soon", "Home services are in a supervised pilot and aren't available on ULTRA yet — we'll let you know when they are.");
      }
    } else if (key === "MORTGAGE") {
      Alert.alert("Coming soon", "Mortgage services aren't available on ULTRA yet — we'll let you know when they are.");
    } else {
      setType((current) => (current === key ? undefined : (key as "SALE" | "RENT" | "LAND")));
    }
  }

  function openNotifications() {
    // Notifications lives on the Profile tab's own stack — this is
    // React Navigation's standard cross-tab navigation call, not a
    // custom mechanism.
    (navigation as any).getParent()?.navigate("Profile", { screen: "Notifications" });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { backgroundColor: colors.card, borderBottomColor: colors.line }]}>
        <TouchableOpacity onPress={() => (navigation as any).getParent()?.navigate("Profile")} hitSlop={10}>
          <Menu size={20} color={colors.ink} />
        </TouchableOpacity>
        <Image source={require("../../assets/logo-wordmark.jpg")} style={styles.wordmark} resizeMode="contain" />
        <TouchableOpacity onPress={openNotifications} hitSlop={10}>
          <Bell size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.line }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <SearchIcon size={15} color={colors.inkSoft} />
          <Text style={[styles.searchPlaceholder, { color: colors.inkSoft }]}>Search by location, estate, or keyword</Text>
        </View>

        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => {
            const active = type === c.key;
            return (
              <TouchableOpacity key={c.key} onPress={() => onCategoryPress(c.key)} style={styles.categoryItem}>
                <View style={[styles.categoryIcon, { borderColor: colors.line }, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                  <c.icon size={16} color={active ? "#fff" : colors.ink} />
                </View>
                <Text style={[styles.categoryLabel, { color: active ? colors.accent : colors.inkSoft }]}>{c.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />}

      {error && (
        <Text style={[styles.errorText, { color: "#B4432E" }]}>
          Couldn't reach the API ({error.message}). Expected until apps/mobile's extra.apiUrl points at a running server.
        </Text>
      )}

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 14, gap: 14 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}
            onPress={() => navigation.navigate("ListingDetail", { id: item.id })}
          >
            <View style={[styles.cardImage, { backgroundColor: colors.brandNavy }]}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.card }]}
                onPress={() => toggleSave.mutate({ listingId: item.id })}
              >
                <Heart size={14} color={colors.accent} fill={savedIds?.includes(item.id) ? colors.accent : "none"} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 12 }}>
              <Text style={[styles.price, { color: colors.ink }]}>
                {formatNaira(Number(item.priceNaira))}
                {item.type === "RENT" && <Text style={[styles.priceUnit, { color: colors.inkSoft }]}> /year</Text>}
              </Text>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{item.title}</Text>
              <View style={styles.row}>
                <MapPin size={11} color={colors.inkSoft} />
                <Text style={[styles.metaText, { color: colors.inkSoft }]}>{item.area}, Abuja</Text>
              </View>
              <View style={[styles.row, { marginTop: 6, gap: 10 }]}>
                {item.bedrooms != null && (
                  <View style={styles.row}>
                    <BedDouble size={12} color={colors.inkSoft} />
                    <Text style={[styles.metaMono, { color: colors.inkSoft }]}>{item.bedrooms}</Text>
                  </View>
                )}
                <View style={styles.row}>
                  <Ruler size={12} color={colors.inkSoft} />
                  <Text style={[styles.metaMono, { color: colors.inkSoft }]}>{item.sizeSqm}m\u00b2</Text>
                </View>
                {item.realtorProfile.verificationStatus === "VERIFIED" && (
                  <View style={[styles.seal, { backgroundColor: colors.accent }]}>
                    <Check size={9} color="#fff" strokeWidth={3} />
                  </View>
                )}
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
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 54, paddingBottom: 10, borderBottomWidth: 1 },
  wordmark: { width: 84, height: 22 },
  header: { padding: 16, borderBottomWidth: 1 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  searchPlaceholder: { fontSize: 12.5 },
  chipRow: { flexDirection: "row", justifyContent: "space-between" },
  categoryItem: { alignItems: "center", gap: 5, width: 60 },
  categoryIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  categoryLabel: { fontSize: 10, fontWeight: "500", textAlign: "center" },
  errorText: { fontSize: 12, padding: 16 },
  card: { borderRadius: 18, overflow: "hidden", borderWidth: 1 },
  cardImage: { height: 140 },
  saveBtn: { position: "absolute", bottom: 10, left: 10, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  price: { fontSize: 18, fontWeight: "600" },
  priceUnit: { fontSize: 11, fontWeight: "400" },
  cardTitle: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  metaMono: { fontSize: 11 },
  seal: { width: 14, height: 14, borderRadius: 7, alignItems: "center", justifyContent: "center" },
});
