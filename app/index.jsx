import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, Image, Animated, ActivityIndicator,
} from 'react-native';
import { MEDITATIONS, useMeditationPlayer, toggle as toggleMeditation, formatMedTime } from '../lib/meditationPlayer';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, spacing, font } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { morningQuotes, mementoMoriQuotes, getDailyQuote } from '../constants/quotes';
import { virtues } from '../constants/virtues';
import { getTodayJournal, getStreak, getTodayReading, getCompassDone, persistCompassDone, clearCompassDone, getReviews } from '../store/db';
import { refreshNotificationsForToday, onPracticeSealed, cancelJournalNotification } from '../notifications';
import { LinearGradient } from 'expo-linear-gradient';
import * as haptics from '../lib/haptics';

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
const HERO_GRADIENT = ['#4a3a26', '#1a1410', '#000000'];

// Module-level flag — resets on cold start, so the greeting plays once
// per app launch rather than every navigation back to home.
let hasShownGreetingThisSession = false;

function getTimeOfDayLabel() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  return 'Evening';
}

const virtuePronunciations = {
  sophia: 'soh-FEE-ah',
  andreia: 'an-DRAY-ah',
  sophrosyne: 'soh-FROH-sih-nee',
  dikaiosyne: 'dee-KAY-oh-sih-nee',
};

