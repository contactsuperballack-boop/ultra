import React, { useState } from "react";
import { View, Text, ScrollView, Image, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, Share } from "react-native";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, MapPin, BedDouble, Bath, Ruler, Check, Heart, Share2, ChevronDown, ChevronUp, ShieldCheck } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useSaveToggle } from "../lib/useSaveToggle";
import { useTheme } from "../themeContext/ThemeContext";
import type { ListingDetailParams, RealtorProfileParams } from "../navigation/types";

function formatNaira(n: number) {
  return n >= 1_000_000 ? `\u20a6${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `\u20a6${n.toLocaleString()}`;
}

// Typed against the generic shape rather than one specific stack's
// ParamList — this screen is pushed from both SearchStack and SavedStack,
// and now also pushes RealtorProfile onward from here.
type NavParams = { ListingDetail: ListingDetailParams; RealtorProfile: RealtorProfileParams };

const OWNERSHIP_EVIDENCE_LABELS: Record<string, string> = {
  OWNER_LISTING: "Listed by the property owner",
  AUTHORIZED_AGENT: "Listed by an authorized agent",
  AGENCY_MANDATE: "Listed under an agency mandate",
  DEVELOPER_LISTING: "Listed by the developer",
  LAND_REPRESENTATIVE: "Listed by a land representative",
  PENDING: "Property evidence pending review",
};

// Sprint B: migrated to useTheme(). Sprint C: rebuilt closer to the
// mockup's actual screen 3 — real photo rendering (was a solid color
// block; listing.photos was already fetched and simply unused), a
// verified badge overlay, share, an expandable description, an
// expandable "Verified by ULTRA" section backed by real fields
// (listingReviewed/ownershipEvidence, not decorative), and a tappable
// realtor row that pushes the new RealtorProfileScreen.
//
// Disclosed simplification: the mockup shows two separate CTAs ("Chat
// with Realtor" / "Request Inquiry"). This app has exactly one buyer-
// realtor contact mechanism (Blueprint §10/§12's single in-app messaging
// channel) — there's no second, distinct "chat" feature to wire a second
// button to. Building a cosmetic second button that does the same thing
// as the first would be worse than one honest CTA, so this keeps the
// single message box rather than fabricating a distinction the data
// model doesn't have.
export function ListingDetailScreen() {
  const route = useRoute<RouteProp<NavParams, "ListingDetail">>();
  const navigation = useNavigation<NativeStackNavigationProp<NavParams>>();
  const { colors } = useTheme();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [verifyExpanded, setVerifyExpanded] = useState(false);

  const { data: listing, isLoading } = trpc.listings.byId.useQuery({ id: route.params.id });
  const inquire = trpc.inquiries.create.useMutation({ onSuccess: () => setSent(true) });

  const { data: savedIds } = trpc.savedListings.ids.useQuery(undefined, { retry: false });
  const toggleSave = useSaveToggle(() =>
    Alert.alert("Sign in required", "Sign in from the Profile tab to save listings.")
  );

  if (isLoading || !listing) {
    return (
      <View style={[styles.container, { backgroundColor: colors.card, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const isSaved = !!savedIds?.includes(listing.id);
  const verified = listing.realtorProfile.verificationStatus === "VERIFIED";
  const photoCount = listing.photos?.length ?? 0;
  const description: string = listing.description;
  const descIsLong = description.length > 180;
  const shownDescription = descExpanded || !descIsLong ? description : description.slice(0, 180) + "\u2026";

  function shareListing() {
    Share.share({ message: `${listing.title} \u2014 ${formatNaira(Number(listing.priceNaira))} on ULTRA` }).catch(() => {});
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={[styles.hero, { backgroundColor: colors.brandNavy }]}>
        {photoCount > 0 ? (
          <Image source={{ uri: listing.photos[0].url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}

        <TouchableOpacity style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.92)" }]} onPress={() => navigation.goBack()}>
          <ChevronLeft size={18} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.heroActions}>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.92)" }]} onPress={shareListing}>
            <Share2 size={15} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { backgroundColor: "rgba(255,255,255,0.92)" }]} onPress={() => toggleSave.mutate({ listingId: listing.id })}>
            <Heart size={16} color={colors.accent} fill={isSaved ? colors.accent : "none"} />
          </TouchableOpacity>
        </View>

        {verified && (
          <View style={[styles.verifiedPill, { backgroundColor: colors.accent }]}>
            <Check size={10} color="#fff" strokeWidth={3} />
            <Text style={styles.verifiedPillText}>VERIFIED</Text>
          </View>
        )}
        {photoCount > 0 && (
          <View style={styles.photoCounter}>
            <Text style={styles.photoCounterText}>1/{photoCount}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 100 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.price, { color: colors.ink }]}>
              {formatNaira(Number(listing.priceNaira))}
              {listing.type === "RENT" && <Text style={[styles.priceUnit, { color: colors.inkSoft }]}> /year</Text>}
            </Text>
            <Text style={[styles.title, { color: colors.ink }]}>{listing.title}</Text>
            <View style={styles.row}>
              <MapPin size={13} color={colors.inkSoft} />
              <Text style={[styles.metaText, { color: colors.inkSoft }]}>{listing.area}, {listing.city}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.row, { gap: 10, marginTop: 18 }]}>
          {listing.bedrooms != null && (
            <View style={[styles.statBox, { backgroundColor: colors.bg }]}>
              <BedDouble size={16} color={colors.accent} />
              <Text style={[styles.statText, { color: colors.ink }]}>{listing.bedrooms} Beds</Text>
            </View>
          )}
          {listing.bathrooms != null && (
            <View style={[styles.statBox, { backgroundColor: colors.bg }]}>
              <Bath size={16} color={colors.accent} />
              <Text style={[styles.statText, { color: colors.ink }]}>{listing.bathrooms} Baths</Text>
            </View>
          )}
          <View style={[styles.statBox, { backgroundColor: colors.bg }]}>
            <Ruler size={16} color={colors.accent} />
            <Text style={[styles.statText, { color: colors.ink }]}>{listing.sizeSqm}m\u00b2</Text>
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.ink }]}>About this property</Text>
        <Text style={[styles.description, { color: colors.inkSoft }]}>{shownDescription}</Text>
        {descIsLong && (
          <TouchableOpacity onPress={() => setDescExpanded((v) => !v)} style={styles.readMoreRow}>
            <Text style={[styles.readMore, { color: colors.accent }]}>{descExpanded ? "Read less" : "Read more"}</Text>
            {descExpanded ? <ChevronUp size={13} color={colors.accent} /> : <ChevronDown size={13} color={colors.accent} />}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.verifyRow, { borderColor: colors.line }]}
          onPress={() => setVerifyExpanded((v) => !v)}
        >
          <View style={[styles.verifyIconWrap, { backgroundColor: colors.accentSoft }]}>
            <ShieldCheck size={16} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.verifyTitle, { color: colors.ink }]}>Verified by ULTRA</Text>
            <Text style={[styles.verifySubtitle, { color: colors.inkSoft }]}>
              {(listing as any).listingReviewed ? "This listing has passed our review checks." : "Review pending."}
            </Text>
          </View>
          {verifyExpanded ? <ChevronUp size={15} color={colors.inkSoft} /> : <ChevronDown size={15} color={colors.inkSoft} />}
        </TouchableOpacity>
        {verifyExpanded && (
          <View style={[styles.verifyDetail, { backgroundColor: colors.bg }]}>
            <Text style={[styles.verifyDetailText, { color: colors.inkSoft }]}>
              {OWNERSHIP_EVIDENCE_LABELS[(listing as any).ownershipEvidence] ?? OWNERSHIP_EVIDENCE_LABELS.PENDING}
              {(listing as any).lastReviewedAt ? ` \u00b7 Last reviewed ${new Date((listing as any).lastReviewedAt).toLocaleDateString()}.` : ""}
              {" "}This reflects what ULTRA's admin team was shown, not independent confirmation against a land registry.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.realtorCard, { borderColor: colors.line }]}
          onPress={() => navigation.navigate("RealtorProfile", { id: listing.realtorProfile.id })}
        >
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>
              {listing.realtorProfile.agencyName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Text style={[styles.realtorName, { color: colors.ink }]}>{listing.realtorProfile.agencyName}</Text>
              {verified && (
                <View style={[styles.sealSm, { backgroundColor: "#D2A03E" }]}>
                  <Check size={8} color="#fff" strokeWidth={3} />
                </View>
              )}
            </View>
            <Text style={[styles.metaText, { color: colors.inkSoft }]}>{listing.realtorProfile.rating ?? "\u2014"} rating \u00b7 View profile</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.inquiryBar, { borderTopColor: colors.line, backgroundColor: colors.card }]}>
        {sent ? (
          <Text style={[styles.sentText, { color: colors.accent }]}>Message sent \u2014 you'll hear back soon.</Text>
        ) : (
          <>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ask about this property\u2026"
              placeholderTextColor={colors.inkSoft}
              style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
            />
            <TouchableOpacity
              disabled={inquire.isPending || !message.trim()}
              onPress={() => inquire.mutate({ listingId: listing.id, message })}
              style={[styles.sendBtn, { backgroundColor: colors.accent }, (inquire.isPending || !message.trim()) && { opacity: 0.5 }]}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { height: 240, overflow: "hidden" },
  backBtn: { position: "absolute", top: 16, left: 16, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  heroActions: { position: "absolute", top: 16, right: 16, flexDirection: "row", gap: 8 },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  verifiedPill: { position: "absolute", bottom: 14, left: 14, flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  verifiedPillText: { color: "#fff", fontSize: 9, fontWeight: "700", letterSpacing: 0.4 },
  photoCounter: { position: "absolute", bottom: 14, right: 14, backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  photoCounterText: { color: "#fff", fontSize: 10.5, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
  price: { fontSize: 24, fontWeight: "600" },
  priceUnit: { fontSize: 12, fontWeight: "400" },
  title: { fontSize: 15, fontWeight: "600", marginTop: 4 },
  metaText: { fontSize: 12.5 },
  statBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 4 },
  statText: { fontSize: 11.5 },
  sectionLabel: { fontSize: 14, fontWeight: "600", marginTop: 22, marginBottom: 6 },
  description: { fontSize: 13, lineHeight: 20 },
  readMoreRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  readMore: { fontSize: 12, fontWeight: "600" },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 20 },
  verifyIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  verifyTitle: { fontSize: 13, fontWeight: "600" },
  verifySubtitle: { fontSize: 11, marginTop: 1 },
  verifyDetail: { borderRadius: 12, padding: 12, marginTop: 6 },
  verifyDetailText: { fontSize: 11.5, lineHeight: 17 },
  realtorCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 16 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "600", fontSize: 13 },
  sealSm: { width: 12, height: 12, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  realtorName: { fontSize: 13, fontWeight: "600" },
  inquiryBar: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13.5 },
  sendBtn: { borderRadius: 12, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  sendBtnText: { color: "#fff", fontWeight: "600", fontSize: 13.5 },
  sentText: { fontSize: 13, flex: 1 },
});
