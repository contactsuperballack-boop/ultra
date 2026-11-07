import React from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, Bell } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";

function timeAgo(date: string | Date) {
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

// Sprint B — migrated to useTheme().
export function NotificationsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const utils = trpc.useUtils();
  // MVP review — was hard-capped at 50 with no way to page further back.
  // FlatList's onEndReached is the native mobile equivalent of the "load
  // more" button used on the web version of this same fix.
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = trpc.notifications.list.useInfiniteQuery(
    {},
    { getNextPageParam: (lastPage) => lastPage.nextCursor }
  );
  const notifications = data?.pages.flatMap((p) => p.items);
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });
  const markAllRead = trpc.notifications.markAllRead.useMutation({ onSuccess: () => utils.notifications.list.invalidate() });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.line }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={19} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>Notifications</Text>
        <TouchableOpacity onPress={() => markAllRead.mutate()}>
          <Text style={[styles.markAll, { color: colors.accent }]}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      {isLoading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />}

      {!isLoading && notifications?.length === 0 && (
        <View style={styles.empty}>
          <Bell size={26} color={colors.inkSoft} style={{ opacity: 0.5, marginBottom: 10 }} />
          <Text style={[styles.emptyText, { color: colors.inkSoft }]}>Nothing yet — you'll see message and verification updates here.</Text>
        </View>
      )}

      <FlatList
        data={notifications ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 14, gap: 8 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        ListFooterComponent={isFetchingNextPage ? <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} /> : null}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.row,
              { backgroundColor: colors.card, borderColor: colors.line },
              !item.readAt && { borderColor: colors.accent },
            ]}
            onPress={() => !item.readAt && markRead.mutate({ id: item.id })}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.rowHead}>
                <Text style={[styles.rowTitle, { color: colors.ink }]}>{item.title}</Text>
                <Text style={[styles.rowTime, { color: colors.inkSoft }]}>{timeAgo(item.createdAt)}</Text>
              </View>
              <Text style={[styles.rowBody, { color: colors.inkSoft }]}>{item.body}</Text>
            </View>
            {!item.readAt && <View style={[styles.dot, { backgroundColor: "#D2A03E" }]} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: "600" },
  markAll: { fontSize: 11.5, fontWeight: "600" },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyText: { fontSize: 13, textAlign: "center" },
  row: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "flex-start" },
  rowHead: { flexDirection: "row", justifyContent: "space-between" },
  rowTitle: { fontSize: 13, fontWeight: "600" },
  rowTime: { fontSize: 10.5, fontFamily: "monospace" },
  rowBody: { fontSize: 12.5, marginTop: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
});
