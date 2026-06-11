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

// Check if user has active premium subscription
export async function getSubscriptionStatus() {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const isActive = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
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

// Purchase a package
export async function purchasePackage(pkg) {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    // If no error was thrown, the purchase succeeded on Apple's side.
    // RevenueCat may take a moment to sync the entitlement — treat the
    // absence of an error as success rather than checking entitlement
    // immediately, which can fail in sandbox due to sync delay.
    return { success: true, customerInfo };
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
    const isActive = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
    return { success: true, isActive };
  } catch (e) {
    console.log('restorePurchases error:', e);
    return { success: false, isActive: false, error: true };
  }
}
