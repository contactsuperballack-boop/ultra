import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { Home } from "lucide-react-native";
import { DARK_COLORS } from "../themeContext/ThemeContext";

// First-launch screen (App.tsx gates it with an AsyncStorage flag). The
// wheel shows the home journey ULTRA is built around. "Invest" is
// deliberately not a step — investment products aren't part of the product.
// Numbers run 1–5 clockwise from the top.
const STEPS = ["Discover", "Buy", "Set Up", "Improve", "Maintain"];
const SIZE = 300;
const RADIUS = 118;
const NODE = 36;

export function OnboardingScreen({ onDone }: { onDone: (opts?: { openSignIn?: boolean }) => void }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Image source={require("../../assets/logo-white.png")} style={styles.logo} resizeMode="contain" />

        <View style={styles.wheel}>
          <View style={styles.ring} />
          <View style={styles.hub}>
            <Home size={40} color={DARK_COLORS.accent} />
          </View>
          {STEPS.map((label, i) => {
            const angle = (-90 + i * (360 / STEPS.length)) * (Math.PI / 180);
            const cx = SIZE / 2 + RADIUS * Math.cos(angle);
            const cy = SIZE / 2 + RADIUS * Math.sin(angle);
            return (
              <View key={label} style={[styles.node, { left: cx - 40, top: cy - NODE / 2 }]}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{i + 1}</Text>
                </View>
                <Text style={styles.nodeLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={() => onDone()}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDone({ openSignIn: true })} style={{ marginTop: 16 }}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDone()} style={{ marginTop: 14 }}>
          <Text style={styles.guestText}>Continue as Guest</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_COLORS.bg, justifyContent: "space-between" },
  content: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 160, height: 42, marginBottom: 40 },
  wheel: { width: SIZE, height: SIZE },
  ring: { position: "absolute", left: SIZE / 2 - RADIUS, top: SIZE / 2 - RADIUS, width: RADIUS * 2, height: RADIUS * 2, borderRadius: RADIUS, borderWidth: 1, borderStyle: "dashed", borderColor: "#2A3F6E" },
  hub: { position: "absolute", left: SIZE / 2 - 55, top: SIZE / 2 - 55, width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: DARK_COLORS.accent, alignItems: "center", justifyContent: "center" },
  node: { position: "absolute", width: 80, alignItems: "center", gap: 4 },
  badge: { width: NODE, height: NODE, borderRadius: NODE / 2, backgroundColor: DARK_COLORS.accent, alignItems: "center", justifyContent: "center" },
  badgeText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  nodeLabel: { color: "#D5DEF3", fontSize: 12.5, fontWeight: "500" },
  footer: { paddingHorizontal: 28, paddingBottom: 44 },
  button: { backgroundColor: DARK_COLORS.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "600" },
  loginText: { color: "#94A3C4", fontSize: 13, textAlign: "center" },
  loginLink: { color: DARK_COLORS.accent, fontWeight: "600" },
  guestText: { color: "#94A3C4", fontSize: 13, textAlign: "center", textDecorationLine: "underline" },
});
