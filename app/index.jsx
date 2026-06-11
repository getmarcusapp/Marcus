import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image, Animated, ActivityIndicator,
  Dimensions, AppState,
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
// Page-level fixed bg. Sized exactly to the viewport so bg.png
// (2364×5120, ~9:19.5 phone aspect) displays at its natural aspect with
// imperceptible side crop — the hourglass curves are uncropped and
// clearly visible. The cards scroll over this fixed layer.
//
// True parallax (bg drifting at a fraction of scroll speed) is not used
// here because it requires a container TALLER than the viewport for
// drift room, and any extra height forces cover-mode to crop the image
// sides — which clips the hourglass curves and produces a solid-dark
// failure. Revisit if/when V supplies a taller bg-parallax.png asset
// designed with vertical headroom built in.
const PARALLAX_BG_HEIGHT = SCREEN_H;
import { MEDITATIONS, MEDITATIONS_LIST, useMeditationPlayer, toggle as toggleMeditation, formatMedTime } from '../lib/meditationPlayer';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { useDeviceTilt } from '../lib/useDeviceTilt';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { morningQuotes, mementoMoriQuotes, getDailyQuote } from '../constants/quotes';
import { getTodayJournal, getStreak, getTodayReading, getCompassDone, getReviews } from '../store/db';
import { refreshNotificationsForToday, onPracticeSealed } from '../notifications';
import { FOUNDATIONS_LETTERS } from '../constants/foundations';
import { getFoundationsState } from '../lib/foundations';
import { LinearGradient } from 'expo-linear-gradient';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';
import { useEntitlement } from '../lib/useEntitlement';


const virtuePronunciations = {
  sophia: 'soh-FEE-ah',
  andreia: 'an-DRAY-ah',
  sophrosyne: 'soh-FROH-sih-nee',
  dikaiosyne: 'dee-KAY-oh-sih-nee',
};

// Pick a meditation contextual to the time of day:
// morning -> Premeditatio Malorum (look ahead), midday -> View From Above
// (perspective), evening -> Evening Examination (account for the day).
function pickContextualMeditation() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return MEDITATIONS['premeditatio'];
  if (hour >= 18 || hour < 5) return MEDITATIONS['evening-examination'];
  return MEDITATIONS['view-from-above'];
}

// Compact gallery card for the "More meditations" swipe row on the Practice
// page. Reads the shared player snapshot to show its own play/pause state;
// tapping plays it inline via the singleton player.
function MeditationGalleryCard({ med, player, onPress }) {
  const isCurrent = player.currentMedId === med.id;
  const isPlaying = isCurrent && player.isPlaying;
  const isLoading = isCurrent && player.isLoading;
  return (
    <TouchableOpacity
      style={s.galleryCard}
      onPress={() => onPress(med)}
      activeOpacity={0.85}
      disabled={isLoading}
    >
      <View style={s.galleryImageWrap}>
        <Image source={med.image} style={s.galleryImage} resizeMode="cover" />
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
          style={s.medImageOverlay}
        />
        <View style={s.galleryPlay}>
          {isLoading ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={30} color={colors.accent} />
          )}
        </View>
      </View>
      <Text style={s.gallerySubtitle} numberOfLines={1}>{med.subtitle}</Text>
      <Text style={s.galleryTitle} numberOfLines={2}>{med.title}</Text>
      <Text style={s.galleryMeta}>{med.duration}</Text>
    </TouchableOpacity>
  );
}

