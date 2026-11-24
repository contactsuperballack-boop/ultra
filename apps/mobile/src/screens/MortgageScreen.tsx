import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, Minus, Plus } from "lucide-react-native";
import { useTheme } from "../themeContext/ThemeContext";
import { calculateMonthlyMortgage, ILLUSTRATIVE_RATE_PCT, MORTGAGE_LIMITS } from "../lib/mortgage";

const naira = (n: number) => `\u20a6${Math.round(n).toLocaleString("en-NG")}`;

export function MortgageScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [priceText, setPriceText] = useState("100000000");
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(ILLUSTRATIVE_RATE_PCT);

  const r = useMemo(() => calculateMonthlyMortgage(Number(priceText.replace(/\D/g, "")) || 0, down, years, rate), [priceText, down, years, rate]);

  const stepper = (label: string, value: string, onMinus: () => void, onPlus: () => void) => (
    <View style={styles.stepRow}>
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      <View style={styles.stepper}>
        <TouchableOpacity onPress={onMinus} style={[styles.stepBtn, { borderColor: colors.line }]} accessibilityLabel={`Decrease ${label}`}>
          <Minus size={14} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.stepValue, { color: colors.accent }]}>{value}</Text>
        <TouchableOpacity onPress={onPlus} style={[styles.stepBtn, { borderColor: colors.line }]} accessibilityLabel={`Increase ${label}`}>
          <Plus size={14} color={colors.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const [dMin, dMax] = MORTGAGE_LIMITS.downPaymentPct;
  const [yMin, yMax] = MORTGAGE_LIMITS.tenureYears;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.topBar, { backgroundColor: colors.card, borderBottomColor: colors.line }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <ChevronLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.ink }]}>Mortgage estimate</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 12, color: colors.inkSoft }}>
          A planning tool. ULTRA is not a lender or broker — use the rate your bank actually quotes you.
        </Text>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.line }]}>
          <Text style={[styles.label, { color: colors.ink }]}>Property price (₦)</Text>
          <TextInput value={priceText} onChangeText={setPriceText} keyboardType="number-pad" style={[styles.input, { borderColor: colors.line, color: colors.ink }]} />
          {stepper("Down payment", `${down}%`, () => setDown((d) => Math.max(dMin, d - 5)), () => setDown((d) => Math.min(dMax, d + 5)))}
          {stepper("Loan term", `${years} yrs`, () => setYears((y) => Math.max(yMin, y - 1)), () => setYears((y) => Math.min(yMax, y + 1)))}
          {stepper("Interest / yr", `${rate}%`, () => setRate((x) => Math.max(1, x - 0.5)), () => setRate((x) => Math.min(40, x + 0.5)))}
          <Text style={{ fontSize: 11, color: colors.inkSoft }}>The starting rate ({ILLUSTRATIVE_RATE_PCT}%) is an example. Use the rate your bank quotes.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.brandNavy, borderColor: colors.brandNavy }]}>
          <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>Estimated monthly repayment</Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "600" }}>{naira(r.monthlyRepaymentNgn)}</Text>
          {[["Down payment", r.downPaymentNgn], ["Loan amount", r.loanPrincipalNgn], ["Total interest", r.totalInterestNgn], ["Total repaid", r.totalRepaymentNgn]].map(([k, v]) => (
            <View key={k as string} style={styles.resultRow}>
              <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>{k}</Text>
              <Text style={{ color: "#fff", fontSize: 13 }}>{naira(v as number)}</Text>
            </View>
          ))}
          <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>Excludes legal, valuation, insurance and management fees. Not an offer or approval.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 54, paddingBottom: 10, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: "600" },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepper: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 14, fontWeight: "600", minWidth: 64, textAlign: "center" },
  resultRow: { flexDirection: "row", justifyContent: "space-between" },
});
