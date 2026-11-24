import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";
import {
  INSPECTION_SLOTS,
  INSPECTION_STATUS_LABELS,
  formatInspectionDate,
  kindLabel,
  slotLabel,
  upcomingInspectionDates,
  type InspectionAction,
  type InspectionSlot,
} from "../lib/inspection";

const ACTION_LABELS: Record<InspectionAction, string> = {
  ACCEPT: "Confirm",
  DECLINE: "Decline",
  RESCHEDULE: "Propose another time",
  CANCEL: "Cancel request",
  ACCEPT_RESCHEDULE: "Accept new time",
  COMPLETE: "Mark completed",
};
const PRIMARY: InspectionAction[] = ["ACCEPT", "ACCEPT_RESCHEDULE", "COMPLETE"];
const shortDate = (v: string | Date) => formatInspectionDate(v).replace(/ \d{4}$/, "");

/** Inspection requests for one thread. The server says which buttons each side gets and re-checks every press. */
export function InspectionCards({ inquiryId }: { inquiryId: string }) {
  const { colors } = useTheme();
  const utils = trpc.useUtils();
  const { data } = trpc.inspections.forInquiry.useQuery({ inquiryId });
  const dates = useMemo(() => upcomingInspectionDates(14), []);
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newDate, setNewDate] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState<InspectionSlot>("MORNING");

  const transition = trpc.inspections.transition.useMutation({
    onSuccess: () => {
      setRescheduling(null);
      setNewDate(null);
      utils.inspections.forInquiry.invalidate({ inquiryId });
      utils.inspections.mine.invalidate();
      utils.inquiries.byId.invalidate({ id: inquiryId });
    },
  });

  if (!data || data.items.length === 0) return null;

  const chip = (on: boolean) => [styles.chip, { borderColor: on ? colors.accent : colors.line }, on && { backgroundColor: colors.accent }];

  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text style={[styles.heading, { color: colors.inkSoft }]}>INSPECTION REQUESTS</Text>
      {data.items.map((r) => {
        const when = r.scheduledDate ?? r.preferredDate;
        const slot = r.scheduledSlot ?? r.preferredSlot;
        return (
          <View key={r.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.ink, fontWeight: "600", fontSize: 13.5 }}>{kindLabel(r.kind)}</Text>
                <Text style={{ color: colors.inkSoft, fontSize: 12 }}>{shortDate(when)}, {slotLabel(slot).toLowerCase()}</Text>
                {r.status === "RESCHEDULE_PROPOSED" && r.proposedDate && r.proposedSlot && (
                  <Text style={{ color: colors.accent, fontSize: 12, marginTop: 2 }}>Proposed instead: {shortDate(r.proposedDate)}, {slotLabel(r.proposedSlot).toLowerCase()}</Text>
                )}
              </View>
              <Text style={[styles.status, { color: colors.accent, borderColor: colors.line }]}>{INSPECTION_STATUS_LABELS[r.status]}</Text>
            </View>

            {r.actions.length > 0 && (
              <View style={styles.actions}>
                {r.actions.map((a) => (
                  <TouchableOpacity
                    key={a}
                    disabled={transition.isPending}
                    onPress={() => (a === "RESCHEDULE" ? setRescheduling(rescheduling === r.id ? null : r.id) : transition.mutate({ id: r.id, action: a }))}
                    style={[styles.btn, PRIMARY.includes(a) ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.line }]}
                  >
                    <Text style={{ color: PRIMARY.includes(a) ? "#fff" : colors.ink, fontSize: 12, fontWeight: "600" }}>{ACTION_LABELS[a]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {rescheduling === r.id && (
              <View style={{ gap: 8, marginTop: 10 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {dates.map((d) => (
                    <TouchableOpacity key={d} onPress={() => setNewDate(d)} style={chip(newDate === d)}>
                      <Text style={[styles.chipText, { color: newDate === d ? "#fff" : colors.inkSoft }]}>{shortDate(d)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {INSPECTION_SLOTS.map((s) => (
                    <TouchableOpacity key={s.value} onPress={() => setNewSlot(s.value)} style={chip(newSlot === s.value)}>
                      <Text style={[styles.chipText, { color: newSlot === s.value ? "#fff" : colors.inkSoft }]}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  disabled={!newDate || transition.isPending}
                  onPress={() => newDate && transition.mutate({ id: r.id, action: "RESCHEDULE", proposedDate: newDate, proposedSlot: newSlot })}
                  style={[styles.btn, { backgroundColor: colors.accent, borderColor: colors.accent, alignSelf: "flex-start" }, !newDate && { opacity: 0.5 }]}
                >
                  <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Send proposal</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
      {transition.error && <Text style={{ color: "#B4432E", fontSize: 12 }}>{transition.error.message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  card: { borderWidth: 1, borderRadius: 14, padding: 12 },
  status: { fontSize: 11, fontWeight: "600", borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", overflow: "hidden" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  btn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  chip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "600" },
});
