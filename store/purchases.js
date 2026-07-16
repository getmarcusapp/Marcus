import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_KEY || 'test_FUdbIroRCeAeiuNnHmHtQZOTSQH';
const ENTITLEMENT_ID = 'Marcus Premium';

// Initialize RevenueCat — call once on app start
export async function initializePurchases() {
  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    await Purchases.configure({ apiKey: RC_API_KEY });
  } catch (e) {
    console.log('RevenueCat init error:', e);
  }
}

// The single place that answers "does this customerInfo grant access?".
// Everything below goes through it so the entitlement key is never
// re-typed — an exact-match lookup against a key that doesn't exist fails
// silently and forever, which is precisely how the paywall shipped broken
// from April to July 2026 (code read the RevenueCat *display name*, not the
// *identifier*).
function isEntitled(customerInfo) {
  return typeof customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== 'undefined';
}

// Re-fetch customerInfo a few times, looking for the entitlement to appear.
// RevenueCat can lag briefly behind StoreKit right after a purchase. Returns
// the customerInfo that carries the entitlement, or null if it never showed.
async function waitForEntitlement(attempts = 3, delayMs = 1200) {
  for (let i = 0; i < attempts; i++) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    try {
      const info = await Purchases.getCustomerInfo();
      if (isEntitled(info)) return info;
    } catch (e) {
      // Transient fetch failure — keep trying until attempts run out.
    }
  }
  return null;
}

// Check if user has active premium subscription
export async function getSubscriptionStatus() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const isActive = isEntitled(customerInfo);
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    return {
      isActive,
      expirationDate: entitlement?.expirationDate || null,
      productIdentifier: entitlement?.productIdentifier || null,
      willRenew: entitlement?.willRenew || false,
      // RevenueCat periodType: 'TRIAL' | 'INTRO' | 'NORMAL'. We surface
      // this so the UI can show a "Day N of trial" indicator while a
      // free trial is active.
      periodType: entitlement?.periodType || null,
    };
  } catch (e) {
    console.log('getSubscriptionStatus error:', e);
    return { isActive: false };
  }
}

// Get available offerings from RevenueCat
export async function getOfferings() {
  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) return offerings.current;
    return null;
  } catch (e) {
    console.log('getOfferings error:', e);
    return null;
  }
}

// Purchase a package.
//
// Returns one of three outcomes, because "Apple took the money" and "the user
// has access" are different questions and conflating them is how a paying
// customer ends up staring at a success screen inside a locked app:
//   { success: true,  entitled: true  } — charged AND entitled. Let them in.
//   { success: true,  entitled: false } — charged but the entitlement never
//       materialized (RevenueCat misconfigured, or a sync that never lands).
//       Never report this as failure: they HAVE been charged. Point at Restore.
//   { success: false }                  — no charge. Cancelled or errored.
export async function purchasePackage(pkg) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (isEntitled(customerInfo)) {
      return { success: true, entitled: true, customerInfo };
    }
    // Not entitled in the purchase response. Usually a brief sync lag, so
    // give RevenueCat a few seconds before drawing any conclusion.
    const settled = await waitForEntitlement();
    if (settled) return { success: true, entitled: true, customerInfo: settled };
    // Charged, still no entitlement. Report it honestly rather than guessing.
    console.log('purchasePackage: charged but entitlement never appeared');
    return { success: true, entitled: false, customerInfo };
  } catch (e) {
    if (!e.userCancelled) {
      console.log('purchasePackage error:', e);
    }
    return { success: false, userCancelled: e.userCancelled };
  }
}

// Restore purchases (required by App Store guidelines). `error: true`
// distinguishes "couldn't reach the store" (offline, RC outage) from a
// genuine no-subscription result — a paying user offline must not be told
// they have no subscription.
export async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { success: true, isActive: isEntitled(customerInfo) };
  } catch (e) {
    console.log('restorePurchases error:', e);
    return { success: false, isActive: false, error: true };
  }
}
