import { useEffect, useState, useRef } from 'react';
import { Tabs, useRouter, useSegments, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, AppState, Platform, StyleSheet, Image } from 'react-native';
import { colors, font } from '../constants/theme';
import { hasOnboarded, getHasSeenCompassIntro, setHasSeenCompassIntro } from '../store/db';
import { initializePurchases } from '../store/purchases';
import { scheduleReengagementNotifications, scheduleAllNotifications } from '../notifications';
import * as health from '../lib/health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MiniMeditationPlayer } from '../components/MiniMeditationPlayer';
import { LockScreen } from '../components/LockScreen';
import { LaunchSplash } from '../components/LaunchSplash';
import { initAppLock, handleForeground, handleBackground, useAppLock } from '../lib/appLock';
import { initAnalytics, track } from '../lib/analytics';
import { getUnreadCount, subscribeDispatches, refreshDispatches } from '../lib/dispatches';
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_300Light_Italic } from '@expo-google-fonts/inter';
import { Cinzel_400Regular } from '@expo-google-fonts/cinzel';

function TabIcon({ name, color, size = 22 }) {
  return <Ionicons name={name} size={size} color={color} />;
}

// Custom hamburger for the More tab. Ionicons' reorder-three-outline glyph
// has fixed line spacing; this builds the three bars as Views so the gap
// between them is tunable. `gap` is the breathing room V wanted.
function HamburgerIcon({ color, size = 26, barWidth = 22, barHeight = 2, gap = 4 }) {
  const bar = { width: barWidth, height: barHeight, borderRadius: 1, backgroundColor: color };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[bar, { marginBottom: gap }]} />
      <View style={[bar, { marginBottom: gap }]} />
      <View style={bar} />
    </View>
  );
}

// Maps the current pathname to the logical tab a user is "in" so the
// right tab icon stays illuminated even when the underlying route is
// one of the hidden (href:null) flow screens like /compass or /journal.
const PRACTICE_ROUTES = new Set([
  '/', '/index', '/compass', '/read', '/journal', '/review', '/meditate',
  '/journal-history', '/read-archive', '/review-archive', '/foundations',
  '/prosoche',
]);

// Routes a notification tap to the screen named in its content.data.route.
// Nothing else deep-links today; the midday Prosoche reminder is the first
// consumer. useLastNotificationResponse covers both the cold-start launch
// (app opened by tapping the notification) and warm taps while running. A
// ref guards against re-navigating for the same response on re-render, and
// a short defer lets the router + OnboardingGate settle on cold start.
function NotificationRouter() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handledRef = useRef(null);
  useEffect(() => {
    const route = response?.notification?.request?.content?.data?.route;
    if (!route) return;
    const key = response.notification?.request?.identifier ?? route;
    if (handledRef.current === key) return;
    handledRef.current = key;
    const t = setTimeout(() => { try { router.push(route); } catch {} }, 400);
    return () => clearTimeout(t);
  }, [response]);
  return null;
}
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
  return <TabIcon name={iconName} size={size} color={active ? colors.accent : colors.textSecondary} />;
}

function ManagedHamburgerIcon({ tabKey }) {
  const active = useLogicalTabKey() === tabKey;
  // Subtle unread dot for Dispatches. Self-subscribes so it clears the moment
  // the inbox marks things read; no prop threading through Tabs options.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => getUnreadCount().then(n => { if (alive) setUnread(n); }).catch(() => {});
    refresh();
    const unsub = subscribeDispatches(refresh);
    return () => { alive = false; unsub(); };
  }, []);
  return (
    <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <HamburgerIcon color={active ? colors.accent : colors.textSecondary} />
      {unread > 0 && (
        <View style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.accent }} />
      )}
    </View>
  );
}

