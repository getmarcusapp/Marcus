import { useEffect, useState } from 'react';
import { Tabs, useRouter, useSegments, usePathname } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, AppState } from 'react-native';
import { colors } from '../constants/theme';
import { hasOnboarded } from '../store/db';
import { initializePurchases } from '../store/purchases';
import { scheduleReengagementNotifications, scheduleAllNotifications } from '../notifications';
import * as health from '../lib/health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MiniMeditationPlayer } from '../components/MiniMeditationPlayer';
import { LockScreen } from '../components/LockScreen';
import { initAppLock, handleForeground, handleBackground, useAppLock } from '../lib/appLock';

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
    <Text style={{ fontSize: 9, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 3, color: active ? colors.accent : colors.textDim }}>
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
      }
    }
    check();
  }, []);

  return null;
}

export default function Layout() {
  const { isLocked } = useAppLock();

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

  return (
    <SafeAreaProvider>
      <OnboardingGate />
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: route.name === 'onboarding' ? { display: 'none' } : {
            backgroundColor: '#080808',
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
            textTransform: 'uppercase',
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