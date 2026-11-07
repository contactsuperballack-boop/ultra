import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, Check, Star } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";
import type { SearchStackParamList } from "./SearchStack";

const CATEGORY_LABELS: Record<string, string> = {
  PAINTING: "Painting",
  PLUMBING: "Plumbing",
  FUMIGATION: "Fumigation",
  ELECTRICAL: "Electrical",
};
const PRICE_TYPE_LABELS: Record<string, string> = { FIXED: "Fixed price", HOURLY: "Per hour", QUOTE: "Quote on request" };

function formatNaira(n: number | null) {
  if (n === null) return "\u2014";
  return `\u20a6${n.toLocaleString()}`;
}

// Mobile port of apps/web/app/(public)/services/[id]/page.tsx.
export function ServiceProviderDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SearchStackParamList>>();
  const route = useRoute<RouteProp<SearchStackParamList, "ServiceProviderDetail">>();
  const { colors } = useTheme();

  const { data: provider, isLoading } = trpc.providers.byId.useQuery({ id: route.params.id });
  const [selectedOfferingId, setSelectedOfferingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const request = trpc.serviceRequests.create.useMutation({ onSuccess: () => setSent(true) });

  if (isLoading || !provider) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const selectedOffering = provider.offerings.find((o: any) => o.id === selectedOfferingId) ?? provider.offerings[0];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={[styles.topBar, { borderBottomColor: colors.line, backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ width: 22 }} />
      </View>

      <View style={{ padding: 18 }}>
        <View style={styles.profileRow}>
          <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.avatarText, { color: colors.accent }]}>
              {provider.businessName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.businessName, { color: colors.ink }]}>{provider.businessName}</Text>
              <View style={[styles.seal, { backgroundColor: "#D2A03E" }]}>
                <Check size={11} color="#fff" strokeWidth={3} />
              </View>
            </View>
            <View style={styles.row}>
              <Star size={12} color="#D2A03E" />
              <Text style={[styles.ratingText, { color: colors.inkSoft }]}>
                {provider.rating ?? "New"} \u00b7 {provider.serviceArea}
              </Text>
            </View>
          </View>
        </View>

        {!!provider.bio && <Text style={[styles.bio, { color: colors.inkSoft }]}>{provider.bio}</Text>}

        <Text style={[styles.sectionLabel, { color: colors.ink }]}>Offerings</Text>
        {provider.offerings.map((o: any) => {
          const selected = (selectedOfferingId ?? provider.offerings[0]?.id) === o.id;
          return (
            <TouchableOpacity
              key={o.id}
              onPress={() => {
                setSelectedOfferingId(o.id);
                setSent(false);
              }}
              style={[
                styles.offeringCard,
                { borderColor: colors.line },
                selected && { borderColor: colors.accent, backgroundColor: colors.accentSoft },
              ]}
            >
              <View style={styles.offeringTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.offeringTitle, { color: colors.ink }]}>{o.title}</Text>
                  <Text style={[styles.offeringCategory, { color: colors.inkSoft }]}>{CATEGORY_LABELS[o.category]}</Text>
                </View>
                <Text style={[styles.offeringPrice, { color: colors.ink }]}>
                  {o.priceNaira ? formatNaira(Number(o.priceNaira)) : PRICE_TYPE_LABELS[o.priceType]}
                </Text>
              </View>
              <Text style={[styles.offeringDescription, { color: colors.inkSoft }]}>{o.description}</Text>
            </TouchableOpacity>
          );
        })}

        {provider.offerings.length > 0 && (
          <View style={{ marginTop: 20 }}>
            {sent ? (
              <View style={[styles.successBox, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontSize: 12.5 }}>
                  Request sent — {provider.businessName} will respond in-app with a price and schedule.
                </Text>
              </View>
            ) : (
              <>
                <Text style={[styles.sectionLabel, { color: colors.ink }]}>Describe the job</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="e.g. 3-bedroom flat, need full interior repaint"
                  placeholderTextColor={colors.inkSoft}
                  style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
                  multiline
                />
                <TouchableOpacity
                  disabled={request.isPending || note.trim().length < 10 || !selectedOffering}
                  onPress={() =>
                    request.mutate({
                      providerProfileId: provider.id,
                      offeringId: selectedOffering?.id,
                      category: selectedOffering?.category,
                      note,
                    })
                  }
                  style={[styles.requestBtn, { backgroundColor: colors.accent }, (note.trim().length < 10 || request.isPending) && { opacity: 0.5 }]}
                >
                  <Text style={styles.requestBtnText}>{request.isPending ? "Sending\u2026" : "Request"}</Text>
                </TouchableOpacity>
              </>
            )}
            {request.error && <Text style={styles.errorText}>{request.error.message}</Text>}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 54, paddingBottom: 14, borderBottomWidth: 1 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  businessName: { fontSize: 18, fontWeight: "700" },
  seal: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  ratingText: { fontSize: 12.5 },
  bio: { fontSize: 13, lineHeight: 19, marginBottom: 18 },
  sectionLabel: { fontSize: 13, fontWeight: "600", marginBottom: 8, marginTop: 4 },
  offeringCard: { borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 8 },
  offeringTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  offeringTitle: { fontSize: 13.5, fontWeight: "600" },
  offeringCategory: { fontSize: 10.5, marginTop: 2 },
  offeringPrice: { fontSize: 13.5, fontWeight: "600" },
  offeringDescription: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  successBox: { borderRadius: 14, padding: 14 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 13, minHeight: 60, textAlignVertical: "top", marginBottom: 10 },
  requestBtn: { borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  requestBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  errorText: { color: "#B4432E", fontSize: 12, marginTop: 8 },
});
