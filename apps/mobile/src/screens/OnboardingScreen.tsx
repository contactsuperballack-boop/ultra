import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { DARK_COLORS } from "../themeContext/ThemeContext";

/**
 * Shown once, on first-ever launch (see App.tsx — gated by an AsyncStorage
 * flag, not shown again after "Get Started" is tapped). Structure matches
 * the provided mockup's first screen: dark navy background, logo,
 * three-line tagline with the last line in accent blue, a one-line
 * subtitle, and two calls to action.
 *
 * Disclosed simplification: the mockup shows 3 pagination dots, implying
 * a multi-slide carousel — this ships as a single slide, since there's no
 * brief for what slides 2/3 would say, and inventing that copy isn't this
 * pass's call to make. The dots are still rendered (all pointing at slide
 * 1) so the visual structure matches; wiring a real swipeable carousel
 * once slide 2/3 copy exists is a small, mechanical follow-up.
 */
export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <Image source={require("../../assets/logo-white.png")} style={styles.logo} resizeMode="contain" />

        <View style={styles.taglineBlock}>
          <Text style={styles.tagline}>Verified properties.</Text>
          <Text style={styles.tagline}>Real connections.</Text>
          <Text style={[styles.tagline, styles.taglineAccent]}>Better decisions.</Text>
        </View>

        <Text style={styles.subtitle}>Abuja's most trusted property marketplace.</Text>
      </View>

      <View style={styles.dots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.button} onPress={onDone}>
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDone} style={{ marginTop: 16 }}>
          <Text style={styles.loginText}>
            Already have an account? <Text style={styles.loginLink}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DARK_COLORS.bg, justifyContent: "space-between" },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 36 },
  logo: { width: 160, height: 42, marginBottom: 36 },
  taglineBlock: { marginBottom: 14 },
  tagline: { color: "#FFFFFF", fontSize: 27, fontWeight: "600", lineHeight: 34 },
  taglineAccent: { color: DARK_COLORS.accent },
  subtitle: { color: "#94A3C4", fontSize: 14, marginTop: 4 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginBottom: 24 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#233459" },
  dotActive: { backgroundColor: DARK_COLORS.accent, width: 18 },
  footer: { paddingHorizontal: 28, paddingBottom: 48 },
  button: { backgroundColor: DARK_COLORS.accent, borderRadius: 16, paddingVertical: 16, alignItems: "center" },
  buttonText: { color: "#FFFFFF", fontSize: 15.5, fontWeight: "600" },
  loginText: { color: "#94A3C4", fontSize: 13, textAlign: "center" },
  loginLink: { color: DARK_COLORS.accent, fontWeight: "600" },
});
