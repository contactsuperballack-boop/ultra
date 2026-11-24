import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, ScrollView, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Image } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MapPin, BedDouble, Ruler, Heart, Menu, Bell, Headphones, Search as SearchIcon, Home, Trees, Key, Landmark, Wrench, Bookmark, MessageCircle, User, HelpCircle } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useSaveToggle } from "../lib/useSaveToggle";
import { useTheme } from "../themeContext/ThemeContext";
import { PHASE2_ENABLED, MORTGAGE_ENABLED } from "../lib/featureFlags";
import { ExploreByLocation } from "../components/ExploreByLocation";
import { PRICE_RANGES, sortOptionsFor, type SortOption } from "../lib/searchFilters";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import { MenuSheet, HelpSheet, type MenuItem } from "../components/HomeSheets";
import type { SearchStackParamList } from "./SearchStack";

function formatNaira(n: number) {
  return n >= 1_000_000 ? `\u20a6${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${n.toLocaleString()}`;
}

// Category set: Buy, To Let, Land, Mortgage, Services (order per the design).
// Mortgage remains deferred. Services opens the Home Services MVP pilot
// when HOME_SERVICES_ENABLED is true; otherwise it stays safely gated.
const CATEGORIES = [
  { key: "SALE", label: "Buy", icon: Home },
  { key: "RENT", label: "To Let", icon: Key },
  { key: "LAND", label: "Land", icon: Trees },
  { key: "MORTGAGE", label: "Mortgage", icon: Landmark },
  { key: "SERVICES", label: "Services", icon: Wrench },
] as const;

const TYPE_LABELS: Record<string, string> = { SALE: "For Sale", RENT: "To Let", LAND: "Land" };

