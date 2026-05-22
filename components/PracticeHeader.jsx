import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../constants/theme';

// The daily practice is always 4 steps. Weekly Review is a separate flow
// reached from the Practice screen tile and does not appear here.
const STEPS = [
  { key: 'compass',  roman: 'I',   title: 'Stoic Compass',   route: '/compass' },
  { key: 'reading',  roman: 'II',  title: 'Daily Reading',   route: '/read' },
  { key: 'morning',  roman: 'III', title: 'Morning Journal', route: '/journal?type=morning' },
  { key: 'evening',  roman: 'IV',  title: 'Evening Journal', route: '/journal?type=evening' },
];

export function PracticeHeader({ current }) {
  const router = useRouter();
  const steps = STEPS;
  const currentIdx = Math.max(0, steps.findIndex(s => s.key === current));
  const currentStep = steps[currentIdx] || steps[0];
  const prevStep = currentIdx > 0 ? steps[currentIdx - 1] : null;
  const nextStep = currentIdx < steps.length - 1 ? steps[currentIdx + 1] : null;

  function goTo(route) {
    if (!route) return;
    router.replace(route);
  }

  return (
    <View style={s.wrap}>
      <View style={s.titleRow}>
        <TouchableOpacity
          onPress={() => goTo(prevStep?.route)}
          disabled={!prevStep}
          style={[s.arrowBtn, !prevStep && s.arrowBtnDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={prevStep ? colors.accent : colors.textDim} />
        </TouchableOpacity>
        <Text style={s.titleText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {currentStep.roman} · {currentStep.title}
        </Text>
        <TouchableOpacity
          onPress={() => goTo(nextStep?.route)}
          disabled={!nextStep}
          style={[s.arrowBtn, !nextStep && s.arrowBtnDisabled]}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-forward" size={22} color={nextStep ? colors.accent : colors.textDim} />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  arrowBtn: { paddingVertical: 4, paddingHorizontal: 8, minWidth: 24 },
  arrowBtnDisabled: { opacity: 0.25 },
  titleText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    color: colors.textPrimary,
    letterSpacing: 0.5,
    fontFamily: font.bodyMedium,
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
