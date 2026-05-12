import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, radius, font } from '../constants/theme';
import {
  getCompassDone, getTodayReading, getTodayJournal,
  getReviews, getStreak,
} from '../store/db';

// Default 4-step practice; review step is added on review-day windows.
const BASE_STEPS = [
  { key: 'compass',  roman: 'I',   title: 'Stoic Compass',   route: '/compass' },
  { key: 'reading',  roman: 'II',  title: 'Daily Reading',   route: '/read' },
  { key: 'morning',  roman: 'III', title: 'Morning Journal', route: '/journal?type=morning' },
  { key: 'evening',  roman: 'IV',  title: 'Evening Journal', route: '/journal?type=evening' },
];
const REVIEW_STEP = { key: 'review', roman: 'V', title: 'Weekly Review', route: '/review' };

export function PracticeHeader({ current }) {
  const router = useRouter();
  const [done, setDone] = useState({ compass: false, reading: false, morning: false, evening: false, review: false });
  const [includeReview, setIncludeReview] = useState(false);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const [compass, reading, morning, evening, settingsRaw, reviews, streak] = await Promise.all([
        getCompassDone(),
        getTodayReading(),
        getTodayJournal('morning'),
        getTodayJournal('evening'),
        AsyncStorage.getItem('notification_settings'),
        getReviews(),
        getStreak(),
      ]);
      if (cancelled) return;
      const totalDays = streak?.totalDays || 0;
      const reviewDay = settingsRaw ? (JSON.parse(settingsRaw)?.reviewDay ?? 0) : 0;
      const dow = new Date().getDay();
      // Match Practice screen logic: 3-day window starting on the chosen review day,
      // and only after 3+ days of practice have accumulated.
      const inReviewWindow = totalDays >= 3 && (
        dow === reviewDay ||
        ((dow - reviewDay + 7) % 7 === 1) ||
        ((dow - reviewDay + 7) % 7 === 2)
      );
      const weekAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      const reviewedThisWindow = reviews.some(r => new Date(r.date).getTime() > weekAgo);
      setIncludeReview(inReviewWindow || current === 'review');
      setDone({
        compass: !!compass,
        reading: !!reading,
        morning: !!morning,
        evening: !!evening,
        review: reviewedThisWindow,
      });
    })();
    return () => { cancelled = true; };
  }, [current]));

  const steps = includeReview ? [...BASE_STEPS, REVIEW_STEP] : BASE_STEPS;
  const currentIdx = Math.max(0, steps.findIndex(s => s.key === current));
  const currentStep = steps[currentIdx] || steps[0];
  const prevStep = currentIdx > 0 ? steps[currentIdx - 1] : null;
  const nextStep = currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null;

  function exitToPractice() {
    router.replace('/');
  }

  function goTo(route) {
    if (!route) return;
    router.replace(route);
  }

  return (
    <View style={s.wrap}>
      <View style={s.topRow}>
        <TouchableOpacity onPress={exitToPractice} style={s.exitBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
          <Text style={s.exitBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={s.counter}>{currentIdx + 1} OF {steps.length}</Text>
        <View style={s.exitBtnSpacer} />
      </View>

      <View style={s.titleRow}>
        <TouchableOpacity
          onPress={() => goTo(prevStep?.route)}
          disabled={!prevStep}
          style={[s.arrowBtn, !prevStep && s.arrowBtnDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={[s.arrowText, !prevStep && s.arrowTextDisabled]}>‹</Text>
        </TouchableOpacity>
        <Text style={s.titleText} numberOfLines={1}>
          {currentStep.roman} · {currentStep.title}
        </Text>
        <TouchableOpacity
          onPress={() => goTo(nextStep?.route)}
          disabled={!nextStep}
          style={[s.arrowBtn, !nextStep && s.arrowBtnDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Text style={[s.arrowText, !nextStep && s.arrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={s.segmentsRow}>
        {steps.map((step, i) => {
          const isCurrent = i === currentIdx;
          const isPassed = i < currentIdx;
          // Strict position-based progress: segments up to and including the
          // current step are lit. Completion of out-of-order steps is not
          // visualized here — the counter (X of Y) and the lit segments agree.
          return (
            <View
              key={step.key}
              style={[
                s.segment,
                isPassed && s.segmentDone,
                isCurrent && s.segmentCurrent,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgDeep,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  exitBtn: { paddingVertical: 4, paddingRight: 12, minWidth: 32 },
  exitBtnText: { fontSize: 22, color: colors.textMuted, fontWeight: '300', lineHeight: 24 },
  exitBtnSpacer: { width: 32 },
  counter: {
    fontSize: font.microSize,
    letterSpacing: 2,
    color: colors.textDim,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arrowBtn: { paddingVertical: 4, paddingHorizontal: 8, minWidth: 24 },
  arrowBtnDisabled: { opacity: 0.25 },
  arrowText: { fontSize: 28, color: colors.accent, lineHeight: 30, fontWeight: '300' },
  arrowTextDisabled: { color: colors.textDim },
  titleText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  segmentsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  segmentCurrent: { backgroundColor: colors.accentDim },
  segmentDone: { backgroundColor: colors.accent },
});
