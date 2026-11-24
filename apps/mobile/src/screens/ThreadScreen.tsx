import React, { useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, Send, Check } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { InspectionCards } from "../components/InspectionCards";
import { useTheme } from "../themeContext/ThemeContext";
import type { MessagesStackParamList } from "./MessagesStack";

// Sprint B — migrated to useTheme().
export function ThreadScreen() {
  const route = useRoute<RouteProp<MessagesStackParamList, "Thread">>();
  const navigation = useNavigation<NativeStackNavigationProp<MessagesStackParamList>>();
  const { colors } = useTheme();
  const [draft, setDraft] = useState("");

  const utils = trpc.useUtils();
  // Now uses a dedicated single-thread query instead of re-fetching and
  // filtering the entire myThreads list — see inquiries.byId's comment for
  // why (was fine at low thread counts, wasteful as a buyer's history grows).
  const { data: thread, isLoading } = trpc.inquiries.byId.useQuery({ id: route.params.inquiryId });

  const reply = trpc.inquiries.reply.useMutation({
    // Optimistic send: the message appears immediately rather than after
    // the round trip, which previously felt slow on a poor connection.
    // ThreadScreen is buyer-only (mobile has no realtor UI), so the
    // optimistic message's sender is always thread.buyerId.
    onMutate: async ({ message }) => {
      await utils.inquiries.byId.cancel({ id: route.params.inquiryId });
      const previous = utils.inquiries.byId.getData({ id: route.params.inquiryId });
      if (previous) {
        utils.inquiries.byId.setData({ id: route.params.inquiryId }, {
          ...previous,
          messages: [
            ...previous.messages,
            { id: `optimistic-${Date.now()}`, inquiryId: previous.id, senderId: previous.buyerId, body: message, createdAt: new Date() },
          ],
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) utils.inquiries.byId.setData({ id: route.params.inquiryId }, context.previous);
    },
    onSuccess: () => setDraft(""),
    onSettled: () => {
      utils.inquiries.byId.invalidate({ id: route.params.inquiryId });
      utils.inquiries.myThreads.invalidate(); // thread list's "last message" preview also needs refreshing
    },
  });

  if (isLoading || !thread) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const verified = thread.listing.realtorProfile.verificationStatus === "VERIFIED";

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.line }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.avatarText, { color: colors.accent }]}>
            {thread.listing.realtorProfile.agencyName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={[styles.name, { color: colors.ink }]}>{thread.listing.realtorProfile.agencyName}</Text>
            {verified && (
              <View style={[styles.seal, { backgroundColor: "#D2A03E" }]}>
                <Check size={8} color="#fff" strokeWidth={3} />
              </View>
            )}
          </View>
          <Text style={[styles.listing, { color: colors.inkSoft }]} numberOfLines={1}>{thread.listing.title}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        {thread.messages.map((m: any) => {
          const mine = m.senderId === thread.buyerId;
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                mine ? { alignSelf: "flex-end", backgroundColor: colors.accent, borderBottomRightRadius: 4 }
                     : { alignSelf: "flex-start", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 4 },
              ]}
            >
              <Text style={{ color: mine ? "#fff" : colors.ink, fontSize: 13 }}>{m.body}</Text>
            </View>
          );
        })}
        <InspectionCards inquiryId={route.params.inquiryId} />
      </ScrollView>

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.line }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message the realtor\u2026"
          placeholderTextColor={colors.inkSoft}
          style={[styles.input, { borderColor: colors.line, color: colors.ink }]}
        />
        <TouchableOpacity
          disabled={reply.isPending || !draft.trim()}
          onPress={() => reply.mutate({ inquiryId: thread.id, message: draft.trim() })}
          style={[styles.sendBtn, { backgroundColor: colors.accent }, (reply.isPending || !draft.trim()) && { opacity: 0.5 }]}
        >
          <Send size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "600", fontSize: 12 },
  name: { fontSize: 13.5, fontWeight: "600" },
  seal: { width: 12, height: 12, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  listing: { fontSize: 11 },
  bubble: { maxWidth: "78%", paddingHorizontal: 13, paddingVertical: 9, borderRadius: 16 },
  inputBar: { flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 13 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
