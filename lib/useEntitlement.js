import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSubscriptionStatus } from '../store/purchases';

// Single source of truth for paywall gating. Returns `hasAccess` (true when
// user is paying or in active free trial — RevenueCat treats both as an
// active entitlement) plus a `loading` flag for the initial check.
//
// `has_premium` AsyncStorage flag is set in dev/beta builds so the gate
// doesn't block testing; production reads only RevenueCat.
export function useEntitlement() {
  const [hasAccess, setHasAccess] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);
  // Trial state — used by the Practice screen to show a countdown so
  // users on a 7-day trial know when the clock runs out.
  const [trialDaysLeft, setTrialDaysLeft] = useState(null);
  // RevenueCat periodType (TRIAL / NORMAL / INTRO) for the active
  // entitlement — null for dev overrides / no subscription. Lets surfaces
  // like the paywall distinguish a real subscriber from a dev-flagged
  // tester (who should still see the purchase flow).
  const [subscriptionPeriod, setSubscriptionPeriod] = useState(null);

  const refresh = useCallback(async () => {
    try {
      // Dev trial simulation: lets the developer preview the in-trial UX
      // (banner on Practice, etc.) without actually starting a sandbox
      // subscription. Set via settings-developer; takes priority over the
      // has_premium override so it can drive the banner during testing.
      const devTrialDays = await AsyncStorage.getItem('dev_trial_days_left');
      if (devTrialDays !== null) {
        setHasAccess(true);
        setTrialDaysLeft(parseInt(devTrialDays, 10));
        setSubscriptionPeriod('TRIAL');
        setLoading(false);
        return;
      }
      // Dev / beta override: bypass RevenueCat in unsigned builds. Note:
      // subscriptionPeriod stays null so the paywall still shows the
      // purchase flow for testers (they have access via override, not a
      // real subscription).
      const devFlag = await AsyncStorage.getItem('has_premium');
      if (devFlag === 'true') {
        setHasAccess(true);
        setTrialDaysLeft(null);
        setSubscriptionPeriod(null);
        setLoading(false);
        return;
      }
      const status = await getSubscriptionStatus();
      setHasAccess(!!status.isActive);
      setSubscriptionPeriod(status.periodType || null);
      // Compute days remaining in trial when applicable. Round up so a
      // partial day still reads as "1 day left" rather than "0."
      if (status.periodType === 'TRIAL' && status.expirationDate) {
        const ms = new Date(status.expirationDate).getTime() - Date.now();
        const days = Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
        setTrialDaysLeft(days);
      } else {
        setTrialDaysLeft(null);
      }
    } catch (e) {
      setHasAccess(false);
      setTrialDaysLeft(null);
      setSubscriptionPeriod(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-check on screen focus + when app comes to foreground (a purchase
  // may have completed in another flow / tab / push interaction).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { hasAccess, loading, refresh, trialDaysLeft, subscriptionPeriod };
}
