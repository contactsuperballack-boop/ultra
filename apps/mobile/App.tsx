import React, { useEffect, useState } from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Search, Heart, MessageCircle, User } from "lucide-react-native";

import { trpc, createTRPCClient } from "./src/lib/trpc";
import { createAppQueryClient } from "./src/lib/queryClient";
import { initSentry } from "./src/lib/sentry";
import { ThemeProvider, useTheme } from "./src/themeContext/ThemeContext";
import { FontProvider } from "./src/themeContext/FontContext";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { SearchStack } from "./src/screens/SearchStack";
import { SavedStack } from "./src/screens/SavedStack";
import { MessagesStack } from "./src/screens/MessagesStack";
import { ProfileStack } from "./src/screens/ProfileStack";

const Tab = createBottomTabNavigator();
const ONBOARDING_KEY = "ultra_has_seen_onboarding";

initSentry();

function AppNavigator() {
  // Lives inside the providers (unlike App() itself, which renders them),
  // so this hook actually has access to the tRPC context. Silently
  // no-ops to 0 when signed out — unreadCount is a protectedProcedure and
  // will error for an unauthenticated user; that's fine, no badge shows.
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, { retry: false });
  const { colors, resolvedMode } = useTheme();

  // React Navigation's own theme controls the screen-transition background
  // shown briefly during navigation and the default header/tab-bar chrome
  // color — without this, switching to dark mode would still flash white
  // between screens even though our own screens are dark.
  const navTheme = {
    ...(resolvedMode === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(resolvedMode === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.bg,
      card: colors.card,
      text: colors.ink,
      border: colors.line,
      primary: colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style={resolvedMode === "dark" ? "light" : "dark"} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.inkSoft,
          tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
          tabBarIcon: ({ color, size }) => {
            const icons: Record<string, any> = { Search, Saved: Heart, Messages: MessageCircle, Profile: User };
            const Icon = icons[route.name];
            return <Icon color={color} size={size - 4} />;
          },
        })}
      >
        <Tab.Screen name="Search" component={SearchStack} />
        <Tab.Screen name="Saved" component={SavedStack} />
        <Tab.Screen name="Messages" component={MessagesStack} />
        <Tab.Screen
          name="Profile"
          component={ProfileStack}
          options={{ tabBarBadge: unreadCount && unreadCount > 0 ? unreadCount : undefined }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function Root() {
  // Onboarding gate — shown once on first-ever launch, before the tab
  // navigator, then never again. `null` (not yet checked) intentionally
  // renders nothing rather than guessing, same reasoning ThemeProvider/
  // FontProvider apply to their own persisted preferences.
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((seen) => setShowOnboarding(seen !== "true"));
  }, []);

  if (showOnboarding === null) return null;

  if (showOnboarding) {
    return (
      <OnboardingScreen
        onDone={() => {
          AsyncStorage.setItem(ONBOARDING_KEY, "true").catch(() => {});
          setShowOnboarding(false);
        }}
      />
    );
  }

  return <AppNavigator />;
}

export default function App() {
  const [queryClient] = useState(() => createAppQueryClient());
  const [trpcClient] = useState(() => createTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <FontProvider>
            <Root />
          </FontProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