function ManagedTabLabel({ label, tabKey }) {
  const active = useLogicalTabKey() === tabKey;
  return (
    <Text
      style={{ fontSize: 9, letterSpacing: 1.4, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 3, color: active ? colors.accent : colors.textSecondary }}
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
  const { isLocked, lockEnabled } = useAppLock();
  // Animated launch splash sits over the app until it dissolves away.
  const [splashDone, setSplashDone] = useState(false);
  // True while the app is inactive/backgrounded. With App Lock on, an opaque
  // cover renders during that window so iOS's app-switcher snapshot captures
  // the skull — not the user's journal text. Without it, the lock's privacy
  // promise is defeated by the switcher carousel.
  const [appBlurred, setAppBlurred] = useState(false);
  // Block first paint until brand fonts are loaded so headlines, body,
  // and the Marcus wordmark all land with the right typography on cold
  // start. Cinzel (display) is bundled now that it replaced iOS-system Didot.
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_300Light_Italic,
    Cinzel_400Regular,
  });
  // If font loading errors (rare — they're bundled — but possible), render
  // the app with system-font fallbacks rather than spinning on the splash
  // forever. A wrong typeface beats a bricked app.
  const appReady = fontsLoaded || !!fontError;

  // Note: there used to be a Text.defaultProps mutation here that set Inter
  // as the app-wide default font. React 19 / RN 0.81 no longer read
  // defaultProps on function components, so it was a silent no-op — any
  // <Text> that needs Inter must set fontFamily explicitly (font.body et
  // al. from constants/theme).

  useEffect(() => {
    // Boot the app lock first so the lock screen can show immediately on
    // cold start if the user enabled it. await isn't needed since the hook
    // subscribes and re-renders when state lands.
    initAppLock();

    initAnalytics();
    track('app_started');

    initializePurchases();
    scheduleReengagementNotifications();
    scheduleAllNotifications();
    // Pull the announcements feed on cold start so the More tab dot is
    // accurate before the user ever opens More. Fire-and-forget; cached feed
    // covers offline.
    refreshDispatches().catch(() => {});
    // Re-init HealthKit if user previously granted, so writes work this session.
    // No iOS prompt is shown — initHealthKit is a no-op once iOS has the answer cached.
    (async () => {
      const asked = await AsyncStorage.getItem('health_permission_asked');
      if (asked === 'true') await health.requestPermission();
    })();
    // Bypass paywall in dev and beta builds. In production, proactively
    // remove any persisted dev overrides — AsyncStorage survives the
    // TestFlight-beta → App Store update, and a stale has_premium flag
    // must not grant lifetime access. useEntitlement also ignores these
    // flags outside dev/beta; this cleanup is belt-and-braces.
    if (__DEV__ || process.env.EXPO_PUBLIC_IS_BETA === 'true') {
      AsyncStorage.setItem('has_premium', 'true');
    } else {
      AsyncStorage.multiRemove(['has_premium', 'dev_trial_days_left']).catch(() => {});
    }

    // AppState listener handles two things: re-schedule notifications on
    // foreground (existing), and the app-lock background/foreground
    // transitions (new). Re-lock kicks in if the app was backgrounded
    // for more than the threshold defined in lib/appLock.js.
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        setAppBlurred(false);
        scheduleAllNotifications();
        handleForeground();
        refreshDispatches().catch(() => {});
      } else if (state === 'background' || state === 'inactive') {
        setAppBlurred(true);
        handleBackground();
      }
    });
    return () => sub.remove();
  }, []);

  // Note: we no longer return null while fonts load — instead the LaunchSplash
  // overlay (which matches the native splash) covers everything until fonts are
  // ready, then animates away, so there's never a blank flash.
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      {appReady && (
      <SafeAreaProvider>
      <OnboardingGate />
      <NotificationRouter />
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          // Hide tab bar on onboarding + paywall so users can't trivially
          // bypass the subscription gate by tapping a tab. Paywall is the
          // single entry point to the app for non-trialing, non-paying
          // users.
          tabBarStyle: (route.name === 'onboarding' || route.name === 'paywall' || route.name === 'ready' || route.name === 'welcome') ? { display: 'none' } : {
            backgroundColor: colors.bg,
            borderTopColor: colors.border,
            borderTopWidth: 0.5,
            height: 84,
            paddingBottom: 24,
            paddingTop: 10,
          },
          // iOS keyboard backdrop samples the tab bar behind it; the gold
          // active-tab icon / label was bleeding through as a warm tint.
          // Hide the bar while the keyboard is up to kill the leak.
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textSecondary,
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
            // Custom HamburgerIcon (not the reorder-three-outline glyph) so the
            // gap between the three bars is tunable. Per Valeriya's preference —
            // gives the
            // hamburger room to feel like a deliberate symbol, not a stack.
            tabBarIcon: () => <ManagedHamburgerIcon tabKey="more" />,
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
        <Tabs.Screen name="dispatches" options={{ href: null }} />
        <Tabs.Screen name="foundations" options={{ href: null }} />
        <Tabs.Screen name="foundations-list" options={{ href: null }} />
        <Tabs.Screen name="meditate" options={{ href: null }} />
        <Tabs.Screen name="prosoche" options={{ href: null }} />
        <Tabs.Screen name="imagery" options={{ href: null }} />
        <Tabs.Screen name="library" options={{ href: null }} />
        <Tabs.Screen name="paywall" options={{ href: null }} />
        <Tabs.Screen name="ready" options={{ href: null }} />
        <Tabs.Screen name="welcome" options={{ href: null }} />
        <Tabs.Screen name="journal-history" options={{ href: null }} />
        <Tabs.Screen name="review-archive" options={{ href: null }} />
        <Tabs.Screen name="emotions-history" options={{ href: null }} />
        <Tabs.Screen name="read-archive" options={{ href: null }} />
      </Tabs>
      <MiniMeditationPlayer />
      {isLocked && <LockScreen />}
    </SafeAreaProvider>
      )}
      {!splashDone && (
        <LaunchSplash active={appReady} onDone={() => setSplashDone(true)} />
      )}
      {/* Snapshot privacy cover — topmost, only while backgrounded with
          App Lock on. FaceID's own system sheet briefly flips AppState to
          inactive too; covering during that blink is harmless. */}
      {lockEnabled && appBlurred && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }]}>
          <Image
            source={require('../assets/skull-gold.png')}
            style={{ width: 96, height: 96, opacity: 0.9 }}
            resizeMode="contain"
          />
        </View>
      )}
    </View>
  );
}