export function SearchScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const route = useRoute<RouteProp<SearchStackParamList, "SearchHome">>();
  const { colors } = useTheme();
  const [type, setType] = useState<"SALE" | "RENT" | "LAND" | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [rangeLabel, setRangeLabel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("NEWEST");
  // Price ranges and sort rules are per category, so changing category resets them.
  useEffect(() => {
    setRangeLabel(null);
    setSortBy("NEWEST");
  }, [type]);
  const range = type ? PRICE_RANGES[type].find((r) => r.label === rangeLabel) : undefined;
  const sortOptions = sortOptionsFor(type);

  // One search per pause in typing, not one per keystroke.
  const debouncedQuery = useDebouncedValue(query.trim(), 350);

  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage, isRefetching } = trpc.listings.search.useInfiniteQuery(
    {
      type,
      query: debouncedQuery || undefined,
      minPriceNaira: range?.minNaira,
      maxPriceNaira: range?.maxNaira,
      sortBy,
      limit: 20,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      placeholderData: (previous) => previous, // keep the old results visible while a new search loads
    }
  );
  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

  const { data: unread } = trpc.notifications.unreadCount.useQuery(undefined, { retry: false });
  const { data: savedIds } = trpc.savedListings.ids.useQuery(undefined, { retry: false });
  const toggleSave = useSaveToggle(() =>
    Alert.alert("Sign in required", "Sign in from the Profile tab to save listings.")
  );

  function onCategoryPress(key: (typeof CATEGORIES)[number]["key"]) {
    if (key === "SERVICES") {
      // Home Services is part of MVP scope but remains explicitly gated until
      // the approved pilot environment enables it.
      if (PHASE2_ENABLED) {
        navigation.navigate("Services");
      } else {
        Alert.alert("Coming soon", "Verified home services are coming to ULTRA soon.");
      }
    } else if (key === "MORTGAGE") {
      if (MORTGAGE_ENABLED) {
        navigation.navigate("Mortgage");
      } else {
        Alert.alert("Coming soon", "Mortgage information is coming to ULTRA. ULTRA is not a lender or broker.");
      }
    } else {
      setType((current) => (current === key ? undefined : (key as "SALE" | "RENT" | "LAND")));
    }
  }

  const goTab = (name: string) => (navigation as any).getParent()?.navigate(name);
  const menuItems: MenuItem[] = [
    ...CATEGORIES.map((c) => ({ label: c.label, icon: c.icon, onPress: () => onCategoryPress(c.key) })),
    { label: "Saved", icon: Bookmark, onPress: () => goTab("Saved"), dividerBefore: true },
    { label: "Messages", icon: MessageCircle, onPress: () => goTab("Messages") },
    { label: "My account", icon: User, onPress: () => goTab("Profile") },
    { label: "Help", icon: HelpCircle, onPress: () => setHelpOpen(true), dividerBefore: true },
  ];

  function openNotifications() {
    // Notifications lives on the Profile tab's own stack — this is
    // React Navigation's standard cross-tab navigation call, not a
    // custom mechanism.
    (navigation as any).getParent()?.navigate("Profile", { screen: "Notifications" });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.topBar, { backgroundColor: colors.card, borderBottomColor: colors.line }]}>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel="Open menu">
          <Menu size={20} color={colors.ink} />
        </TouchableOpacity>
        <Image source={require("../../assets/logo-wordmark.jpg")} style={styles.wordmark} resizeMode="contain" />
        <View style={styles.topActions}>
          <TouchableOpacity onPress={openNotifications} hitSlop={10} accessibilityLabel="Notifications">
            <Bell size={20} color={colors.ink} />
            {!!unread && unread > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setHelpOpen(true)} hitSlop={10} accessibilityLabel="Help" style={[styles.helpBtn, { backgroundColor: colors.brandNavy }]}>
            <Headphones size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.line }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <SearchIcon size={15} color={colors.inkSoft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            autoFocus={!!route.params?.autoFocus}
            placeholder="Search by location, estate, or keyword"
            placeholderTextColor={colors.inkSoft}
            returnKeyType="search"
            style={[styles.searchPlaceholder, { color: colors.ink, flex: 1, padding: 0 }]}
          />
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

        {type && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeRow}>
            {sortOptions.length > 1 && (
              <TouchableOpacity
                onPress={() => setSortBy(sortOptions[(sortOptions.findIndex((o) => o.value === sortBy) + 1) % sortOptions.length].value)}
                style={[styles.rangeChip, { borderColor: colors.accent }]}
                accessibilityLabel="Change sort order"
              >
                <Text style={[styles.rangeChipText, { color: colors.accent }]}>{sortOptions.find((o) => o.value === sortBy)?.label}</Text>
              </TouchableOpacity>
            )}
            {PRICE_RANGES[type].map((r) => {
              const on = rangeLabel === r.label;
              return (
                <TouchableOpacity
                  key={r.label}
                  onPress={() => setRangeLabel(on ? null : r.label)}
                  style={[styles.rangeChip, { borderColor: on ? colors.accent : colors.line }, on && { backgroundColor: colors.accent }]}
                >
                  <Text style={[styles.rangeChipText, { color: on ? "#fff" : colors.inkSoft }]}>{r.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {error && (
        <View style={{ padding: 16, gap: 8 }}>
          <Text style={[styles.errorText, { color: "#B4432E", padding: 0 }]}>We couldn't load listings right now.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 }}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        onEndReachedThreshold={0.5}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        refreshControl={<RefreshControl refreshing={isRefetching && !isFetchingNextPage} onRefresh={() => refetch()} tintColor={colors.accent} />}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} /> : null}
        ListHeaderComponent={
          <View style={{ gap: 18 }}>
            <ExploreByLocation onSelect={(area) => { setType(undefined); setQuery(area); }} />
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>{query.trim() || type ? "Results" : "Verified & Recommended"}</Text>
              {(!!query.trim() || !!type) && (
                <TouchableOpacity onPress={() => { setQuery(""); setType(undefined); }}>
                  <Text style={{ color: colors.accent, fontSize: 12.5, fontWeight: "600" }}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 14 }} accessibilityLabel="Loading listings">
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
                  <View style={[styles.cardImage, { backgroundColor: colors.line }]} />
                  <View style={{ padding: 12, gap: 8 }}>
                    <View style={{ height: 14, width: "60%", borderRadius: 6, backgroundColor: colors.line }} />
                    <View style={{ height: 11, width: "40%", borderRadius: 6, backgroundColor: colors.line }} />
                  </View>
                </View>
              ))}
            </View>
          ) : !error ? (
            <View style={{ alignItems: "center", paddingVertical: 40, gap: 6 }}>
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "600" }}>No listings match yet</Text>
              <Text style={{ color: colors.inkSoft, fontSize: 12.5 }}>Try a different area or clear some filters.</Text>
              {(!!query.trim() || !!type || !!rangeLabel) && (
                <TouchableOpacity onPress={() => { setQuery(""); setType(undefined); setRangeLabel(null); }} style={{ marginTop: 8 }}>
                  <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 }}>Clear all filters</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={{ padding: 14, gap: 14 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}
            onPress={() => navigation.navigate("ListingDetail", { id: item.id })}
          >
            <View style={[styles.cardImage, { backgroundColor: colors.brandNavy }]}>
              {(item as any).photos?.[0]?.url ? (
                <Image source={{ uri: (item as any).photos[0].url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : null}
              {item.realtorProfile.verificationStatus === "VERIFIED" && (
                <View style={[styles.pill, { backgroundColor: colors.accent }]}>
                  <Text style={styles.pillText}>VERIFIED REALTOR</Text>
                </View>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.card }]}
                onPress={() => toggleSave.mutate({ listingId: item.id })}
                accessibilityLabel="Save listing"
              >
                <Heart size={14} color={colors.accent} fill={savedIds?.includes(item.id) ? colors.accent : "none"} />
              </TouchableOpacity>
            </View>
            <View style={{ padding: 12 }}>
              <View style={styles.priceRow}>
              <Text style={[styles.price, { color: colors.ink }]}>
                {formatNaira(Number(item.priceNaira))}
                {item.type === "RENT" && <Text style={[styles.priceUnit, { color: colors.inkSoft }]}> /year</Text>}
              </Text>
                <Text style={[styles.typeTag, { color: colors.accent, borderColor: colors.line }]}>{TYPE_LABELS[item.type] ?? item.type}</Text>
              </View>
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
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} items={menuItems} />
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
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
  rangeRow: { gap: 8, paddingTop: 14, paddingRight: 8 },
  rangeChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  rangeChipText: { fontSize: 12, fontWeight: "600" },
  chipRow: { flexDirection: "row", justifyContent: "space-between" },
  categoryItem: { alignItems: "center", gap: 5, width: 60 },
  categoryIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  categoryLabel: { fontSize: 10, fontWeight: "500", textAlign: "center" },
  errorText: { fontSize: 12, padding: 16 },
  card: { borderRadius: 18, overflow: "hidden", borderWidth: 1 },
  cardImage: { height: 140 },
  saveBtn: { position: "absolute", top: 10, right: 10, width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  price: { fontSize: 18, fontWeight: "600" },
  priceUnit: { fontSize: 11, fontWeight: "400" },
  cardTitle: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12 },
  metaMono: { fontSize: 11 },
  topActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  badge: { position: "absolute", top: -6, right: -8, minWidth: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  helpBtn: { width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  pill: { position: "absolute", bottom: 10, left: 10, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4 },
  pillText: { color: "#fff", fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeTag: { fontSize: 11, fontWeight: "600", borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" },
});
