import { useEffect, useState } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '../constants/theme';
import { hasOnboarded } from '../store/db';
import { initializePurchases, getSubscriptionStatus } from '../store/purchases';

function TabIcon({ name, color }) {
  return <Ionicons name={name} size={22} color={color} />;
}

function OnboardingGate() {
  const router = useRouter();

  useEffect(() => {
    async function check() {
      try {
        // Initialize RevenueCat — wrapped in try/catch so a failure
        // never crashes the app
        await initializePurchases();
      } catch (e) {
        console.log('RevenueCat init failed, proceeding without paywall:', e);
      }

      const onboarded = await hasOnboarded();
      if (!onboarded) {
        router.replace('/onboarding');
        return;
      }

      // Check subscription — default to allowing access if anything fails
      try {
        const status = await getSubscriptionStatus();
        if (!status.isActive) {
          router.replace('/paywall');
        }
      } catch (e) {
        console.log('Subscription check failed, allowing access:', e);
        // Do not block app access if RevenueCat is unreachable
      }
    }
    check();
  }, []);

  return null;
}

export default function Layout() {
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
        <Tabs.Screen name="read" options={{ title: 'Read', tabBarIcon: ({ color }) => <TabIcon name="book-outline" color={color} /> }} />
        <Tabs.Screen name="emotions" options={{ title: 'Emotions', tabBarIcon: ({ color }) => <TabIcon name="heart-outline" color={color} /> }} />
        <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <TabIcon name="menu-outline" color={color} /> }} />
        <Tabs.Screen name="journal" options={{ href: null }} />
        <Tabs.Screen name="compass" options={{ href: null }} />
        <Tabs.Screen name="review" options={{ href: null }} />
        <Tabs.Screen name="settings" options={{ href: null }} />
        <Tabs.Screen name="onboarding" options={{ href: null, tabBarStyle: { display: 'none' } }} />
        <Tabs.Screen name="howto" options={{ href: null }} />
        <Tabs.Screen name="paywall" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      </Tabs>
    </SafeAreaProvider>
  );
}