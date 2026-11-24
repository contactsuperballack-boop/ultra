import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ThreadListScreen } from "./ThreadListScreen";
import { ThreadScreen } from "./ThreadScreen";

export type MessagesStackParamList = {
  ThreadList: undefined;
  Thread: { inquiryId: string };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ThreadList" component={ThreadListScreen} />
      <Stack.Screen name="Thread" component={ThreadScreen} />
    </Stack.Navigator>
  );
}
