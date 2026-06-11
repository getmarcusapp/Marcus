import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ImageBackground, ActivityIndicator, Alert, ScrollView, Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { getOfferings, purchasePackage, restorePurchases } from '../store/purchases';
import { useEntitlement } from '../lib/useEntitlement';
import { ScreenHeader } from '../components/ScreenHeader';
import { GoldPrimary } from '../components/GoldButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { track } from '../lib/analytics';


export default function PaywallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  // When the paywall is reached during fresh onboarding, the post-paywall
  // landing is the ReadyStep ("Your practice begins now"). Otherwise
  // (e.g., upgrade from a locked surface) skip Ready and go straight to
  // Practice on cancel / restore. On a successful first-time purchase the
  // welcome screen acknowledges the threshold (see handlePurchase below).
  const postPaywallRoute = params?.from === 'onboarding' ? '/ready' : '/';
  // Successful purchases from non-onboarding contexts route through /welcome
  // first so the moment is acknowledged. From onboarding we keep the
  // existing /ready path which already carries the Day-1 threshold copy.
  const successRoute = params?.from === 'onboarding' ? '/ready' : '/welcome';
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(true);
  // Surface current trial state so a user who's already trialing sees
  // their countdown here instead of being re-pitched on subscribing.
  // alreadySubscribed = real RevenueCat trial or paid. Excludes dev/beta
  // overrides so testers still see the purchase flow when they hit the
  // paywall during onboarding.
  const { trialDaysLeft, subscriptionPeriod } = useEntitlement();
  const alreadySubscribed = subscriptionPeriod === 'TRIAL' || subscriptionPeriod === 'NORMAL';

  function openSubscriptionSettings() {
    // iOS deep link to the user's App Store subscriptions page — the
    // only legitimate place to cancel or change plans per Apple guidelines.
    Linking.openURL('https://apps.apple.com/account/subscriptions');
  }
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('annual'); // default annual

  useEffect(() => {
    loadOfferings();
    // Coarse funnel context only: where the paywall was reached from.
    track('paywall_view', { from: params?.from || 'direct' });
  }, []);

  async function loadOfferings() {
    setLoading(true);
    const offering = await getOfferings();
    setOfferings(offering);
    setLoading(false);
  }

  // Derived per-day price from the live store price (never hardcoded —
  // hardcoded fallbacks display wrong amounts in non-US storefronts).
  // Returns null when the price/currency isn't available or Intl can't
  // format it; callers simply omit the line in that case.
  function perDayLabel(pkg) {
    const p = pkg?.product;
    if (!p?.price || !p?.currencyCode) return null;
    try {
      const fmt = new Intl.NumberFormat(undefined, { style: 'currency', currency: p.currencyCode });
      return `${fmt.format(p.price / 365)} a day`;
    } catch {
      return null;
    }
  }

  function getPackageByType(type) {
    if (!offerings?.availablePackages) return null;
    return offerings.availablePackages.find(pkg =>
      type === 'annual'
        ? pkg.packageType === 'ANNUAL' || pkg.packageType === 'TWO_MONTH' ||
          pkg.identifier === '$rc_annual' || pkg.identifier.includes('annual') || pkg.identifier.includes('yearly')
        : pkg.packageType === 'MONTHLY' ||
          pkg.identifier === '$rc_monthly' || pkg.identifier.includes('monthly')
    );
  }

  async function handlePurchase() {
    const pkg = getPackageByType(selectedPackage);
    if (!pkg) {
      Alert.alert('', 'Product not available. Please try again.');
      return;
    }

    setPurchasing(true);
    const result = await purchasePackage(pkg);
    setPurchasing(false);

    if (result.success) {
      track('trial_started', { plan: selectedPackage, from: params?.from || 'direct' });
      // Don't write has_premium here — RevenueCat is the source of truth
      // for real subscriptions, and writing it would short-circuit the
      // trial-state detection (the user would never see "X days left").
      // The dev/beta override in _layout.jsx still sets has_premium=true
      // at launch for unsigned builds.
      router.replace(successRoute);
    } else if (!result.userCancelled) {
      track('purchase_failed', { plan: selectedPackage });
      Alert.alert('', 'Something went wrong. Please try again or restore your purchases.');
    }
  }

  async function handleRestore() {
    setPurchasing(true);
    const result = await restorePurchases();
    setPurchasing(false);

    if (result.isActive) {
      // Same reasoning as handlePurchase — let RevenueCat drive entitlement
      // state so trial / paid distinctions remain accurate.
      Alert.alert('', 'Purchase restored.', [
        { text: 'Continue', onPress: () => router.replace(postPaywallRoute) }
      ]);
    } else if (result.error) {
      // Network/store failure is not the same as "no subscription" — a
      // paying user offline must not be told their subscription is gone.
      Alert.alert('', "Couldn't reach the App Store. Check your connection and try again.");
    } else {
      Alert.alert('', 'No active subscription found.');
    }
  }

  const annualPkg = getPackageByType('annual');
  const monthlyPkg = getPackageByType('monthly');

  // Live store prices only. When offerings fail to load (offline, App Store
  // hiccup) the plan section renders a retry state instead of fake prices.
  const annualPrice = annualPkg?.product?.priceString;
  const monthlyPrice = monthlyPkg?.product?.priceString;
  const annualPerDay = perDayLabel(annualPkg);
  const offeringsUnavailable = !loading && !annualPkg && !monthlyPkg;

  // Top back chrome — shown whenever the paywall was reached from inside
  // the app (More · Subscription, requireAccess gates, etc.) so the user
  // is never stranded. Suppressed during onboarding, where the flow's
  // own "Continue without trial" path drives the exit.
  const showTopBack = params?.from !== 'onboarding';

  return (
    <SafeAreaView style={s.safe}>
      {showTopBack && (
        <ScreenHeader
          fromPath={params?.from || '/'}
          fromLabel={params?.fromLabel || 'Back'}
        />
      )}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <ImageBackground
          source={require('../assets/bg-svg4.png')}
          style={s.hero}
          resizeMode="cover"
        >
          <Image
            source={require('../assets/skull-gold.png')}
            style={s.skull}
            resizeMode="contain"
          />
          <Text style={s.eyebrow}>Marcus Premium</Text>
          <Text style={s.title}>Become someone{'\n'}you respect</Text>
          <Text style={s.sub}>
            A complete daily Stoic practice.{'\n'}
            {annualPrice ? `7 days free, then ${annualPrice}/year.` : 'Your first 7 days are free.'}
          </Text>
          {trialDaysLeft !== null && (
            <View style={s.trialStatusPill}>
              <Text style={s.trialStatusText}>
                {trialDaysLeft === 0
                  ? 'Your free trial ends today'
                  : `You're on day ${8 - trialDaysLeft} of 7 · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`}
              </Text>
              <Text style={s.trialStatusSub}>Manage your subscription in iOS Settings.</Text>
            </View>
          )}
        </ImageBackground>

        {/* Feature list */}
        <View style={s.features}>
          {[
            { icon: '◎', text: 'Daily compass, morning & evening journals' },
            { icon: '◎', text: 'Fresh Stoic readings every morning' },
            { icon: '◎', text: 'Emotion logger with Stoic reframes' },
            { icon: '◎', text: 'Weekly review with Virtue ledger' },
            { icon: '◎', text: 'Private by design. Your journal never leaves your device.' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Purchase flow — hidden for users who already have access (trial
            or paid). They see a Manage Subscription button instead. */}
        {alreadySubscribed ? (
          <>
            <GoldPrimary style={s.cta} onPress={openSubscriptionSettings}>
              <Text style={s.ctaText}>Manage subscription</Text>
            </GoldPrimary>
            <Text style={s.ctaNote}>
              Opens iOS Settings. Cancel anytime before your trial ends to avoid charges.
            </Text>
          </>
        ) : (
        <>
        {/* Plan selector */}
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
        ) : offeringsUnavailable ? (
          // Offerings couldn't load (offline / App Store hiccup). Never show
          // hardcoded prices — they'd be wrong in non-US storefronts and the
          // CTA would dead-end anyway. Offer a retry instead.
          <View style={s.plansError}>
            <Text style={s.plansErrorText}>
              Couldn't reach the App Store. Check your connection and try again.
            </Text>
            <TouchableOpacity style={s.retryBtn} onPress={loadOfferings} activeOpacity={0.8}>
              <Text style={s.retryBtnText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.plans}>

            {/* Annual — default/highlighted. Billed price is the headline;
                the per-day derivation stays secondary (3.1.2: the actual
                billed amount must be at least as prominent). */}
            {annualPkg && (
            <TouchableOpacity
              style={[s.planCard, selectedPackage === 'annual' && s.planCardSelected]}
              onPress={() => setSelectedPackage('annual')}
              activeOpacity={0.8}
            >
              <View style={s.planBadge}>
                <Text style={s.planBadgeText}>Best value</Text>
              </View>
              <View style={s.planTop}>
                <View style={[s.planRadio, selectedPackage === 'annual' && s.planRadioSelected]} />
                <Text style={[s.planName, selectedPackage === 'annual' && s.planNameSelected]}>Annual</Text>
              </View>
              <Text style={[s.planPrice, selectedPackage === 'annual' && s.planPriceSelected]}>
                {annualPrice}<Text style={s.planPeriod}>/year</Text>
              </Text>
              <Text style={[s.planNote, selectedPackage === 'annual' && s.planNoteSelected]}>
                {annualPerDay ? `${annualPerDay} · ` : ''}Save 37% vs monthly
              </Text>
            </TouchableOpacity>
            )}

            {/* Monthly */}
            {monthlyPkg && (
            <TouchableOpacity
              style={[s.planCard, selectedPackage === 'monthly' && s.planCardSelected]}
              onPress={() => setSelectedPackage('monthly')}
              activeOpacity={0.8}
            >
              <View style={s.planTop}>
                <View style={[s.planRadio, selectedPackage === 'monthly' && s.planRadioSelected]} />
                <Text style={[s.planName, selectedPackage === 'monthly' && s.planNameSelected]}>Monthly</Text>
              </View>
              <Text style={[s.planPrice, selectedPackage === 'monthly' && s.planPriceSelected]}>
                {monthlyPrice}<Text style={s.planPeriod}>/month</Text>
              </Text>
              <Text style={[s.planNote, selectedPackage === 'monthly' && s.planNoteSelected]}>
                Cancel anytime
              </Text>
            </TouchableOpacity>
            )}

          </View>
        )}

        {/* CTA — hidden when there's nothing purchasable to start */}
        {!offeringsUnavailable && (
        <>
        <GoldPrimary
          style={s.cta}
          onPress={handlePurchase}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={s.ctaText}>Start 7-day free trial →</Text>
          )}
        </GoldPrimary>

        <Text style={s.ctaNote}>
          No charge until day 7. Cancel anytime.
        </Text>
        </>
        )}
        </>
        )}

        {/* Restore */}
        <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} activeOpacity={0.7}>
          <Text style={s.restoreText}>Restore purchases</Text>
        </TouchableOpacity>

        {/* Decline / exit path — copy depends on whether the user already
            has access. Subscribed/trialing users see "Done" so they can
            return to the app; new users see "Continue without trial" so
            they can decline the trial and enter in read-only mode. */}
        <TouchableOpacity
          style={s.skipBtn}
          onPress={() => {
            if (!alreadySubscribed) track('paywall_declined', { from: params?.from || 'direct' });
            // Prefer the explicit `from` param if the paywall was opened
            // from a specific surface (More · Subscription, locked features,
            // etc.). Falls back to postPaywallRoute for the onboarding flow
            // which doesn't pass a destination.
            const declineRoute = params?.from && params.from !== 'onboarding' ? params.from : postPaywallRoute;
            router.replace(declineRoute);
          }}
          activeOpacity={0.7}
        >
          <Text style={s.skipBtnText}>{alreadySubscribed ? 'Done' : 'Continue without trial'}</Text>
        </TouchableOpacity>

        <Text style={s.legal}>
          Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.
          {alreadySubscribed ? ' Manage your subscription in iOS Settings.' : ''}
        </Text>

        {/* Terms + Privacy — required in the binary for auto-renewable
            subscriptions (Guideline 3.1.2). Terms uses Apple's standard EULA. */}
        <View style={s.legalLinks}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.legalLinkText}>Terms of Use</Text>
          </TouchableOpacity>
          <Text style={s.legalLinkDot}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://getmarcus.app/privacy.html')}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.legalLinkText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { paddingBottom: 48 },

  hero: {
    backgroundColor: colors.bgDeep,
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  skull: { width: 80, height: 80, marginBottom: 20, opacity: 0.9 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontSize: 44, fontFamily: font.display, color: '#FFFFFF', letterSpacing: -1.5, textAlign: 'center', marginBottom: 14, lineHeight: 52 },
  sub: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  // Active-trial banner inside the hero — shown only when the visiting
  // user is currently in a 7-day trial, so we don't re-pitch them.
  trialStatusPill: {
    marginTop: 20,
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingVertical: 12, paddingHorizontal: 16,
    alignItems: 'center',
  },
  trialStatusText: { fontSize: 13, color: colors.accent, letterSpacing: 0.4, fontFamily: font.bodySemiBold },
  trialStatusSub: { fontSize: 12, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },

  features: {
    padding: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  featureIcon: { fontSize: 14, color: colors.accent, marginTop: 1 },
  featureText: { flex: 1, fontSize: 15, color: colors.textSecondary, lineHeight: 22 },

  plans: { padding: spacing.md, gap: 10 },

  planCard: {
    borderWidth: 0.5, borderColor: colors.border,
    borderRadius: radius.md, padding: 20,
    backgroundColor: colors.bgCard,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.bg,
  },
  planBadge: {
    position: 'absolute', top: -1, right: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 10, paddingVertical: 3,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
  },
  planBadgeText: { fontSize: 11, fontFamily: font.bodyBold, color: '#000', letterSpacing: 0.5 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: 8 },
  planRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border },
  planRadioSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  planName: { fontSize: 16, fontFamily: font.bodyMedium, color: colors.textSecondary },
  planNameSelected: { color: colors.textPrimary },
  planPrice: { fontSize: 28, fontFamily: font.display, color: colors.textSecondary, letterSpacing: -0.5 },
  planPriceSelected: { color: colors.accent },
  planPeriod: { fontSize: 14, fontFamily: font.body },
  planNote: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  planNoteSelected: { color: colors.accentDim },

  // H56 per library — matches onboarding primaryBtn and keyboard accessory.
  cta: {
    marginHorizontal: spacing.md,
    marginTop: 8,
    height: 56,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 15, fontFamily: font.bodyBold, color: '#000', letterSpacing: 0.3 },
  ctaNote: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 10, marginHorizontal: spacing.md },

  restoreBtn: { alignItems: 'center', padding: 16, marginTop: 4 },
  restoreText: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.3, textDecorationLine: 'underline' },
  skipBtn: { alignItems: 'center', padding: 12, marginTop: 0 },
  skipBtnText: { fontSize: 13, color: colors.textSecondary, letterSpacing: 0.3, textDecorationLine: 'underline' },

  legal: {
    fontSize: 12, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 18, marginHorizontal: spacing.xl, marginTop: 8,
  },
  legalLinks: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 8, marginTop: 12,
  },
  legalLinkText: { fontSize: 12, color: colors.textSecondary, textDecorationLine: 'underline' },
  legalLinkDot: { fontSize: 12, color: colors.textSecondary },

  plansError: { padding: spacing.xl, alignItems: 'center' },
  plansErrorText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  retryBtn: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    paddingVertical: 12, paddingHorizontal: 28,
  },
  retryBtnText: { fontSize: 14, color: colors.accent, letterSpacing: 0.3 },
});
