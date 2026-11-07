import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, Check, Star, Calendar, Briefcase, ShieldCheck } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";
import type { RealtorProfileParams, ListingDetailParams } from "../navigation/types";

function formatNaira(n: number) {
  return n >= 1_000_000 ? `\u20a6${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${n.toLocaleString()}`;
}

type NavParams = { RealtorProfile: RealtorProfileParams; ListingDetail: ListingDetailParams };

// Sprint C — mockup screen 4. Genuinely new: nothing in the mobile app
// previously let a buyer view a realtor's public profile at all, only
// the inline agency name on a listing's own detail page. Built against
// realtors.byId, which had the exact same public-data leak as every
// other endpoint fixed in the Phase 1 remediation pass — closed as part
// of building this screen, not left for later, since this is the first
// real consumer of that endpoint.
//
// Disclosed gap: the mockup shows an "About" bio for the realtor.
// RealtorProfile has no bio field in the schema (ProviderProfile does,
// realtors don't) — rather than fabricate placeholder copy, that section
// is simply omitted here until a real field/edit flow exists.
export function RealtorProfileScreen() {
  const route = useRoute<RouteProp<NavParams, "RealtorProfile">>();
  const navigation = useNavigation<NativeStackNavigationProp<NavParams>>();
  const { colors } = useTheme();

  const { data: profile, isLoading } = trpc.realtors.byId.useQuery({ id: route.params.id });

  if (isLoading || !profile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const verified = profile.verificationStatus === "VERIFIED";
  const yearsOnUltra = Math.max(1, Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (365 * 24 * 60 * 60 * 1000)));

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { borderBottomColor: colors.line, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <View style={{ padding: 18 }}>
        <View style={styles.topRow}>
          <View>
            {verified && <Text style={[styles.verifiedLabel, { color: colors.accent }]}>Verified Realtor</Text>}
            <Text style={[styles.agencyName, { color: colors.ink }]}>{profile.agencyName}</Text>
          </View>
          {verified && (
            <View style={[styles.shield, { backgroundColor: colors.brandNavy }]}>
              <ShieldCheck size={20} color="#fff" />
              <Check size={11} color="#D2A03E" strokeWidth={4} style={styles.shieldCheck} />
            </View>
          )}
        </View>

        <View style={[styles.statsRow, { borderColor: colors.line }]}>
          <View style={styles.statCol}>
            <View style={styles.statHead}>
              <Star size={13} color="#D2A03E" />
              <Text style={[styles.statValue, { color: colors.ink }]}>{profile.rating ?? "New"}</Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.inkSoft }]}>Rating</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
          <View style={styles.statCol}>
            <View style={styles.statHead}>
              <Calendar size={13} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.ink }]}>{yearsOnUltra}+ yrs</Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.inkSoft }]}>On ULTRA</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.line }]} />
          <View style={styles.statCol}>
            <View style={styles.statHead}>
              <Briefcase size={13} color={colors.accent} />
              <Text style={[styles.statValue, { color: colors.ink }]}>{profile.dealsClosed}</Text>
            </View>
            <Text style={[styles.statLabel, { color: colors.inkSoft }]}>Deals closed</Text>
          </View>
        </View>

        <View style={styles.listingsHead}>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>Listings</Text>
          <Text style={[styles.listingCount, { color: colors.inkSoft }]}>{profile.listings.length} live</Text>
        </View>

        {profile.listings.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.inkSoft }]}>No live listings from this realtor right now.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {profile.listings.map((l: any) => (
              <TouchableOpacity
                key={l.id}
                style={[styles.listingCard, { backgroundColor: colors.card, borderColor: colors.line }]}
                onPress={() => navigation.navigate("ListingDetail", { id: l.id })}
              >
                {l.photos?.[0]?.url ? (
                  <Image source={{ uri: l.photos[0].url }} style={styles.listingImage} />
                ) : (
                  <View style={[styles.listingImage, { backgroundColor: colors.brandNavy }]} />
                )}
                <View style={{ padding: 9 }}>
                  <Text style={[styles.listingPrice, { color: colors.ink }]}>{formatNaira(Number(l.priceNaira))}</Text>
                  <Text style={[styles.listingTitle, { color: colors.ink }]} numberOfLines={1}>{l.title}</Text>
                  <Text style={[styles.listingArea, { color: colors.inkSoft }]} numberOfLines={1}>{l.area}, Abuja</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={[styles.contactBox, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.contactText, { color: colors.accent }]}>
            All communication is kept in-app for your safety \u2014 message this realtor from any of their listings.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 54, paddingBottom: 14, borderBottomWidth: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  verifiedLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  agencyName: { fontSize: 20, fontWeight: "700" },
  shield: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  shieldCheck: { position: "absolute", bottom: -2, right: -2 },
  statsRow: { flexDirection: "row", borderWidth: 1, borderRadius: 14, marginTop: 18, paddingVertical: 14 },
  statCol: { flex: 1, alignItems: "center" },
  statDivider: { width: 1 },
  statHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  statValue: { fontSize: 14, fontWeight: "700" },
  statLabel: { fontSize: 10, marginTop: 3 },
  listingsHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 26, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  listingCount: { fontSize: 11.5 },
  emptyText: { fontSize: 12.5 },
  listingCard: { width: 150, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  listingImage: { height: 90, width: "100%" },
  listingPrice: { fontSize: 13, fontWeight: "700" },
  listingTitle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  listingArea: { fontSize: 10, marginTop: 1 },
  contactBox: { borderRadius: 14, padding: 14, marginTop: 26, marginBottom: 20 },
  contactText: { fontSize: 12, lineHeight: 17 },
});
