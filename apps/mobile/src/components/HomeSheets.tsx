import React from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, Linking, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { ShieldCheck, Mail, MessageCircle } from "lucide-react-native";
import { useTheme } from "../themeContext/ThemeContext";

const extra = (Constants.expoConfig?.extra ?? {}) as { supportEmail?: string; supportWhatsapp?: string };

function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export type MenuItem = { label: string; icon: React.ComponentType<{ size?: number; color?: string }>; onPress: () => void; dividerBefore?: boolean };

export function MenuSheet({ visible, onClose, items }: { visible: boolean; onClose: () => void; items: MenuItem[] }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose}>
      {items.map((it) => (
        <React.Fragment key={it.label}>
          {it.dividerBefore && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => {
              onClose();
              it.onPress();
            }}
          >
            <it.icon size={18} color={colors.accent} />
            <Text style={[styles.menuLabel, { color: colors.ink }]}>{it.label}</Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </Sheet>
  );
}

const HELP_POINTS = [
  "Every realtor is identity-checked before they can publish.",
  "Every listing is reviewed by ULTRA before it goes live.",
  "Message realtors inside the app so your conversations stay in one place.",
];

export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.helpHead}>
        <ShieldCheck size={20} color={colors.accent} />
        <Text style={[styles.helpTitle, { color: colors.ink }]}>How ULTRA keeps you safe</Text>
      </View>
      {HELP_POINTS.map((p) => (
        <Text key={p} style={[styles.helpPoint, { color: colors.inkSoft }]}>{"\u2022"} {p}</Text>
      ))}

      {(extra.supportEmail || extra.supportWhatsapp) && (
        <View style={{ marginTop: 16, gap: 10 }}>
          {extra.supportEmail && (
            <TouchableOpacity style={[styles.contactBtn, { borderColor: colors.line }]} onPress={() => Linking.openURL(`mailto:${extra.supportEmail}`)}>
              <Mail size={16} color={colors.accent} />
              <Text style={[styles.contactText, { color: colors.ink }]}>Email support</Text>
            </TouchableOpacity>
          )}
          {extra.supportWhatsapp && (
            <TouchableOpacity style={[styles.contactBtn, { borderColor: colors.line }]} onPress={() => Linking.openURL(`https://wa.me/${extra.supportWhatsapp}`)}>
              <MessageCircle size={16} color={colors.accent} />
              <Text style={[styles.contactText, { color: colors.ink }]}>Chat on WhatsApp</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,14,39,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13 },
  menuLabel: { fontSize: 15, fontWeight: "500" },
  divider: { height: 1, marginVertical: 6 },
  helpHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  helpTitle: { fontSize: 16, fontWeight: "600" },
  helpPoint: { fontSize: 13.5, lineHeight: 21, marginBottom: 4 },
  contactBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, padding: 14 },
  contactText: { fontSize: 14, fontWeight: "500" },
});
