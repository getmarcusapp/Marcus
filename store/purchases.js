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
    const isActive = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
    return { success: isActive, customerInfo };
  } catch (e) {
    if (!e.userCancelled) {
      console.log('purchasePackage error:', e);
    }
    return { success: false, userCancelled: e.userCancelled };
  }
}

// Restore purchases (required by App Store guidelines)
export async function restorePurchases() {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isActive = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
    return { success: true, isActive };
  } catch (e) {
    console.log('restorePurchases error:', e);
    return { success: false, isActive: false };
  }
}
