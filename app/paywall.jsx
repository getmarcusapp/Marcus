import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, Image, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius, spacing, font } from '../constants/theme';
import { getOfferings, purchasePackage, restorePurchases } from '../store/purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HERO_GRADIENT = ['#4a3a26', '#1a1410', '#000000'];

export default function PaywallScreen() {
  const router = useRouter();
  const [offerings, setOfferings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('annual'); // default annual

  useEffect(() => {
    loadOfferings();
  }, []);

  async function loadOfferings() {
    const offering = await getOfferings();
    setOfferings(offering);
    setLoading(false);
  }

  function getPackageByType(type) {
    if (!offerings?.availablePackages) {
      console.log('No available packages in offerings:', offerings);
      return null;
    }
    console.log('Available packages:', offerings.availablePackages.map(p => ({
      id: p.identifier,
      type: p.packageType,
      product: p.product?.productIdentifier
    })));
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
      await AsyncStorage.setItem('has_premium', 'true');
      router.replace('/');
    } else if (!result.userCancelled) {
      Alert.alert('', 'Something went wrong. Please try again or restore your purchases.');
    }
  }

  async function handleRestore() {
    setPurchasing(true);
    const result = await restorePurchases();
    setPurchasing(false);

    if (result.isActive) {
      await AsyncStorage.setItem('has_premium', 'true');
      Alert.alert('', 'Purchase restored.', [
        { text: 'Continue', onPress: () => router.replace('/') }
      ]);
    } else {
      Alert.alert('', 'No active subscription found.');
    }
  }

  const annualPkg = getPackageByType('annual');
  const monthlyPkg = getPackageByType('monthly');

  const annualPrice = annualPkg?.product?.priceString || '$59.99';
  const monthlyPrice = monthlyPkg?.product?.priceString || '$7.99';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <LinearGradient
          colors={HERO_GRADIENT}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.hero}
        >
          <Image
            source={require('../assets/skull.png')}
            style={s.skull}
            resizeMode="contain"
          />
          <Text style={s.eyebrow}>Marcus Premium</Text>
          <Text style={s.title}>Become someone{'\n'}you respect.</Text>
          <Text style={s.sub}>A complete daily Stoic practice.{'\n'}7 days free, then 16¢ a day.</Text>
        </LinearGradient>

        {/* Feature list */}
        <View style={s.features}>
          {[
            { icon: '◎', text: 'Daily compass, morning & evening journals' },
            { icon: '◎', text: 'Fresh Stoic readings every morning' },
            { icon: '◎', text: 'Emotion logger with Stoic reframes' },
            { icon: '◎', text: 'Weekly Virtue review' },
            { icon: '◎', text: 'No account. No data harvesting. Fully private.' },
          ].map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
        ) : (
          <View style={s.plans}>

            {/* Annual — default/highlighted */}
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
                16¢<Text style={s.planPeriod}>/day</Text>
              </Text>
              <Text style={[s.planNote, selectedPackage === 'annual' && s.planNoteSelected]}>
                Billed {annualPrice}/year · Save 37% vs monthly
              </Text>
            </TouchableOpacity>

            {/* Monthly */}
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

          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[s.cta, purchasing && s.ctaDisabled]}
          onPress={handlePurchase}
          activeOpacity={0.85}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={s.ctaText}>Start 7-day free trial →</Text>
          )}
        </TouchableOpacity>

        <Text style={s.ctaNote}>
          Free for 7 days · then 16¢/day annual or $7.99/mo · Cancel anytime
        </Text>

        {/* Restore */}
        <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} activeOpacity={0.7}>
          <Text style={s.restoreText}>Restore purchases</Text>
        </TouchableOpacity>

        <Text style={s.legal}>
          Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage your subscription in iOS Settings.
        </Text>

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
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 12 },
  title: { fontSize: font.heroSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -1, textAlign: 'center', marginBottom: 14, lineHeight: 42 },
  sub: { fontSize: 15, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },

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
    borderRadius: radius.lg, padding: 20,
    backgroundColor: colors.bgCard,
    position: 'relative',
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentBg,
  },
  planBadge: {
    position: 'absolute', top: -1, right: 16,
    backgroundColor: colors.accent,
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: '0 0 6px 6px',
  },
  planBadgeText: { fontSize: 10, fontWeight: '700', color: '#000', letterSpacing: 0.5 },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, marginTop: 8 },
  planRadio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.borderMid },
  planRadioSelected: { borderColor: colors.accent, backgroundColor: colors.accent },
  planName: { fontSize: 16, fontWeight: '500', color: colors.textMuted },
  planNameSelected: { color: colors.textPrimary },
  planPrice: { fontSize: 28, fontWeight: '300', color: colors.textMuted, letterSpacing: -0.5 },
  planPriceSelected: { color: colors.accent },
  planPeriod: { fontSize: 14, fontWeight: '400' },
  planNote: { fontSize: 13, color: colors.textDim, marginTop: 4 },
  planNoteSelected: { color: colors.accentDim },

  cta: {
    marginHorizontal: spacing.md,
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: 18,
    alignItems: 'center',
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 16, fontWeight: '700', color: '#000', letterSpacing: 0.3 },
  ctaNote: { fontSize: 12, color: colors.textDim, textAlign: 'center', marginTop: 10, marginHorizontal: spacing.md },

  restoreBtn: { alignItems: 'center', padding: 16, marginTop: 4 },
  restoreText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.3 },

  legal: {
    fontSize: 12, color: colors.textDim, textAlign: 'center',
    lineHeight: 18, marginHorizontal: spacing.xl, marginTop: 8,
  },
});