const virtueDetails = {
  wisdom: { definition: 'The Virtue of discernment and right judgment. Wisdom means seeing things clearly, not as you wish them to be, but as they are.', question: 'Am I perceiving this clearly or through bias, fear, or ego?' },
  courage: { definition: 'The Virtue of strength and moral fortitude. Courage is doing the right thing even when it is hard.', question: 'What fear is stopping me right now?' },
  moderation: { definition: 'The Virtue of temperance and balance. Neither indulgence nor deprivation: the disciplined middle path.', question: 'Where am I in excess today?' },
  justice: { definition: 'The Virtue of fairness and right action toward others. Justice is about how you treat the people around you.', question: 'Did I treat others with fairness today?' },
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

export default function PracticeScreen() {
  const router = useRouter();
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [compassDone, setCompassDone] = useState(false);
  const [readingDone, setReadingDone] = useState(false);
  const [streak, setStreak] = useState({ current: 0, longest: 0, totalDays: 0 });
  const [todayDate, setTodayDate] = useState(new Date());
  const [reviewDay, setReviewDay] = useState(0);
  const [reviewDone, setReviewDone] = useState(false);
  const [totalDays, setTotalDays] = useState(0);
  const [virtueExpanded, setVirtueExpanded] = useState(false);
  const [userName, setUserName] = useState(null);
  const [eyebrowPhase, setEyebrowPhase] = useState(hasShownGreetingThisSession ? 'memento' : 'greeting');
  const eyebrowOpacity = useRef(new Animated.Value(1)).current;

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

  function toggleMedPlay() {
    haptics.tap();
    toggleMeditation(todayMed);
  }

  useEffect(() => {
    AsyncStorage.getItem('user_name').then(name => setUserName(name?.trim() || null));
  }, []);

  useEffect(() => {
    if (hasShownGreetingThisSession || eyebrowPhase !== 'greeting') return;
    const t = setTimeout(() => {
      Animated.timing(eyebrowOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        hasShownGreetingThisSession = true;
        setEyebrowPhase('memento');
        Animated.timing(eyebrowOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 1800);
    return () => clearTimeout(t);
  }, [eyebrowPhase]);

  const greetingText = userName ? `${getTimeOfDayLabel()}, ${userName}.` : `${getTimeOfDayLabel()}.`;
  const eyebrowText = eyebrowPhase === 'greeting' ? greetingText : 'Memento mori';

  const today = todayDate;
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const [todayVirtue, setTodayVirtue] = useState(virtues[today.getDate() % 4]);
  // Show weekly review for 3 days: the review day + 2 days after
  // Requires minimum 3 completed practice days before surfacing
  const dayOfWeek = today.getDay();
  const hasEnoughPractice = totalDays >= 3;
  const isReviewDay = hasEnoughPractice && (
    dayOfWeek === reviewDay ||
    ((dayOfWeek - reviewDay + 7) % 7 === 1) ||
    ((dayOfWeek - reviewDay + 7) % 7 === 2)
  );

  const quote = getDailyQuote(morningQuotes);
  const sealQuote = getDailyQuote(mementoMoriQuotes, 7);

  useFocusEffect(useCallback(() => {
    async function load() {
      const now = new Date();
      setTodayDate(now);
      setTodayVirtue(virtues[now.getDate() % 4]);
      const morning = await getTodayJournal('morning');
      const evening = await getTodayJournal('evening');
      const reading = await getTodayReading();
      const compassToday = await getCompassDone();
      const s = await getStreak();
      setTotalDays(s.totalDays || 0);
      const settings = await AsyncStorage.getItem('notification_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.reviewDay !== undefined) setReviewDay(parsed.reviewDay);
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
      // Cancel notifications for anything already done today
      refreshNotificationsForToday().catch(() => {});
      if (morning?.virtue) {
        const found = virtues.find(v => v.id === morning.virtue);
        if (found) setTodayVirtue(found);
      }
    }
    load();
  }, []));

  const totalItems = isReviewDay ? 5 : 4;
  const completed = [compassDone, readingDone, morningDone, eveningDone, isReviewDay ? reviewDone : null]
    .filter(v => v === true).length;
  const allDone = completed >= 4 && (!isReviewDay || completed >= 5);
  const morningComplete = !allDone && compassDone && readingDone && morningDone && !eveningDone;
  const progress = Math.min(completed / (isReviewDay ? 5 : 4), 1);
  const nextItem = !compassDone ? 'compass'
    : !readingDone ? 'reading'
    : !morningDone ? 'morning'
    : !eveningDone ? 'evening'
    : null;

  // Cancel re-engagement notifications when practice is sealed; fire a
  // three-beat haptic rhythm (light → medium → success) once per day on
  // the first seal. Like a small drumroll into the success notification.
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
      }
    })();
  }, [allDone]);

  // Sealed-state reveal animation
  const sealedFades = useRef([0, 0, 0, 0].map(() => new Animated.Value(0))).current;
  const sealedSlides = useRef([0, 0, 0, 0].map(() => new Animated.Value(20))).current;
  // Streak number gets its own spring entrance — pops into view after the
  // hero stagger so the day count earns a moment.
  const streakScale = useRef(new Animated.Value(0.7)).current;
  const streakOpacity = useRef(new Animated.Value(0)).current;
  useFocusEffect(useCallback(() => {
    if (!allDone) return;
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

  if (allDone) {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

          <AnimatedLinearGradient
            colors={HERO_GRADIENT}
            locations={[0, 0.6, 1]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[s.heroSealed, sealedAnimStyle(0)]}
          >
            <Image
              source={require('../assets/skull.png')}
              style={s.skullIconSealed}
              resizeMode="contain"
            />
            <Text style={s.sealedEyebrow}>{reviewDone && isReviewDay ? 'Week sealed' : 'Practice complete'}</Text>
            <Text style={s.sealedDate}>{dateStr}</Text>
            <Animated.Text
              style={[
                s.sealedStreak,
                { opacity: streakOpacity, transform: [{ scale: streakScale }] },
              ]}
            >
              {streak.current > 0 ? `Day ${streak.current}` : 'Day 1'}
            </Animated.Text>
          </AnimatedLinearGradient>

          <Animated.View style={[s.sealedCard, sealedAnimStyle(1)]}>
            <Text style={s.sealedQuoteText}>“{sealQuote.text}”</Text>
            <View style={s.sealedQuoteRule} />
            <Text style={s.sealedQuoteAttr}>— {sealQuote.author.toUpperCase()}, {sealQuote.source.toUpperCase()}</Text>
          </Animated.View>

          <Animated.View style={[s.sealedRestCard, sealedAnimStyle(2)]}>
            <Text style={s.sealedRestTitle}>The rest of the day is yours.</Text>
            <Text style={s.sealedRestSub}>You have done what was required. Now live what you practiced.</Text>
          </Animated.View>

          <Animated.View style={[s.body, sealedAnimStyle(3)]}>
            <TouchableOpacity
              style={s.virtueCard}
              onPress={() => setVirtueExpanded(!virtueExpanded)}
              activeOpacity={0.85}
            >
              <View style={s.virtueImageWrap}>
                <Image source={todayVirtue.image} style={s.virtueImage} resizeMode="cover" />
                <LinearGradient
                  colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']}
                  locations={[0, 0.55, 1]}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={s.virtueImageBottom}>
                  <Text style={s.virtueEyebrow}>Virtue focus</Text>
                </View>
              </View>
              <View style={s.virtueBody}>
                <Text style={s.virtueName}>{todayVirtue.name}</Text>
                <Text style={s.virtueDesc}>{todayVirtue.desc}</Text>
                <Text style={s.virtueQuestion}>"{todayVirtue.question}"</Text>
                {virtueExpanded && (
                  <View style={s.virtueDetail}>
                    <View style={s.virtueDivider} />
                    <Text style={s.virtueDetailText}>{virtueDetails[todayVirtue.id]?.definition}</Text>
                    <Text style={s.virtueDetailQuestion}>"{virtueDetails[todayVirtue.id]?.question}"</Text>
                  </View>
                )}
                <Text style={s.virtueChev}>{virtueExpanded ? '∨ Less' : '› More'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.medCard}
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
                <View style={s.medImageBottom}>
                  <Text style={s.medEyebrow}>Today's meditation</Text>
                  {medIsLoading ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <Ionicons name={medIsPlaying ? 'pause-circle' : 'play-circle'} size={44} color={colors.accent} />
                  )}
                </View>
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
                  <Text style={s.medMeta}>5 min · guided</Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/meditate?from=/&fromLabel=Practice')} style={s.medAllBtn} activeOpacity={0.7}>
              <Text style={s.medAllText}>All meditations →</Text>
            </TouchableOpacity>
          </Animated.View>

        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        <LinearGradient
          colors={HERO_GRADIENT}
          locations={[0, 0.6, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.hero}
        >
          <Image
            source={require('../assets/skull.png')}
            style={s.skullIcon}
            resizeMode="contain"
          />
          <Animated.Text style={[s.eyebrow, { opacity: eyebrowOpacity }]}>{eyebrowText}</Animated.Text>
          <Text style={s.heroDate}>{dateStr}</Text>
          <Text style={s.heroSub}>
            {streak.current > 0 ? `Day ${streak.current} of your finite days` : 'Your practice begins today'}
          </Text>
        </LinearGradient>

        <View style={s.quoteCard}>
          <Text style={s.quoteText}>“{quote.text}”</Text>
          <Text style={s.quoteAttr}>— {quote.author.toUpperCase()}, {quote.source.toUpperCase()}</Text>
        </View>

        {streak.totalDays === 0 && completed === 0 && !morningComplete && (
          <View style={s.welcomeCard}>
            <Text style={s.welcomeEyebrow}>Welcome</Text>
            <Text style={s.welcomeTitle}>Your practice begins today.</Text>
            <Text style={s.welcomeText}>
              Four steps below. Take them as the day allows. There is no streak to defend yet — only the practice.
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

          <View style={s.practiceHeader}>
            <Text style={s.secLabel}>Today's practice</Text>
            <Text style={s.practiceCount}>{completed} of {totalItems}</Text>
          </View>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { flex: progress }]} />
            <View style={{ flex: Math.max(0, 1 - progress) }} />
          </View>



          <View style={s.routineCard}>

            <TouchableOpacity
              style={[s.routineRow, s.routineRowBorder, nextItem === 'compass' && s.routineRowNext]}
              onPress={async () => { router.push('/compass?from=/&fromLabel=Practice'); setCompassDone(true); await persistCompassDone(); cancelJournalNotification('compass'); }}
              activeOpacity={0.7}
            >
              <View style={[s.dot, compassDone && s.dotDone]}>{compassDone && <Ionicons name="checkmark" size={13} color={colors.bg} />}</View>
              <View style={s.routineContent}>
                <Text style={[s.routineTitle, compassDone && s.titleDone]}>Stoic Compass</Text>
                <Text style={s.routineSub}>Your North Star · read daily</Text>
              </View>
              <View style={s.tagRow}>
                {compassDone && (
                  <TouchableOpacity style={s.undoBtn} onPress={async () => { setCompassDone(false); await clearCompassDone(); }}>
                    <Text style={s.undoBtnText}>Undo</Text>
                  </TouchableOpacity>
                )}
                <View style={[s.tag, compassDone ? s.tagDone : s.tagNow]}>
                  <Text style={[s.tagText, !compassDone && s.tagTextNow]}>{compassDone ? 'DONE' : 'NOW'}</Text>
                </View>
              </View>
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
              <View style={[s.tag, readingDone ? s.tagDone : s.tagNow]}>
                <Text style={[s.tagText, !readingDone && s.tagTextNow]}>{readingDone ? 'DONE' : 'READ'}</Text>
              </View>
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
              <View style={[s.tag, morningDone ? s.tagDone : s.tagNow]}>
                <Text style={[s.tagText, !morningDone && s.tagTextNow]}>{morningDone ? 'DONE' : 'NOW'}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.routineRow, isReviewDay && s.routineRowBorder, nextItem === 'evening' && s.routineRowNext]}
              onPress={() => router.push({ pathname: '/journal', params: { type: 'evening' } })}
              activeOpacity={0.7}
            >
              <View style={[s.dot, eveningDone && s.dotDone]}>{eveningDone && <Ionicons name="checkmark" size={13} color={colors.bg} />}</View>
              <View style={s.routineContent}>
                <Text style={[s.routineTitle, eveningDone && s.titleDone]}>Evening Journal</Text>
                <Text style={s.routineSub}>Examine and release</Text>
              </View>
              <View style={[s.tag, eveningDone ? s.tagDone : s.tagLater]}>
                <Text style={s.tagText}>{eveningDone ? 'DONE' : 'LATER'}</Text>
              </View>
            </TouchableOpacity>

            {isReviewDay && (
              <TouchableOpacity
                style={s.routineRow}
                onPress={() => router.push('/review?from=/&fromLabel=Practice')}
                activeOpacity={0.7}
              >
                <View style={s.dot} />
                <View style={s.routineContent}>
                  <Text style={s.routineTitle}>Weekly review</Text>
                  <Text style={s.routineSub}>Seal the week</Text>
                </View>
                <View style={[s.tag, s.tagAccent]}>
                  <Text style={[s.tagText, s.tagTextAccent]}>TODAY</Text>
                </View>
              </TouchableOpacity>
            )}

          </View>

          <TouchableOpacity
            style={s.virtueCard}
            onPress={() => setVirtueExpanded(!virtueExpanded)}
            activeOpacity={0.85}
          >
            <View style={s.virtueImageWrap}>
              <Image source={todayVirtue.image} style={s.virtueImage} resizeMode="cover" />
              <LinearGradient
                colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.95)']}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.virtueImageBottom}>
                <Text style={s.virtueEyebrow}>Virtue focus</Text>
              </View>
            </View>
            <View style={s.virtueBody}>
              <Text style={s.virtueName}>{todayVirtue.name}</Text>
              <Text style={s.virtueDesc}>{todayVirtue.desc}</Text>
              <Text style={s.virtueQuestion}>"{todayVirtue.question}"</Text>
              {virtueExpanded && (
                <View style={s.virtueDetail}>
                  <View style={s.virtueDivider} />
                  <Text style={s.virtueDetailText}>{virtueDetails[todayVirtue.id]?.definition}</Text>
                  <Text style={s.virtueDetailQuestion}>"{virtueDetails[todayVirtue.id]?.question}"</Text>
                </View>
              )}
              <Text style={s.virtueChev}>{virtueExpanded ? '∨ Less' : '› More'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.medCard}
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
              <View style={s.medImageBottom}>
                <Text style={s.medEyebrow}>Today's meditation</Text>
                {medIsLoading ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Ionicons name={medIsPlaying ? 'pause-circle' : 'play-circle'} size={44} color={colors.accent} />
                )}
              </View>
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
                <Text style={s.medMeta}>5 min · guided</Text>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/meditate?from=/&fromLabel=Practice')} style={s.medAllBtn} activeOpacity={0.7}>
            <Text style={s.medAllText}>All meditations →</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },

  // Normal hero
  hero: {
    backgroundColor: colors.bgDeep,
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  skullIcon: { width: 180, height: 180, marginBottom: 20, opacity: 0.9 },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  heroDate: { fontSize: font.heroSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -1, marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: font.subSize, color: colors.textMuted, textAlign: 'center' },

  // Sealed hero
  heroSealed: {
    backgroundColor: colors.bgDeep,
    paddingTop: 48,
    paddingBottom: 36,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accentDim,
    alignItems: 'center',
  },
  skullIconSealed: { width: 180, height: 180, marginBottom: 24, opacity: 1 },
  sealedEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 10, textAlign: 'center' },
  sealedDate: { fontSize: font.titleSize, fontWeight: '600', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8, textAlign: 'center' },
  sealedStreak: { fontSize: 48, fontWeight: '700', color: colors.accent, letterSpacing: -1, textAlign: 'center' },

  // Sealed quote
  sealedCard: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accentDim,
    padding: spacing.xl,
    paddingVertical: 26,
  },
  sealedQuoteText: { fontSize: 18, color: colors.textSecondary, lineHeight: 30, fontStyle: 'italic', fontFamily: font.serif },
  sealedQuoteRule: { height: 0.5, backgroundColor: colors.accentDim, marginVertical: 16 },
  sealedQuoteAttr: { fontSize: 10, color: colors.accentDim, letterSpacing: 1.5 },

  // Sealed rest card — light zone
  sealedRestCard: {
    padding: spacing.xl,
    paddingVertical: 24,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  sealedRestTitle: { fontSize: 20, fontWeight: '400', color: colors.textPrimary, marginBottom: 8 },
  sealedRestSub: { fontSize: 15, color: colors.textMuted, lineHeight: 24, fontFamily: font.serif },

  // Normal quote
  quoteCard: {
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    padding: spacing.xl,
    paddingVertical: 22,
  },
  quoteText: { fontSize: 18, color: colors.textPrimary, lineHeight: 30, fontFamily: font.serif },
  quoteAttr: { fontSize: 11, color: colors.textMuted, marginTop: 12, letterSpacing: 1.5 },

  // Light body zone
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  practiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, marginBottom: 10 },
  practiceCount: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accentDim, textTransform: 'uppercase' },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase' },
  progressBar: { height: 1, backgroundColor: colors.border, borderRadius: 1, marginBottom: 8, overflow: 'hidden', flexDirection: 'row' },
  progressFill: { backgroundColor: colors.textPrimary, borderRadius: 1 },


  routineCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
    marginBottom: 16,
  },
  routineRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, paddingHorizontal: 18, borderLeftWidth: 2, borderLeftColor: 'transparent' },
  routineRowBorder: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  routineRowNext: { borderLeftColor: colors.accent },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.textMuted },
  dotDone: { backgroundColor: colors.accent, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  routineContent: { flex: 1 },
  routineTitle: { fontSize: 15, fontWeight: '400', color: colors.textPrimary, marginBottom: 3 },
  titleDone: { color: colors.textDim, textDecorationLine: 'line-through' },
  routineSub: { fontSize: 12, color: colors.textMuted },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  undoBtn: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  undoBtnText: { fontSize: 11, color: colors.textMuted },
  tag: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 5, paddingHorizontal: 10, paddingVertical: 4 },
  tagDone: { borderColor: colors.border },
  tagNow: { borderColor: colors.accentDim, backgroundColor: colors.accentBg },
  tagLater: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0 },
  tagAccent: { borderColor: colors.borderMid },
  tagText: { fontSize: 10, color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  tagTextNow: { color: colors.accent, fontWeight: '500' },
  tagTextAccent: { color: colors.textMuted },

  virtueCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginBottom: 32,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  virtueImageWrap: {
    width: '100%',
    height: 160,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  virtueImage: { width: '100%', height: '100%' },
  virtueImageBottom: { position: 'absolute', left: 22, right: 22, bottom: 14 },
  virtueBody: { padding: 22, paddingTop: 18 },
  virtueEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 10 },
  virtueName: { fontSize: 24, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  virtueDesc: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, marginBottom: 12 },
  virtueQuestion: { fontSize: 15, color: colors.textMuted, fontFamily: font.serif, lineHeight: 24 },
  virtueDetail: { marginTop: 14 },
  virtueDivider: { height: 0.5, backgroundColor: colors.border, marginBottom: 14 },
  virtueDetailText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, fontFamily: font.serif, marginBottom: 10 },
  virtueDetailQuestion: { fontSize: 14, color: colors.textMuted, fontFamily: font.serif },
  virtueChev: { fontSize: 12, color: colors.accentDim, marginTop: 12, letterSpacing: 0.5 },
  morningCompleteCard: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accentDim,
    padding: spacing.xl,
    paddingVertical: 18,
  },
  morningCompleteEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  morningCompleteText: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },

  // Day-1 welcome — shows on the very first practice screen view, before
  // any item is completed and before any full day has been sealed. Hides
  // the moment any practice element is tapped.
  welcomeCard: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.accentDim,
    padding: spacing.xl,
    paddingVertical: 22,
  },
  welcomeEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 8 },
  welcomeTitle: { fontSize: 20, color: colors.textPrimary, fontFamily: font.serif, marginBottom: 10 },
  welcomeText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  medCard: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginTop: -16,
    marginBottom: 12,
    backgroundColor: colors.bgCard,
    overflow: 'hidden',
  },
  medImageWrap: {
    width: '100%',
    height: 180,
    backgroundColor: '#000',
    position: 'relative',
  },
  medImage: { width: '100%', height: '100%' },
  medImageOverlay: { ...StyleSheet.absoluteFillObject },
  medImageBottom: {
    position: 'absolute',
    left: 18,
    right: 14,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medBody: { padding: 22, paddingTop: 18 },
  medTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  medEyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase' },
  medSubtitle: { fontSize: font.microSize, letterSpacing: 2, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 6 },
  medTitle: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  medDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 14 },
  medMeta: { fontSize: 12, color: colors.textDim, letterSpacing: 0.5 },
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
  medTimeText: { fontSize: 11, color: colors.textDim, letterSpacing: 0.3 },
  medAllBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 20 },
  medAllText: { fontSize: 12, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
});