import React from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check, MessageCircle } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";
import type { MessagesStackParamList } from "./MessagesStack";

// Sprint B — migrated to useTheme().
export function ThreadListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MessagesStackParamList>>();
  const { colors } = useTheme();
  const { data: threads, isLoading, error } = trpc.inquiries.myThreads.useQuery();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Messages</Text>

      {error && (
        <Text style={[styles.errorText, { color: colors.inkSoft }]}>
          {error.message === "Sign in required." ? "Sign in from the Profile tab to see your messages." : error.message}
        </Text>
      )}

      {!error && threads?.length === 0 && (
        <View style={styles.empty}>
          <MessageCircle size={26} color={colors.inkSoft} style={{ opacity: 0.5, marginBottom: 10 }} />
          <Text style={[styles.emptyText, { color: colors.inkSoft }]}>Message a realtor from any listing to start a conversation.</Text>
        </View>
      )}

      <FlatList
        data={threads ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        renderItem={({ item: thread }) => {
          const last = thread.messages[thread.messages.length - 1];
          const verified = thread.listing.realtorProfile.verificationStatus === "VERIFIED";
          return (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: colors.card, borderColor: colors.line }]}
              onPress={() => navigation.navigate("Thread", { inquiryId: thread.id })}
            >
              <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.avatarText, { color: colors.accent }]}>
                  {thread.listing.realtorProfile.agencyName.split(" ").map((w: string) => w[0]).slice(0, 2).join("")}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowHead}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Text style={[styles.name, { color: colors.ink }]}>{thread.listing.realtorProfile.agencyName}</Text>
                    {verified && (
                      <View style={[styles.seal, { backgroundColor: "#D2A03E" }]}>
                        <Check size={8} color="#fff" strokeWidth={3} />
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.listing, { color: colors.inkSoft }]}>{thread.listing.title}</Text>
                {last && (
                  <Text style={[styles.lastMsg, { color: colors.ink }]} numberOfLines={1}>
                    {last.senderId === thread.buyerId ? "You: " : ""}
                    {last.body}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
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
  row: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "flex-start" },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontWeight: "600", fontSize: 12 },
  rowHead: { flexDirection: "row", justifyContent: "space-between" },
  name: { fontSize: 13, fontWeight: "600" },
  seal: { width: 12, height: 12, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  listing: { fontSize: 11, marginTop: 1 },
  lastMsg: { fontSize: 12.5, marginTop: 4 },
});