export default function PracticeScreen() {
  const router = useRouter();
  const playerInset = useMiniPlayerInset();
  const { tiltTransform } = useDeviceTilt();
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [compassDone, setCompassDone] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [streak, setStreak] = useState({ current: 0, longest: 0, totalDays: 0 });
  // Foundations card state: { nextUnread, unlockedCount, read, daysSinceStart }
  // or null when the card is past its window. Unlike the first cut (which
  // hid the card the moment today's letter was read — it read as a glitch
  // and killed the "tomorrow:" anticipation hook), the card stays for the
  // rest of the day in a quiet read state pointing at tomorrow's letter.
  const [foundations, setFoundationsState] = useState(null);
  const [todayDate, setTodayDate] = useState(new Date());
  const [reviewDay, setReviewDay] = useState(0);
  const [reviewDone, setReviewDone] = useState(false);
  const [totalDays, setTotalDays] = useState(0);

  // Inline meditation player — backed by a module-level singleton in
  // lib/meditationPlayer.js so audio survives navigation between tabs.
  const todayMed = pickContextualMeditation();
  const player = useMeditationPlayer();
  const isCurrentMed = player.currentMedId === todayMed.id;
  const medIsPlaying = isCurrentMed && player.isPlaying;
  const medIsLoading = isCurrentMed && player.isLoading;
  const medPosition = isCurrentMed ? player.position : 0;
  const medDuration = isCurrentMed ? player.duration : 0;
  const medProgress = medDuration > 0 ? medPosition / medDuration : 0;
  const medHasLoaded = medDuration > 0;

  const { hasAccess, trialDaysLeft } = useEntitlement();
  // Play/pause any meditation (featured card or gallery card) through the
  // shared singleton player, gated on entitlement.
  function playMed(med) {
    if (!hasAccess) { router.push('/paywall'); return; }
    haptics.tap();
    toggleMeditation(med);
  }
  function toggleMedPlay() { playMed(todayMed); }
  // The other five meditations browse-able in the gallery beneath the
  // featured contextual pick (featured-first).
  const otherMeds = MEDITATIONS_LIST.filter(m => m.id !== todayMed.id);

  const today = todayDate;
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  // Weekly review is highlighted only on the user's chosen review day.
  // The row remains tappable every day, so missed Sundays can still be
  // caught up — they just no longer pretend to be Sunday.
  // Requires minimum 3 completed practice days before surfacing.
  const dayOfWeek = today.getDay();
  const hasEnoughPractice = totalDays >= 3;
  const isReviewDay = hasEnoughPractice && dayOfWeek === reviewDay;

  const quote = getDailyQuote(morningQuotes);
  const sealQuote = getDailyQuote(mementoMoriQuotes, 7);

  const load = useCallback(async () => {
    const now = new Date();
    setTodayDate(now);
    const morning = await getTodayJournal('morning');
    const evening = await getTodayJournal('evening');
    const reading = await getTodayReading();
    const compassToday = await getCompassDone();
    const s = await getStreak();
    setTotalDays(s.totalDays || 0);
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.reviewDay !== undefined) setReviewDay(parsed.reviewDay);
      }
    } catch {
      // Corrupt settings shouldn't take down the whole load — the done
      // flags below matter more than the review-day preference.
    }
    // Check if weekly review was completed this review window
    const reviews = await getReviews();
    const weekAgo = Date.now() - 3 * 24 * 60 * 60 * 1000; // 3-day window
    const reviewedThisWindow = reviews.some(r => new Date(r.date).getTime() > weekAgo);
    setReviewDone(reviewedThisWindow);
    setMorningDone(!!morning);
    setEveningDone(!!evening);
    setReadingDone(!!reading);
    setCompassDone(compassToday);
    setStreak(s);
    // Foundations card: lives through the unlock week (and a grace window
    // for users with unread letters), then retires to the Library for good.
    try {
      const f = await getFoundationsState();
      const seriesDone = f.read.length >= FOUNDATIONS_LETTERS.length;
      const inWindow = f.daysSinceStart < 14 && !seriesDone;
      setFoundationsState(inWindow ? f : null);
    } catch {
      setFoundationsState(null);
    }
    // Re-sync notifications against today's done-state
    refreshNotificationsForToday().catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    sealedScrollRef.current?.scrollTo({ y: 0, animated: false });
    load();
  }, [load]));

  // useFocusEffect fires on navigation focus, not app foreground — without
  // this, a user who sealed yesterday and reopens the app after midnight
  // lands on yesterday's sealed screen (stale date, stale done flags) until
  // they bounce to another tab and back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  // Daily practice is a fixed 4-step flow. Weekly Review is a separate
  // cadence surfaced as its own tile and does not count toward daily progress.
  const totalItems = 4;
  const completed = [compassDone, readingDone, morningDone, eveningDone]
    .filter(v => v === true).length;
  const allDone = completed >= 4;
  const morningComplete = !allDone && compassDone && readingDone && morningDone && !eveningDone;
  const progress = Math.min(completed / 4, 1);
  const nextItem = !compassDone ? 'compass'
    : !readingDone ? 'reading'
    : !morningDone ? 'morning'
    : !eveningDone ? 'evening'
    : null;

  // Re-arm the win-back ladder when practice is sealed; fire a three-beat
  // haptic rhythm (light → medium → success) once per day on the first seal.
  // Like a small drumroll into the success notification.
  useEffect(() => {
    if (!allDone) return;
    onPracticeSealed();
    (async () => {
      const today = new Date().toDateString();
      const last = await AsyncStorage.getItem('last_sealed_date');
      if (last !== today) {
        haptics.tap();
        setTimeout(() => haptics.action(), 160);
        setTimeout(() => haptics.success(), 400);
        await AsyncStorage.setItem('last_sealed_date', today);
        track('day_sealed');
        // Ask for a rating once ever, on the third sealed day — deep enough
        // that the habit is real, early enough to catch peak goodwill. iOS
        // decides whether the sheet actually shows, so this stays polite.
        // Lazy require: expo-store-review resolves its native module at
        // import time, which crashes the bundle on builds that don't ship
        // it yet (a static import here took the whole app down over Metro).
        try {
          const asked = await AsyncStorage.getItem('rating_prompt_shown');
          if (!asked) {
            const s = await getStreak();
            const StoreReview = require('expo-store-review');
            if ((s.sealedDays || 0) >= 3 && await StoreReview.hasAction()) {
              await AsyncStorage.setItem('rating_prompt_shown', 'true');
              // Let the seal moment land first; the sheet interrupts less
              // when the reveal animation has finished.
              setTimeout(() => { StoreReview.requestReview().catch(() => {}); }, 2500);
            }
          }
        } catch {}
      }
    })();
  }, [allDone]);

  // Sealed-state reveal animation — 5 staggered slots:
  // hero, quote card, rest-of-day card, daily tiles + weekly review, meditation.
  const sealedFades = useRef([0, 0, 0, 0, 0].map(() => new Animated.Value(0))).current;
  const sealedSlides = useRef([0, 0, 0, 0, 0].map(() => new Animated.Value(20))).current;
  // Streak number gets its own spring entrance — pops into view after the
  // hero stagger so the day count earns a moment.
  const streakScale = useRef(new Animated.Value(0.7)).current;
  const streakOpacity = useRef(new Animated.Value(0)).current;
  // ScrollView ref so we can snap to top when the sealed state appears —
  // the practice screen stays mounted across navigation so without this,
  // any scroll offset from the in-progress state is retained, hiding the
  // skull / day count / sealed quote.
  const sealedScrollRef = useRef(null);
  const scrollRef = useRef(null);
  // Bg layer is static. No parallax, no animated layer, no aspectRatio
  // constraint — just a fixed Image filling the viewport with resizeMode
  // cover. Centered crop of V's 1242×4000 composition shows her middle
  // band (the focal moment) without GPU compositing artifacts that
  // animated transforms can produce.
  useFocusEffect(useCallback(() => {
    if (!allDone) return;
    sealedScrollRef.current?.scrollTo({ y: 0, animated: false });
    sealedFades.forEach(a => a.setValue(0));
    sealedSlides.forEach(a => a.setValue(20));
    streakScale.setValue(0.7);
    streakOpacity.setValue(0);
    Animated.stagger(140, sealedFades.map((fade, i) => Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(sealedSlides[i], { toValue: 0, duration: 650, useNativeDriver: true }),
    ]))).start();
    // Streak springs in slightly after the hero block fades — feels like
    // the number is the answer the page is building toward.
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(streakScale, { toValue: 1, tension: 55, friction: 6, useNativeDriver: true }),
        Animated.timing(streakOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    }, 380);
  }, [allDone]));
  const sealedAnimStyle = (i) => ({ opacity: sealedFades[i], transform: [{ translateY: sealedSlides[i] }] });

  // Daily practice tiles — shared between the in-progress and sealed views so
  // a user who has sealed the day can still tap back into their journals,
  // reading, compass, and the archives those screens link to.
  const dailyTiles = (
    <View style={s.routineCard}>
      <TouchableOpacity
        style={[s.routineRow, s.routineRowBorder, nextItem === 'compass' && s.routineRowNext]}
        onPress={() => router.push('/compass?from=/&fromLabel=Practice')}
        activeOpacity={0.7}
      >
        <View style={[s.dot, compassDone && s.dotDone]}>{compassDone && <Ionicons name="checkmark" size={13} color={colors.bg} />}</View>
        <View style={s.routineContent}>
          <Text style={[s.routineTitle, compassDone && s.titleDone]}>Stoic Compass</Text>
          <Text style={s.routineSub}>Your North Star · read daily</Text>
        </View>
        {nextItem === 'compass' && (
          <View style={[s.tag, s.tagNext]}>
            <Text style={[s.tagText, s.tagTextNext]}>NEXT</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.routineRow, s.routineRowBorder, nextItem === 'reading' && s.routineRowNext]}
        onPress={() => router.push('/read?from=/&fromLabel=Practice')}
        activeOpacity={0.7}
      >
        <View style={[s.dot, readingDone && s.dotDone]}>{readingDone && <Ionicons name="checkmark" size={13} color={colors.bg} />}</View>
        <View style={s.routineContent}>
          <Text style={[s.routineTitle, readingDone && s.titleDone]}>Daily Reading</Text>
          <Text style={s.routineSub}>Ancient wisdom for this day</Text>
        </View>
        {nextItem === 'reading' && (
          <View style={[s.tag, s.tagNext]}>
            <Text style={[s.tagText, s.tagTextNext]}>NEXT</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.routineRow, s.routineRowBorder, nextItem === 'morning' && s.routineRowNext]}
        onPress={() => router.push({ pathname: '/journal', params: { type: 'morning' } })}
        activeOpacity={0.7}
      >
        <View style={[s.dot, morningDone && s.dotDone]}>{morningDone && <Ionicons name="checkmark" size={13} color={colors.bg} />}</View>
        <View style={s.routineContent}>
          <Text style={[s.routineTitle, morningDone && s.titleDone]}>Morning Journal</Text>
          <Text style={s.routineSub}>Reflect and intend</Text>
        </View>
        {nextItem === 'morning' && (
          <View style={[s.tag, s.tagNext]}>
            <Text style={[s.tagText, s.tagTextNext]}>NEXT</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.routineRow, foundations !== null && s.routineRowBorder, nextItem === 'evening' && s.routineRowNext]}
        onPress={() => router.push({ pathname: '/journal', params: { type: 'evening' } })}
        activeOpacity={0.7}
      >
        <View style={[s.dot, eveningDone && s.dotDone]}>{eveningDone && <Ionicons name="checkmark" size={13} color={colors.bg} />}</View>
        <View style={s.routineContent}>
          <Text style={[s.routineTitle, eveningDone && s.titleDone]}>Evening Journal</Text>
          <Text style={s.routineSub}>Examine and release</Text>
        </View>
        {nextItem === 'evening' && (
          <View style={[s.tag, s.tagNext]}>
            <Text style={[s.tagText, s.tagTextNext]}>NEXT</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* The day's Foundations letter rides inside the practice card during
          the unlock week — it's part of today's practice while the series
          runs. Mail icon (not a completion dot) and exclusion from the
          "X of 4" count keep it a guest, not a fifth requirement: the seal
          stays defined by the four practices. Gone after the series. */}
      {foundations !== null && (() => {
        const caughtUp = foundations.nextUnread === null;
        const letterNum = caughtUp ? foundations.unlockedCount : foundations.nextUnread;
        const letter = FOUNDATIONS_LETTERS[letterNum - 1];
        if (!letter) return null;
        const nextLetter = FOUNDATIONS_LETTERS[foundations.unlockedCount];
        return (
          <TouchableOpacity
            style={s.routineRow}
            onPress={() => {
              haptics.tap();
              router.push(`/foundations?letter=${letterNum}&from=/&fromLabel=Practice`);
            }}
            activeOpacity={0.7}
          >
            {caughtUp ? (
              <View style={[s.dot, s.dotDone]}>
                <Ionicons name="checkmark" size={13} color={colors.bg} />
              </View>
            ) : (
              <Ionicons name="mail-outline" size={18} color={colors.accent} style={{ width: 18 }} />
            )}
            <View style={s.routineContent}>
              <Text style={[s.routineTitle, caughtUp && s.titleDone]}>
                Letter {letter.num} · {letter.title}
              </Text>
              <Text style={s.routineSub}>
                {caughtUp
                  ? (nextLetter ? `Letter ${nextLetter.num} arrives tomorrow` : 'The foundations are laid')
                  : 'The Foundations · two minutes'}
              </Text>
            </View>
            {!caughtUp && (
              <View style={[s.tag, s.tagAccent]}>
                <Text style={[s.tagText, s.tagTextAccent]}>TODAY</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })()}
    </View>
  );

  const weeklyTileBlock = (() => {
    const hasEnough = totalDays >= 3;
    const sealed = reviewDone;
    const today = isReviewDay && !sealed;
    const locked = !hasEnough;
    const sub = locked
      ? 'After 3 days of practice'
      : sealed
        ? 'Sealed for this week'
        : today
          ? 'Seal the week'
          : 'Look back at the week';
    const onPress = locked
      ? null
      : () => router.push('/review?from=/&fromLabel=Practice');
    return (
      <>
        <View style={s.weeklyHeader}>
          <Text style={s.secLabel}>Weekly</Text>
        </View>
        <View style={s.routineCard}>
          <TouchableOpacity
            style={[s.routineRow, today && s.routineRowNext]}
            onPress={onPress}
            disabled={locked}
            activeOpacity={0.7}
          >
            <View style={[s.dot, sealed && s.dotDone]}>
              {sealed && <Ionicons name="checkmark" size={13} color={colors.bg} />}
            </View>
            <View style={s.routineContent}>
              <Text style={[s.routineTitle, locked && s.titleLocked, sealed && s.titleDone]}>
                Weekly review
              </Text>
              <Text style={s.routineSub}>{sub}</Text>
            </View>
            {locked && (
              <View style={[s.tag, s.tagAccent]}>
                <Text style={[s.tagText, s.tagTextAccent]}>{totalDays}/3</Text>
              </View>
            )}
            {today && (
              <View style={[s.tag, s.tagAccent]}>
                <Text style={[s.tagText, s.tagTextAccent]}>TODAY</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  })();

  // Meditation section — featured contextual pick (big card) followed by a
  // horizontal swipe gallery of the other five. Shared between the in-progress
  // and sealed renders so they stay in sync.
  const meditationBlock = (
    <>
      <Text style={s.galleryHeading}>Today's meditation</Text>
      <TouchableOpacity
        style={[s.medCard, isCurrentMed && s.medCardActive]}
        onPress={toggleMedPlay}
        activeOpacity={0.85}
        disabled={medIsLoading}
      >
        <View style={s.medImageWrap}>
          <Image source={todayMed.image} style={s.medImage} resizeMode="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']}
            locations={[0, 0.55, 1]}
            style={s.medImageOverlay}
          />
        </View>
        <View style={s.medBody}>
          <Text style={s.medSubtitle}>{todayMed.subtitle}</Text>
          <Text style={s.medTitle}>{todayMed.title}</Text>
          <Text style={s.medDesc}>{todayMed.description}</Text>
          {medHasLoaded ? (
            <>
              <View style={s.medProgressBar}>
                <View style={[s.medProgressFill, { flex: medProgress }]} />
                <View style={{ flex: Math.max(0, 1 - medProgress) }} />
              </View>
              <View style={s.medTimeRow}>
                <Text style={s.medTimeText}>{formatMedTime(medPosition)}</Text>
                <Text style={s.medTimeText}>{formatMedTime(medDuration)}</Text>
              </View>
            </>
          ) : (
            <Text style={s.medMeta}>{'< 5 min · guided'}</Text>
          )}
        </View>
        {/* Play button straddling the image/body seam — floating FAB layered
            above the text panel (last child = on top). pointerEvents none so
            taps fall through to the whole card. */}
        <View style={s.medPlayFab} pointerEvents="none">
          {medIsLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Ionicons name={medIsPlaying ? 'pause-circle' : 'play-circle'} size={44} color={colors.accent} />
          )}
        </View>
      </TouchableOpacity>

      <Text style={s.galleryHeading}>More meditations</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.galleryRow}
      >
        {otherMeds.map(med => (
          <MeditationGalleryCard key={med.id} med={med} player={player} onPress={playMed} />
        ))}
      </ScrollView>
    </>
  );

  if (allDone) {
    return (
      <View style={s.root}>
        <Image
          source={require('../assets/bg-svg4.png')}
          style={s.parallaxBg}
          resizeMode="cover"
          pointerEvents="none"
        />
        <View style={s.bgOverlay} pointerEvents="none" />
        <SafeAreaView style={s.safeTransparent}>
        <ScrollView
          ref={sealedScrollRef}
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: playerInset }}
        >

          <Animated.View style={[s.heroSealed, sealedAnimStyle(0)]}>
            {/* Transparent — the page-level bg-svg4 wave (at the root of this
                branch) shows through, matching the normal practice hero. */}
            <Animated.Image
              source={require('../assets/skull-gold.png')}
              style={[s.skullIconSealed, tiltTransform]}
              resizeMode="contain"
            />
            <Text style={s.sealedEyebrow}>Practice complete</Text>
            <Text style={s.sealedDate}>{dateStr}</Text>
            <Animated.Text
              style={[
                s.sealedStreak,
                { opacity: streakOpacity, transform: [{ scale: streakScale }] },
              ]}
            >
              {streak.current > 0 ? `Day ${streak.current}` : 'Day 1'}
            </Animated.Text>
          </Animated.View>

          <Animated.View style={[s.sealedCard, sealedAnimStyle(1)]}>
            <Text style={s.sealedQuoteText}>“{sealQuote.text}”</Text>
            <Text style={s.sealedQuoteAttr}>— {sealQuote.author}, {sealQuote.source}</Text>
          </Animated.View>

          <Animated.View style={[s.sealedRestCard, sealedAnimStyle(2)]}>
            <Text style={s.sealedRestTitle}>The rest of the day is yours</Text>
            <Text style={s.sealedRestSub}>You have done what was required. Now live what you practiced.</Text>
          </Animated.View>

          {/* Practice tiles remain reachable after sealing so users can review
              today's journals, reading, compass — and so the Weekly Review tile
              is still surfaced when today is also review day. */}
          <Animated.View style={[s.body, sealedAnimStyle(3)]}>
            {dailyTiles}
            {weeklyTileBlock}
          </Animated.View>

          <Animated.View style={[s.body, sealedAnimStyle(4)]}>
            {meditationBlock}
          </Animated.View>

        </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Image
        source={require('../assets/bg-svg4.png')}
        style={s.parallaxBg}
        resizeMode="cover"
        pointerEvents="none"
      />
      <View style={s.bgOverlay} pointerEvents="none" />
      <SafeAreaView style={s.safeTransparent}>
      <ScrollView
        ref={scrollRef}
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: playerInset }}
      >

        <View style={s.hero}>
          <Animated.Image
            source={require('../assets/skull-gold.png')}
            style={[s.skullIcon, tiltTransform]}
            resizeMode="contain"
          />
          <Text style={s.heroDate}>{dateStr}</Text>
          <Text style={s.heroStreak}>{streak.current > 0 ? `Day ${streak.current}` : 'Day 1'}</Text>
          <Text style={s.quoteText}>“{quote.text}”</Text>
          <Text style={s.quoteAttr}>— {quote.author}, {quote.source}</Text>
        </View>

        {streak.totalDays === 0 && completed === 0 && !morningComplete && (
          <View style={s.welcomeCard}>
            <Text style={s.welcomeTitle}>Start with one</Text>
            <Text style={s.welcomeText}>
              Four steps below. Take them as the day allows. There is no streak to defend yet, only the practice.
            </Text>
          </View>
        )}

        {morningComplete && (
          <View style={s.morningCompleteCard}>
            <Text style={s.morningCompleteEyebrow}>Morning practice complete</Text>
            <Text style={s.morningCompleteText}>You have set your intention. Return this evening to examine the day.</Text>
          </View>
        )}

        <View style={s.body}>

          {trialDaysLeft !== null && (
            <TouchableOpacity
              style={s.trialBanner}
              onPress={() => router.push('/paywall')}
              activeOpacity={0.7}
            >
              <Text style={s.trialBannerText}>
                {trialDaysLeft === 0
                  ? 'Free trial ends today · Manage subscription'
                  : `Free trial · ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Gold progress bar sits above the header — it replaces the old
              static gold keyline (per V): dim-gold track reads as the line at
              0%, bright-gold fill shows progress. */}
          <View style={s.progressBar}>
            <View style={[s.progressFill, { flex: progress }]} />
            <View style={{ flex: Math.max(0, 1 - progress) }} />
          </View>
          <View style={s.practiceHeader}>
            <Text style={s.secLabel}>Today's practice</Text>
            <Text style={s.practiceCount}>{completed} of {totalItems}</Text>
          </View>

          {dailyTiles}

          {weeklyTileBlock}

          {meditationBlock}

        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  // Root wraps everything so the bg image can extend behind the status
  // bar and tab bar (beyond SafeAreaView's insets). #050505 is a hair
  // darker than the image's dark zones — gives the curves a tiny bit
  // more visual presence without changing the design.
  root: { flex: 1, backgroundColor: '#050505', overflow: 'hidden' },
  // Transparent SafeAreaView lets the bg image show through above content.
  safeTransparent: { flex: 1, backgroundColor: 'transparent' },
  // Kept for any consumer that might still reference s.safe (legacy
  // protection — most callers were migrated to s.safeTransparent above).
  safe: { flex: 1, backgroundColor: colors.bg },
  // ScrollView is transparent so the page-level bg shows through.
  // Cards/tiles inside the scroll have their own opaque dark backgrounds
  // and remain readable as they pass over the bg image.
  scroll: { flex: 1, backgroundColor: 'transparent' },
  // Full-screen box; the Image uses resizeMode="contain" so the ENTIRE image
  // is shown (scaled to fit, no crop). Because the image is wider-aspect than
  // the phone, contain fits by width and leaves dark margins top/bottom.
  // CRITICAL: size the bg to the literal window, NOT absoluteFillObject.
  // absoluteFillObject fills the PARENT (root), which lays out taller than the
  // visible screen (it extends behind the tab bar), so resizeMode="cover"
  // scaled the image up to cover that oversized box — showing only a zoomed
  // center slice (the "gradient" bug). Explicit SCREEN_W × SCREEN_H fixes it.
  parallaxBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_W,
    height: SCREEN_H,
  },
  // V's tall composition already has darkness baked in, so this overlay is a
  // transparent no-op. Raise the alpha if you want it darker than her bake.
  bgOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },

  // Normal hero — transparent so the page-level parallax bg shows through.
  // Hero block keeps its padding + border-bottom to mark the section
  // boundary, just without its own image fill.
  // No bottom border: the hero now flows skull → eyebrow → date → sub →
  // quote → attribution as one unified centered block sitting directly on
  // the page bg image (no separate quote card). The section keyline lives
  // above "Today's practice" instead.
  // paddingTop 48 matches heroSealed so the in-progress and sealed heroes
  // start at the same height (per V — composition mirrors the sealed screen).
  hero: {
    backgroundColor: 'transparent',
    paddingTop: 48,
    // Trimmed from 44 — with the gold keyline gone and the progress bar now
    // leading the practice section, 44 + body 16 + bar 4 ≈ 48px reads as a
    // connected section start rather than a floaty gap.
    paddingBottom: 28,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  skullIcon: { width: 150, height: 150, marginBottom: 24, opacity: 0.9 },
  // Date is the secondary line (titleSize), with the gold "Day N" below as the
  // focal point — mirrors the sealed hero (sealedDate / sealedStreak).
  heroDate: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  // Gold "Day N" — identical treatment to the sealed hero's sealedStreak.
  heroStreak: { fontSize: 48, fontFamily: font.display, color: colors.accent, letterSpacing: -0.5, textAlign: 'center' },

  // Sealed hero — contains a looping background video + dark overlay
  // sitting behind the skull/text content. No overflow:hidden because
  // the skull's tilt-transform with perspective can render slightly
  // outside its 180x180 bounding box and would get clipped otherwise.
  // Transparent so the page-level bg-svg4 wave shows through (video removed).
  // Matches the normal practice hero — no fill, no bottom border.
  heroSealed: {
    backgroundColor: 'transparent',
    paddingTop: 48,
    // 2 + sealedCard's 26 paddingTop = 28, matching the active hero's
    // streak→quote gap (quoteText marginTop 28) — tightened from 36 after the
    // quote shrank to 20px so the quote no longer floats away from the Day.
    paddingBottom: 2,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  skullIconSealed: { width: 150, height: 150, marginBottom: 24, opacity: 1 },
  sealedEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  sealedDate: { fontSize: font.titleSize, fontFamily: font.display, color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sealedStreak: { fontSize: 48, fontFamily: font.display, color: colors.accent, letterSpacing: -0.5, textAlign: 'center' },

  // Sealed quote
  // Floats like the practice/more hero quote — no card fill, no border, no
  // divider rule. Centered, transparent.
  sealedCard: {
    paddingHorizontal: spacing.xl,
    paddingVertical: 26,
    alignItems: 'center',
  },
  // Matches the practice/more hero quote treatment exactly.
  // Reduced from 24 per V ("huge text") — kept clearly below the 28px date so
  // the quote reads as subordinate to the date/Day on the sealed screen.
  sealedQuoteText: { fontSize: 20, color: colors.textPrimary, lineHeight: 28, fontFamily: font.bodyLightItalic, fontStyle: 'italic', textAlign: 'center' },
  // Gold uppercase attribution — matches the onboarding welcome screen
  // (gold, Inter Medium, uppercase, tracked) so every quote reads as one
  // unified component. Was Inter 20 gray title-case.
  sealedQuoteAttr: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 16, textAlign: 'center' },

  // Sealed rest card — light zone
  // Quiet black card — matches the welcome / morning-complete cards: #0a0a0a
  // fill, 0.5 #474747 border, radius.md, inset from the edges.
  sealedRestCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 18,
    marginHorizontal: spacing.md,
    marginBottom: 4,
  },
  // Matches the welcome card exactly (title 17 / sub 14) so the two cards read
  // as one consistent component.
  // Sized to match the Stoic Compass routine tile (title 15 / sub 12) per V.
  sealedRestTitle: { fontSize: 15, color: colors.textPrimary, fontFamily: font.bodyMedium, marginBottom: 6 },
  sealedRestSub: { fontSize: 12, color: colors.textSecondary, fontFamily: font.body, lineHeight: 18 },

  // In-hero quote — centered, larger italic serif, sitting on the bg image
  // directly (no card background). Attribution centered below in title case
  // to match V's mock ("— Marcus Aurelius, Meditations V.20").
  // Quote body — Inter Light Italic (the unified quote voice). Kept as the
  // brightest/largest line so it's the focal point above the 20pt secondary
  // tier (sub + attribution).
  // Matches the sealed-screen quote (20 / lh 28) so the active and sealed
  // practice heroes read identically (per V).
  quoteText: {
    fontSize: 20,
    color: colors.textPrimary,
    lineHeight: 28,
    fontFamily: font.bodyLightItalic,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 28,
  },
  // Gold uppercase attribution — matches the onboarding welcome screen so
  // every quote reads as one unified component. Was Inter 20 gray title-case.
  quoteAttr: {
    fontSize: font.labelSize,
    letterSpacing: font.sectionTracking,
    color: colors.accent,
    fontFamily: font.bodyMedium,
    textTransform: 'uppercase',
    marginTop: 16,
    textAlign: 'center',
  },

  // Body wrapper below the hero. Transparent so the page-level bg image
  // shows through between cards. Each card inside still has its own
  // opaque dark fill, so card content remains fully readable; only the
  // gaps reveal the bg.
  body: { padding: spacing.md, backgroundColor: 'transparent' },
  // Small banner shown only when the user is in an active 7-day free
  // trial. Tappable so the user can review their subscription state.
  trialBanner: {
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    backgroundColor: colors.bg,
    paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 12, alignItems: 'center',
  },
  trialBannerText: { fontSize: 12, color: colors.accent, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: font.bodyMedium },
  // No keyline — the gold progress bar above now serves as the divider (per V).
  practiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  // Weekly sub-section header — same row layout as practiceHeader but NO
  // gold keyline. The accent eyebrow label alone separates it from the
  // Today's-practice list above; a second gold rule would be redundant.
  weeklyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, marginBottom: 10 },
  practiceCount: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accentDim, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  // Gold divider/progress bar above the header: dim-gold track (reads as the
  // old keyline at 0%), bright-gold fill shows completion. marginTop separates
  // it from the section above.
  progressBar: { height: 1, backgroundColor: colors.accentDim, borderRadius: 1, marginTop: 4, marginBottom: 8, overflow: 'hidden', flexDirection: 'row' },
  progressFill: { backgroundColor: colors.accent, borderRadius: 1 },


  routineCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    marginBottom: 16,
  },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingHorizontal: 18, borderLeftWidth: 2, borderLeftColor: 'transparent' },
  routineRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  routineRowNext: { borderLeftColor: colors.accent },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.textSecondary },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  routineContent: { flex: 1 },
  routineTitle: { fontSize: 15, fontFamily: font.body, color: colors.textPrimary, marginBottom: 3 },
  titleDone: { color: colors.textSecondary, textDecorationLine: 'line-through' },
  titleLocked: { color: colors.textSecondary },
  routineSub: { fontSize: 12, color: colors.textSecondary },
  tag: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  tagNext: { borderColor: colors.accentDim, backgroundColor: colors.bg },
  tagAccent: { borderColor: colors.border },
  tagText: { fontSize: 11, color: colors.textSecondary, letterSpacing: 1, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  tagTextNext: { color: colors.accent, fontFamily: font.bodyMedium },
  tagTextAccent: { color: colors.textSecondary },

  // Quiet black card — matches the welcome card and the app's other inset
  // cards: #0a0a0a fill, 0.5 #474747 border, radius.md, inset from the edges.
  morningCompleteCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 18,
    marginHorizontal: spacing.md,
    marginBottom: 4,
  },
  morningCompleteEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 8 },
  morningCompleteText: { fontSize: 14, color: colors.textSecondary, fontFamily: font.body, lineHeight: 21 },

  // Day-1 welcome — shows on the very first practice screen view, before
  // any item is completed and before any full day has been sealed. Hides
  // the moment any practice element is tapped.
  // Day-one welcome — quiet dark card in the list-card language (not the
  // hero's). Deliberately avoids echoing the hero so it doesn't read as a
  // second screen: muted (non-gold) label, Inter title (not Didot), Inter
  // body. #0a0a0a fill + 0.5 #474747 border + radius.md, inset to align
  // with the practice cards below. Left-aligned like those cards.
  welcomeCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 18,
    marginHorizontal: spacing.md,
    marginBottom: 4,
  },
  welcomeTitle: { fontSize: 17, color: colors.textPrimary, fontFamily: font.bodyMedium, marginBottom: 6 },
  welcomeText: { fontSize: 14, color: colors.textSecondary, fontFamily: font.body, lineHeight: 21 },

  medCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    // No top margin — the "Today's meditation" heading's marginBottom (10)
    // alone sets the gap, matching the other section heading→card spacing.
    marginBottom: 12,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  // Active state — bright gold border while this meditation is current
  // (matches the journal listen card).
  medCardActive: { borderColor: colors.accent },
  medImageWrap: {
    width: '100%',
    height: 180,
    backgroundColor: '#000',
    position: 'relative',
  },
  medImage: { width: '100%', height: '100%' },
  medImageOverlay: { ...StyleSheet.absoluteFillObject },
  // Floating play button anchored just below the image/body seam (per V —
  // bumped down so it no longer reads as hanging off the image). top 180 =
  // image height, so the button sits fully in the body at the text start.
  // Sized to the icon so pointerEvents:none taps fall through to the card.
  medPlayFab: {
    position: 'absolute',
    right: 18,
    top: 180,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Text shifted up (tighter to the image) per V — was paddingTop 18.
  medBody: { padding: 22, paddingTop: 14 },
  medTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  // Subtitle ("Accounting" etc.) gold per V — was textSecondary.
  medSubtitle: { fontSize: font.labelSize, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 6 },
  medTitle: { fontSize: 20, fontFamily: font.bodySemiBold, color: colors.textPrimary, marginBottom: 8 },
  medDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 14 },
  medMeta: { fontSize: 12, color: colors.textSecondary, letterSpacing: 0.5 },
  medProgressBar: {
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    flexDirection: 'row',
    overflow: 'hidden',
    marginBottom: 8,
  },
  medProgressFill: { backgroundColor: colors.accent, borderRadius: 1 },
  medTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  medTimeText: { fontSize: 11, color: colors.textSecondary, letterSpacing: 0.3 },
  // Meditation section labels ("Today's meditation" / "More meditations") —
  // gold, above the frame, matching the WEEKLY / page section labels (per V).
  // marginBottom 10 matches the Weekly / Today's-practice section headers so
  // the heading→card gap is consistent (was 14, which + medCard's top margin
  // made the meditation gap visibly larger than the others).
  galleryHeading: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginTop: 8, marginBottom: 10, marginLeft: 2 },
  galleryRow: { paddingRight: 16, paddingBottom: 20, gap: 12 },
  galleryCard: { width: 148 },
  galleryImageWrap: { width: 148, height: 148, borderRadius: radius.md, overflow: 'hidden', backgroundColor: '#000', position: 'relative', marginBottom: 10 },
  galleryImage: { width: '100%', height: '100%' },
  galleryPlay: { position: 'absolute', bottom: 8, right: 8 },
  gallerySubtitle: { fontSize: font.labelSize, letterSpacing: 1.5, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 4 },
  galleryTitle: { fontSize: 14, fontFamily: font.bodySemiBold, color: colors.textPrimary, lineHeight: 19, marginBottom: 4 },
  galleryMeta: { fontSize: 11, color: colors.textSecondary, letterSpacing: 0.3 },
});