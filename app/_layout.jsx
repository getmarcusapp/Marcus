import { useEffect, useState } from 'react';
import { Tabs, useRouter, useSegments, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, AppState, Platform } from 'react-native';
import { colors, font } from '../constants/theme';
import { hasOnboarded, getHasSeenCompassIntro, setHasSeenCompassIntro } from '../store/db';
import { initializePurchases } from '../store/purchases';
import { scheduleReengagementNotifications, scheduleAllNotifications } from '../notifications';
import * as health from '../lib/health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MiniMeditationPlayer } from '../components/MiniMeditationPlayer';
import { LockScreen } from '../components/LockScreen';
import { initAppLock, handleForeground, handleBackground, useAppLock } from '../lib/appLock';
import { useFonts, Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { Cormorant_400Regular, Cormorant_500Medium, Cormorant_700Bold } from '@expo-google-fonts/cormorant';

function TabIcon({ name, color, size = 22 }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// Maps the current pathname to the logical tab a user is "in" so the
// right tab icon stays illuminated even when the underlying route is
// one of the hidden (href:null) flow screens like /compass or /journal.
const PRACTICE_ROUTES = new Set([
  '/', '/index', '/compass', '/read', '/journal', '/review', '/meditate',
  '/journal-history', '/read-archive', '/review-archive',
]);
const EMOTIONS_ROUTES = new Set(['/emotions', '/emotions-history']);
function useLogicalTabKey() {
  const pathname = usePathname();
  const path = (pathname || '/').split('?')[0];
  if (PRACTICE_ROUTES.has(path)) return 'practice';
  if (EMOTIONS_ROUTES.has(path)) return 'emotions';
  return 'more';
}

function ManagedTabIcon({ iconName, tabKey, size }) {
  const active = useLogicalTabKey() === tabKey;
  return <TabIcon name={iconName} size={size} color={active ? colors.accent : colors.textDim} />;
}

function ManagedTabLabel({ label, tabKey }) {
  const active = useLogicalTabKey() === tabKey;
  return (
    <Text
      style={{ fontSize: 9, letterSpacing: 1.4, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 3, color: active ? colors.accent : colors.textDim }}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {label}
    </Text>
  );
}

function OnboardingGate() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function check() {
      const onboarded = await hasOnboarded();
      if (!onboarded) {
        router.replace('/onboarding');
        return;
      }
      // Migration: existing onboarded users went through the old Compass
      // step during onboarding, so they shouldn't see the new in-app
      // intro. Mark as seen if the flag has never been set.
      const introSeen = await getHasSeenCompassIntro();
      if (introSeen === null) {
        await setHasSeenCompassIntro(true);
      }
    }
    check();
  }, []);

  return null;
}

export default function Layout() {
  const { isLocked } = useAppLock();
  // Block first paint until brand fonts are loaded so headlines, body,
  // and the Marcus wordmark all land with the right typography on cold
  // start. Didot is iOS-system, no load needed.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Cormorant_400Regular,
    Cormorant_500Medium,
    Cormorant_700Bold,
  });

  // Set Inter Regular as the default for any <Text> that doesn't set
  // its own fontFamily. Runs after fonts load to avoid pointing at a
  // not-yet-registered font name. Side-effect outside render to avoid
  // the React-warning that bit us last time.
  useEffect(() => {
    if (!fontsLoaded) return;
    if (Text.defaultProps?._marcusBrandFontApplied) return;
    Text.defaultProps = Text.defaultProps || {};
    const prior = Text.defaultProps.style;
    Text.defaultProps.style = prior
      ? [prior, { fontFamily: 'Inter_400Regular' }]
      : { fontFamily: 'Inter_400Regular' };
    Text.defaultProps._marcusBrandFontApplied = true;
  }, [fontsLoaded]);

  useEffect(() => {
    // Boot the app lock first so the lock screen can show immediately on
    // cold start if the user enabled it. await isn't needed since the hook
    // subscribes and re-renders when state lands.
    initAppLock();

    initializePurchases();
    scheduleReengagementNotifications();
    scheduleAllNotifications();
    // Re-init HealthKit if user previously granted, so writes work this session.
    // No iOS prompt is shown — initHealthKit is a no-op once iOS has the answer cached.
    (async () => {
      const asked = await AsyncStorage.getItem('health_permission_asked');
      if (asked === 'true') await health.requestPermission();
    })();
    // Bypass paywall in dev and beta builds — never runs in production
    if (__DEV__ || process.env.EXPO_PUBLIC_IS_BETA === 'true') {
      AsyncStorage.setItem('has_premium', 'true');
    }

    // AppState listener handles two things: re-schedule notifications on
    // foreground (existing), and the app-lock background/foreground
    // transitions (new). Re-lock kicks in if the app was backgrounded
    // for more than the threshold defined in lib/appLock.js.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        scheduleAllNotifications();
        handleForeground();
      } else if (state === 'background' || state === 'inactive') {
        handleBackground();
      }
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <OnboardingGate />
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          // Hide tab bar on onboarding + paywall so users can't trivially
          // bypass the subscription gate by tapping a tab. Paywall is the
          // single entry point to the app for non-trialing, non-paying
          // users.
          tabBarStyle: (route.name === 'onboarding' || route.name === 'paywall' || route.name === 'ready') ? { display: 'none' } : {
            backgroundColor: '#0d0a08',
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
            height: 84,
            paddingBottom: 24,
            paddingTop: 10,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textDim,
          tabBarLabelStyle: {
            fontSize: 9,
            letterSpacing: 1.4,
            fontFamily: font.bodyMedium, textTransform: 'uppercase',
            marginTop: 3,
          },
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: () => <ManagedTabIcon iconName="flame-outline" tabKey="practice" />,
            tabBarLabel: () => <ManagedTabLabel label="Practice" tabKey="practice" />,
          }}
        />
        <Tabs.Screen
          name="emotions"
          options={{
            tabBarIcon: () => <ManagedTabIcon iconName="heart-outline" tabKey="emotions" />,
            tabBarLabel: () => <ManagedTabLabel label="Emotions" tabKey="emotions" />,
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            // menu-outline is three thin horizontal bars and reads smaller than
            // flame/heart at the same px size — bump it slightly for visual parity.
            tabBarIcon: () => <ManagedTabIcon iconName="menu-outline" tabKey="more" size={26} />,
            tabBarLabel: () => <ManagedTabLabel label="More" tabKey="more" />,
          }}
        />
        <Tabs.Screen name="journal" options={{ href: null }} />
        <Tabs.Screen name="read" options={{ href: null }} />
        <Tabs.Screen name="compass" options={{ href: null }} />
        <Tabs.Screen name="review" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="settings-notifications" options={{ href: null }} />
        <Tabs.Screen name="settings-developer" options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
        <Tabs.Screen name="howto" options={{ href: null }} />
        <Tabs.Screen name="meditate" options={{ href: null }} />
        <Tabs.Screen name="imagery" options={{ href: null }} />
        <Tabs.Screen name="library" options={{ href: null }} />
        <Tabs.Screen name="paywall" options={{ href: null }} />
        <Tabs.Screen name="ready" options={{ href: null }} />
        <Tabs.Screen name="journal-history" options={{ href: null }} />
        <Tabs.Screen name="review-archive" options={{ href: null }} />
        <Tabs.Screen name="emotions-history" options={{ href: null }} />
        <Tabs.Screen name="read-archive" options={{ href: null }} />
      </Tabs>
      <MiniMeditationPlayer />
      {isLocked && <LockScreen />}
    </SafeAreaProvider>
  );
}