import React from "react";
import { Switch, ActivityIndicator, View as RNView } from "react-native";
import { trpc } from "../lib/trpc";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, Check, Sun, Moon, Smartphone } from "lucide-react-native";
import { useTheme, type ThemeMode } from "../themeContext/ThemeContext";
import { useFont, FONT_OPTIONS, type FontKey } from "../themeContext/FontContext";
import type { ProfileStackParamList } from "./ProfileStack";

const MODE_OPTIONS: { key: ThemeMode; label: string; icon: typeof Sun }[] = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "Match device", icon: Smartphone },
];

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const { mode, setMode, colors } = useTheme();
  const { fontKey, setFontKey } = useFont();
  const utils = trpc.useUtils();
  const { data: preferences, isLoading: preferencesLoading } = trpc.notifications.preferences.useQuery();
  const updatePreferences = trpc.notifications.updatePreferences.useMutation({
    onSuccess: () => utils.notifications.preferences.invalidate(),
  });
  const preferenceRows = [
    { key: "push" as const, label: "Push notifications", description: "Alerts on this device" },
    { key: "email" as const, label: "Email updates", description: "Email delivery when enabled for your account" },
    { key: "sms" as const, label: "SMS updates", description: "Text messages when enabled for your account" },
    { key: "whatsapp" as const, label: "WhatsApp updates", description: "WhatsApp messages when enabled for your account" },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={[styles.sectionLabel, { color: colors.inkSoft }]}>NOTIFICATIONS</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
        {preferencesLoading ? (
          <RNView style={{ padding: 18, alignItems: "center" }}><ActivityIndicator color={colors.accent} /></RNView>
        ) : preferenceRows.map((item, index) => (
          <View key={item.key} style={[styles.preferenceRow, index < preferenceRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.optionLabel, { color: colors.ink }]}>{item.label}</Text>
              <Text style={[styles.helperText, { color: colors.inkSoft, marginTop: 3 }]}>{item.description}</Text>
            </View>
            <Switch
              value={preferences?.[item.key] ?? (item.key === "push")}
              disabled={updatePreferences.isPending || !preferences}
              onValueChange={(value) => updatePreferences.mutate({ [item.key]: value })}
              trackColor={{ true: colors.accent }}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.helperText, { color: colors.inkSoft }]}>
        In-app notification history remains available. Email, SMS and WhatsApp delivery depend on ULTRA enabling those channels.
      </Text>
      {updatePreferences.error && <Text style={{ color: "#B4432E", fontSize: 11, marginTop: 6 }}>{updatePreferences.error.message}</Text>}

      <Text style={[styles.sectionLabel, { color: colors.inkSoft, marginTop: 28 }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
        {MODE_OPTIONS.map((opt, i) => {
          const selected = mode === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setMode(opt.key)}
              style={[styles.optionRow, i < MODE_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
            >
              <opt.icon size={17} color={selected ? colors.accent : colors.inkSoft} />
              <Text style={[styles.optionLabel, { color: colors.ink }]}>{opt.label}</Text>
              {selected && <Check size={16} color={colors.accent} strokeWidth={3} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.helperText, { color: colors.inkSoft }]}>
        "Match device" follows your phone's own light/dark setting and updates automatically if you change it.
      </Text>

      <Text style={[styles.sectionLabel, { color: colors.inkSoft, marginTop: 28 }]}>FONT STYLE</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
        {FONT_OPTIONS.map((opt, i) => {
          const selected = fontKey === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setFontKey(opt.key as FontKey)}
              style={[styles.optionRow, i < FONT_OPTIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}
            >
              <Text
                style={[
                  styles.fontSample,
                  { color: colors.ink },
                  opt.key === "serif" && { fontFamily: Platform.OS === "ios" ? "Georgia" : "serif" },
                  opt.key === "monospace" && { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
                  opt.key === "rounded" && Platform.OS === "android" && { fontFamily: "sans-serif-medium" },
                ]}
              >
                {opt.sample}
              </Text>
              <Text style={[styles.optionLabel, { color: colors.ink }]}>{opt.label}</Text>
              {selected && <Check size={16} color={colors.accent} strokeWidth={3} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={[styles.helperText, { color: colors.inkSoft }]}>
        Applies across the whole app. A couple of options may render slightly differently on Android vs. iPhone — both use
        their platform's own real version of that typeface rather than a synthetic approximation.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  headerTitle: { fontSize: 17, fontWeight: "600" },
  sectionLabel: { fontSize: 11, letterSpacing: 1, fontWeight: "600", marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  preferenceRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  optionLabel: { flex: 1, fontSize: 14.5 },
  fontSample: { fontSize: 16, fontWeight: "600", width: 22, textAlign: "center" },
  helperText: { fontSize: 11.5, marginTop: 8, lineHeight: 16 },
});
