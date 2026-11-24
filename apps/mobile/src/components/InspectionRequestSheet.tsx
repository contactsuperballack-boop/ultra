import React, { useMemo, useState } from "react";
import { View, Text, Modal, Pressable, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { X } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";
import { INSPECTION_KINDS, INSPECTION_SLOTS, formatInspectionDate, upcomingInspectionDates, type InspectionKind, type InspectionSlot } from "../lib/inspection";

const shortDate = (ymd: string) => formatInspectionDate(ymd).replace(/ \d{4}$/, "");

export function InspectionRequestSheet({ visible, onClose, listingId, agencyName }: { visible: boolean; onClose: () => void; listingId: string; agencyName: string }) {
  const { colors } = useTheme();
  const utils = trpc.useUtils();
  const dates = useMemo(() => upcomingInspectionDates(21), []);
  const [kind, setKind] = useState<InspectionKind>("PHYSICAL");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<InspectionSlot>("MORNING");
  const [notes, setNotes] = useState("");

  const request = trpc.inspections.request.useMutation({
    onSuccess: () => {
      utils.inspections.mine.invalidate();
      utils.inquiries.myThreads.invalidate();
    },
  });

  const chip = (on: boolean) => [styles.chip, { borderColor: on ? colors.accent : colors.line }, on && { backgroundColor: colors.accent }];
  const chipText = (on: boolean) => [styles.chipText, { color: on ? "#fff" : colors.inkSoft }];
  const signInNeeded = request.error?.message === "Sign in required.";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.ink }]}>Request an inspection</Text>
              <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{agencyName} will confirm, decline or suggest another time.</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close"><X size={20} color={colors.inkSoft} /></TouchableOpacity>
          </View>

          {request.isSuccess ? (
            <Text style={{ color: colors.accent, fontSize: 14, marginTop: 14 }}>Request sent. You'll find it, and any reply, in your Messages tab.</Text>
          ) : (
            <ScrollView contentContainerStyle={{ gap: 14, paddingTop: 14, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              <View style={{ gap: 8 }}>
                {INSPECTION_KINDS.map((k) => (
                  <TouchableOpacity key={k.value} onPress={() => setKind(k.value)} style={[styles.kind, { borderColor: kind === k.value ? colors.accent : colors.line }]}>
                    <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13.5 }}>{k.label}</Text>
                    <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{k.hint}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View>
                <Text style={[styles.label, { color: colors.ink }]}>Preferred date</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {dates.map((d) => (
                    <TouchableOpacity key={d} onPress={() => setDate(d)} style={chip(date === d)}>
                      <Text style={chipText(date === d)}>{shortDate(d)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View>
                <Text style={[styles.label, { color: colors.ink }]}>Time of day</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {INSPECTION_SLOTS.map((s) => (
                    <TouchableOpacity key={s.value} onPress={() => setSlot(s.value)} style={chip(slot === s.value)}>
                      <Text style={chipText(slot === s.value)}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TextInput
                value={notes}
                onChangeText={setNotes}
                maxLength={500}
                multiline
                placeholder="Anything the realtor should know? (optional)"
                placeholderTextColor={colors.inkSoft}
                style={[styles.notes, { borderColor: colors.line, color: colors.ink }]}
              />

              {request.error && (
                <Text style={{ color: "#B4432E", fontSize: 12.5 }}>
                  {signInNeeded ? "Sign in from the Profile tab to request an inspection." : request.error.message}
                </Text>
              )}

              <TouchableOpacity
                disabled={!date || request.isPending}
                onPress={() => date && request.mutate({ listingId, kind, preferredDate: date, slot, notes: notes.trim() || undefined })}
                style={[styles.submit, { backgroundColor: colors.accent }, (!date || request.isPending) && { opacity: 0.5 }]}
              >
                {request.isPending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 15 }}>Send request</Text>}
              </TouchableOpacity>
              <Text style={{ color: colors.inkSoft, fontSize: 11, textAlign: "center" }}>Your phone number isn't shared. Everything stays in ULTRA Messages.</Text>
            </ScrollView>
          )}
        </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,14,39,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 30, maxHeight: "92%" },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { fontSize: 17, fontWeight: "600" },
  kind: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 2 },
  label: { fontSize: 12.5, fontWeight: "600", marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7 },
  chipText: { fontSize: 12.5, fontWeight: "600" },
  notes: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 70, fontSize: 14, textAlignVertical: "top" },
  submit: { borderRadius: 14, paddingVertical: 14, alignItems: "center" },
});
