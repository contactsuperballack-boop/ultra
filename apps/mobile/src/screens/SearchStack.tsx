import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SearchScreen } from "./SearchScreen";
import { ListingDetailScreen } from "./ListingDetailScreen";
import { MortgageScreen } from "./MortgageScreen";
import { ServicesScreen } from "./ServicesScreen";
import { ServiceProviderDetailScreen } from "./ServiceProviderDetailScreen";
import { RealtorProfileScreen } from "./RealtorProfileScreen";
import type { WithListingDetail, WithRealtorProfile } from "../navigation/types";

export type SearchStackParamList = Omit<WithListingDetail<"SearchHome">, "SearchHome"> &
  WithRealtorProfile & {
    SearchHome: { autoFocus?: boolean } | undefined;
    Mortgage: undefined;
    Services: undefined;
    ServiceProviderDetail: { id: string };
  };

const Stack = createNativeStackNavigator<SearchStackParamList>();

export function SearchStack({ autoFocus }: { autoFocus?: boolean } = {}) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchHome" component={SearchScreen} initialParams={autoFocus ? { autoFocus } : undefined} />
      <Stack.Screen name="Mortgage" component={MortgageScreen} />
      <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
      <Stack.Screen name="RealtorProfile" component={RealtorProfileScreen} />
      <Stack.Screen name="Services" component={ServicesScreen} />
      <Stack.Screen name="ServiceProviderDetail" component={ServiceProviderDetailScreen} />
    </Stack.Navigator>
  );
}
