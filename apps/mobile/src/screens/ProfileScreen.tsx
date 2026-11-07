import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Bell, ChevronRight, Settings as SettingsIcon, HelpCircle } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { session } from "../lib/session";
import { COLORS } from "../theme";
import { SignInScreen } from "./SignInScreen";
import type { ProfileStackParamList } from "./ProfileStack";

export function ProfileScreen() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const utils = trpc.useUtils();
  const deregisterPush = trpc.notifications.deregisterPushToken.useMutation();

  const checkSession = useCallback(async () => {
    const { accessToken } = await session.get();
    setSignedIn(!!accessToken);
    setChecked(true);
  }, []);

  useFocusEffect(useCallback(() => { checkSession(); }, [checkSession]));

  if (!checked) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={COLORS.green} />
      </View>
    );
  }

  if (!signedIn) {
    return <SignInScreen onSignedIn={() => { setSignedIn(true); utils.invalidate(); }} />;
  }

  return (
    <SignedInProfile
      onSignOut={async () => {
        // Deregister BEFORE clearing the session — the mutation needs a
        // valid auth header, which disappears the moment session.clear()
        // runs. Best-effort: a failure here (e.g. offline) shouldn't block
        // sign-out itself, just means the token lingers a bit longer.
        await deregisterPush.mutateAsync().catch(() => {});
        await session.clear();
        setSignedIn(false);
      }}
    />
  );
}

function SignedInProfile({ onSignOut }: { onSignOut: () => void }) {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { data: me, isLoading } = trpc.auth.me.useQuery();
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator color={COLORS.green} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.avatarRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(me?.name ?? "?").slice(0, 2).toUpperCase()}</Text>
        </View>
        <View>
          <Text style={styles.name}>{me?.name}</Text>
          <Text style={styles.meta}>{me?.phone}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("Notifications")}>
        <Bell size={16} color={COLORS.inkSoft} />
        <Text style={styles.rowLabel}>Notifications</Text>
        {!!unreadCount && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
        <ChevronRight size={15} color={COLORS.inkSoft} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("Settings")}>
        <SettingsIcon size={16} color={COLORS.inkSoft} />
        <Text style={styles.rowLabel}>Settings</Text>
        <ChevronRight size={15} color={COLORS.inkSoft} />
      </TouchableOpacity>

      {/* Priority-checklist fix — mobile had no support-contact surface at
          all (web's SiteFooter already had one — confirmed while
          re-checking the earlier audit's claim, which turned out to only
          be true for mobile, not web; corrected accordingly). Same
          WhatsApp number as web's footer, kept in one place conceptually
          even though the two platforms can't literally share a component. */}
      <TouchableOpacity
        style={styles.row}
        onPress={() => Linking.openURL("https://wa.me/2348000000000").catch(() => {})}
      >
        <HelpCircle size={16} color={COLORS.inkSoft} />
        <Text style={styles.rowLabel}>Help & Support</Text>
        <ChevronRight size={15} color={COLORS.inkSoft} />
      </TouchableOpacity>

      <TouchableOpacity onPress={onSignOut} style={styles.signOutBtn}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16, paddingTop: 60 },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.green, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  name: { fontSize: 17, fontWeight: "600", color: COLORS.ink },
  meta: { fontSize: 12, color: COLORS.inkSoft },
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, padding: 14, marginBottom: 20 },
  rowLabel: { flex: 1, fontSize: 13.5, color: COLORS.ink },
  badge: { backgroundColor: COLORS.gold, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginRight: 4 },
  badgeText: { color: "#fff", fontSize: 10.5, fontWeight: "700" },
  signOutBtn: { borderWidth: 1, borderColor: COLORS.line, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  signOutText: { fontSize: 13.5, color: "#B4432E", fontWeight: "600" },
});
