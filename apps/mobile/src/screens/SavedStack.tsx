import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SavedListScreen } from "./SavedListScreen";
import { ListingDetailScreen } from "./ListingDetailScreen";
import { RealtorProfileScreen } from "./RealtorProfileScreen";
import type { WithListingDetail, WithRealtorProfile } from "../navigation/types";

export type SavedStackParamList = WithListingDetail<"SavedHome"> & WithRealtorProfile;

const Stack = createNativeStackNavigator<SavedStackParamList>();

export function SavedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SavedHome" component={SavedListScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="RealtorProfile" component={RealtorProfileScreen} />
    </Stack.Navigator>
  );
}
