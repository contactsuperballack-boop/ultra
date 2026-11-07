import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { trpc } from "../lib/trpc";
import { session } from "../lib/session";
import { useTheme } from "../themeContext/ThemeContext";
import { registerForPushNotifications } from "../lib/registerPush";

// Sprint B — migrated to useTheme() (was the static COLORS import).
export function SignInScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const { colors } = useTheme();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("+234");
  const [code, setCode] = useState("");

  const requestOtp = trpc.auth.requestOtp.useMutation({ onSuccess: () => setStep("code") });
  const registerPushToken = trpc.notifications.registerPushToken.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation({
    onSuccess: async (data) => {
      await session.set(data.accessToken, data.refreshToken);
      onSignedIn();
      // Fire-and-forget, after onSignedIn so the UI transitions immediately
      // rather than waiting on a permission prompt.
      registerForPushNotifications()
        .then((token) => { if (token) registerPushToken.mutate({ token }); })
        .catch((err) => console.warn("[push] registration failed:", err));
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.ink }]}>Sign in to ULTRA</Text>
      <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
        {step === "phone" ? "We'll text you a verification code." : `Enter the code sent to ${phone}.`}
      </Text>

      {step === "phone" ? (
        <>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="+2348012345678"
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.card, color: colors.ink }]}
            keyboardType="phone-pad"
          />
          <TouchableOpacity
            disabled={requestOtp.isPending}
            onPress={() => requestOtp.mutate({ phone })}
            style={[styles.button, { backgroundColor: colors.accent }, requestOtp.isPending && { opacity: 0.5 }]}
          >
            <Text style={styles.buttonText}>{requestOtp.isPending ? "Sending\u2026" : "Send code"}</Text>
          </TouchableOpacity>
          {requestOtp.error && <Text style={styles.error}>{requestOtp.error.message}</Text>}
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            placeholderTextColor={colors.inkSoft}
            maxLength={6}
            keyboardType="number-pad"
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.card, color: colors.ink }, { textAlign: "center", letterSpacing: 6, fontSize: 18 }]}
          />
          <TouchableOpacity
            disabled={verifyOtp.isPending || code.length !== 6}
            onPress={() => verifyOtp.mutate({ phone, code })}
            style={[styles.button, { backgroundColor: colors.accent }, (verifyOtp.isPending || code.length !== 6) && { opacity: 0.5 }]}
          >
            <Text style={styles.buttonText}>{verifyOtp.isPending ? "Verifying\u2026" : "Verify & sign in"}</Text>
          </TouchableOpacity>
          {verifyOtp.error && <Text style={styles.error}>{verifyOtp.error.message}</Text>}
          <TouchableOpacity onPress={() => setStep("phone")} style={{ marginTop: 12 }}>
            <Text style={[styles.link, { color: colors.inkSoft }]}>Use a different number</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 90 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 6 },
  subtitle: { fontSize: 13, marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, marginBottom: 12 },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  error: { color: "#B4432E", fontSize: 12, marginTop: 8 },
  link: { fontSize: 12, textAlign: "center" },
});
