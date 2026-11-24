import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { MapPin } from "lucide-react-native";
import { trpc } from "../lib/trpc";
import { useTheme } from "../themeContext/ThemeContext";

// Real counts from listings.areaCounts. A district with no live listings
// still shows (people search by district) but never with an invented count.
const FEATURED = ["Maitama", "Asokoro", "Guzape", "Wuse 2", "Jabi", "Gwarinpa"];

export function ExploreByLocation({ onSelect }: { onSelect: (area: string) => void }) {
  const { colors } = useTheme();
  const { data } = trpc.listings.areaCounts.useQuery(undefined, { retry: false });
  const counts = new Map((data ?? []).map((r) => [r.area.toLowerCase(), r.count]));

  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={[styles.title, { color: colors.ink }]}>Explore by location</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {FEATURED.map((area) => {
          const n = counts.get(area.toLowerCase()) ?? 0;
          return (
            <TouchableOpacity key={area} onPress={() => onSelect(area)} style={[styles.tile, { backgroundColor: colors.brandNavy }]}>
              <MapPin size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.area}>{area}</Text>
              <Text style={styles.count}>{n > 0 ? `${n} listing${n === 1 ? "" : "s"}` : "Browse area"}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: "600", marginBottom: 10 },
  tile: { width: 112, borderRadius: 14, padding: 12, gap: 2 },
  area: { color: "#fff", fontSize: 13, fontWeight: "600", marginTop: 14 },
  count: { color: "rgba(255,255,255,0.65)", fontSize: 10.5 },
});
