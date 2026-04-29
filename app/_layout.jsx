import { useEffect, useState } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '../constants/theme';
import { hasOnboarded } from '../store/db';
import { initializePurchases } from '../store/purchases';
import { scheduleReengagementNotifications } from '../notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  useEffect(() => {
    initializePurchases();
    scheduleReengagementNotifications();
    // Bypass paywall in dev and beta builds — never runs in production
    if (__DEV__ || process.env.EXPO_PUBLIC_IS_BETA === 'true') {
      AsyncStorage.setItem('has_premium', 'true');
    }
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
        <Tabs.Screen name="journal" options={{ title: 'Journal', tabBarIcon: ({ color }) => <TabIcon name="create-outline" color={color} /> }} />
        <Tabs.Screen name="emotions" options={{ title: 'Emotions', tabBarIcon: ({ color }) => <TabIcon name="heart-outline" color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name="menu-outline" color={color} /> }} />
        <Tabs.Screen name="read" options={{ href: null }} />
        <Tabs.Screen name="compass" options={{ href: null }} />
        <Tabs.Screen name="review" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null }} />
        <Tabs.Screen name="howto" options={{ href: null }} />
        <Tabs.Screen name="paywall" options={{ href: null }} />
      </Tabs>
    </SafeAreaProvider>
  );
}