import { useEffect, useState } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, AppState } from 'react-native';
import { colors } from '../constants/theme';
import { hasOnboarded } from '../store/db';
import { initializePurchases } from '../store/purchases';
import { scheduleReengagementNotifications, scheduleAllNotifications } from '../notifications';
import * as health from '../lib/health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MiniMeditationPlayer } from '../components/MiniMeditationPlayer';
import { LockScreen } from '../components/LockScreen';
import { initAppLock, handleForeground, handleBackground, useAppLock } from '../lib/appLock';

function TabIcon({ name, color }) {
  return <Ionicons name={name} size={22} color={color} />;
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
        <Tabs.Screen name="index" options={{ title: 'Practice', tabBarIcon: ({ color }) => <TabIcon name="flame-outline" color={color} /> }} />
        <Tabs.Screen name="emotions" options={{ title: 'Emotions', tabBarIcon: ({ color }) => <TabIcon name="heart-outline" color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name="menu-outline" color={color} /> }} />
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