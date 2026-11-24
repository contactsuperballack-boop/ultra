import React, { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { trpc } from "../lib/trpc";
import { session } from "../lib/session";
import { useTheme } from "../themeContext/ThemeContext";
import { registerForPushNotifications } from "../lib/registerPush";
import { formatNigerianPhone, normalizeNigerianPhone } from "../lib/phone";

const RESEND_SECONDS = 60; // matches the server's per-phone cooldown

// Sprint B — migrated to useTheme() (was the static COLORS import).
export function SignInScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const { colors } = useTheme();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phoneInput, setPhoneInput] = useState("");
  const [phone, setPhone] = useState(""); // normalised +234XXXXXXXXXX once accepted
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const submittedCode = useRef<string | null>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation({
    onSuccess: () => {
      setStep("code");
      setCooldown(RESEND_SECONDS);
    },
  });
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
    onError: () => {
      submittedCode.current = null; // a wrong code can be retried
    },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // Sign in as soon as the sixth digit is entered (also what SMS autofill triggers).
  useEffect(() => {
    if (step === "code" && code.length === 6 && !verifyOtp.isPending && submittedCode.current !== code) {
      submittedCode.current = code;
      verifyOtp.mutate({ phone, code });
    }
  }, [code, step, phone]);

  const sendCode = () => {
    const normalised = normalizeNigerianPhone(phoneInput);
    if (!normalised) {
      setLocalError("Enter a valid Nigerian mobile number, for example 0803 123 4567.");
      return;
    }
    setLocalError(null);
    setPhone(normalised);
    requestOtp.mutate({ phone: normalised });
  };

  const resend = () => {
    setCode("");
    submittedCode.current = null;
    verifyOtp.reset();
    requestOtp.mutate({ phone });
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.bg }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Text style={[styles.title, { color: colors.ink }]}>Sign in to ULTRA</Text>
      <Text style={[styles.subtitle, { color: colors.inkSoft }]}>
        {step === "phone" ? "We'll text you a verification code." : `Enter the code sent to ${formatNigerianPhone(phone)}.`}
      </Text>

      {step === "phone" ? (
        <>
          <TextInput
            value={phoneInput}
            onChangeText={setPhoneInput}
            placeholder="0803 123 4567"
            placeholderTextColor={colors.inkSoft}
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.card, color: colors.ink }]}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            autoFocus
            returnKeyType="send"
            onSubmitEditing={sendCode}
            accessibilityLabel="Mobile number"
          />
          <Text style={{ color: colors.inkSoft, fontSize: 12, marginBottom: 14 }}>Nigerian mobile numbers only. Any format works: 0803…, +234 803… or 803….</Text>
          <TouchableOpacity
            disabled={requestOtp.isPending || !phoneInput.trim()}
            onPress={sendCode}
            style={[styles.button, { backgroundColor: colors.accent }, (requestOtp.isPending || !phoneInput.trim()) && { opacity: 0.5 }]}
          >
            <Text style={styles.buttonText}>{requestOtp.isPending ? "Sending\u2026" : "Send code"}</Text>
          </TouchableOpacity>
          {(localError || requestOtp.error) && <Text style={styles.error}>{localError ?? requestOtp.error!.message}</Text>}
        </>
      ) : (
        <>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit code"
            placeholderTextColor={colors.inkSoft}
            maxLength={6}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            accessibilityLabel="6-digit code"
            style={[styles.input, { borderColor: colors.line, backgroundColor: colors.card, color: colors.ink }, { textAlign: "center", letterSpacing: 6, fontSize: 20 }]}
          />
          <TouchableOpacity
            disabled={verifyOtp.isPending || code.length !== 6}
            onPress={() => {
              submittedCode.current = code;
              verifyOtp.mutate({ phone, code });
            }}
            style={[styles.button, { backgroundColor: colors.accent }, (verifyOtp.isPending || code.length !== 6) && { opacity: 0.5 }]}
          >
            <Text style={styles.buttonText}>{verifyOtp.isPending ? "Verifying\u2026" : "Verify & sign in"}</Text>
          </TouchableOpacity>
          {verifyOtp.error && <Text style={styles.error}>{verifyOtp.error.message}</Text>}
          {requestOtp.error && <Text style={styles.error}>{requestOtp.error.message}</Text>}

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
            <TouchableOpacity onPress={() => { setStep("phone"); setCode(""); verifyOtp.reset(); }}>
              <Text style={[styles.link, { color: colors.inkSoft }]}>Use a different number</Text>
            </TouchableOpacity>
            {cooldown > 0 ? (
              <Text style={[styles.link, { color: colors.inkSoft }]}>Resend code in {cooldown}s</Text>
            ) : (
              <TouchableOpacity onPress={resend} disabled={requestOtp.isPending}>
                <Text style={[styles.link, { color: colors.accent, fontWeight: "600" }]}>Resend code</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </KeyboardAvoidingView>
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
