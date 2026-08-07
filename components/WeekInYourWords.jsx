import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius } from '../constants/theme';
import { morningPrompts, eveningPrompts, askedPrompt } from '../constants/journalPrompts';
import * as haptics from '../lib/haptics';

// The week's journal entries, readable inside the weekly review.
//
// III · Pattern asks what patterns you are noticing, and that is the one
// question in the app that cannot honestly be answered from memory, because
// memory is where patterns hide. The review already loaded the week's entries
// to count them (uniqueDaysJournaled) and then threw the words away, so the
// prompt was asking for recall and calling it reflection.
//
// Chronological, oldest first, to match the direction the spark chart runs and
// because a week reads forward. Collapsed by default at both levels: the panel,
// then each day. Seven days of two entries is far too much to unfold at once,
// and the point is to let someone move through the week deliberately.
export function WeekInYourWords({ entries, style }) {
  const [open, setOpen] = useState(false);
  const [openDay, setOpenDay] = useState(null);

  const days = groupByDay(entries);
  if (!days.length) return null;

  const entryCount = entries.length;

  return (
    <View style={[s.panel, style]}>
      <TouchableOpacity
        style={s.header}
        onPress={() => { haptics.tap(); setOpen(!open); }}
        activeOpacity={0.7}
      >
        <View style={s.headerText}>
          <Text style={s.title}>The week in your words</Text>
          <Text style={s.sub}>
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'} across {days.length} {days.length === 1 ? 'day' : 'days'}
          </Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.accent}
        />
      </TouchableOpacity>

      {open && (
        <View style={s.dayList}>
          {days.map(day => {
            const isOpen = openDay === day.key;
            return (
              <View key={day.key} style={s.day}>
                <TouchableOpacity
                  style={s.dayRow}
                  onPress={() => { haptics.tap(); setOpenDay(isOpen ? null : day.key); }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.dayLabel, isOpen && s.dayLabelOpen]}>{day.label}</Text>
                  <Text style={s.daySessions}>{day.sessions}</Text>
                </TouchableOpacity>

                {isOpen && day.entries.map(entry => (
                  <View key={entry.id || entry.date} style={s.entry}>
                    <Text style={s.entryType}>
                      {entry.type === 'morning' ? 'Morning' : 'Evening'}
                    </Text>
                    {answersInOrder(entry).map(({ key, num, text }) => (
                      <View key={key} style={s.answer}>
                        {num ? <Text style={s.answerNum}>{num}</Text> : null}
                        <Text style={s.answerText}>{text}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// Answers keyed by prompt index, rendered in the prompts' display order and
// labelled with the question that was actually asked. Evening prompts carry an
// `order` that differs from their storage index; morning prompts do not, so
// the index stands in. Same fallback the archive uses.
function answersInOrder(entry) {
  const prompts = entry.type === 'morning' ? morningPrompts : eveningPrompts;
  return Object.entries(entry.answers || {})
    .filter(([key, text]) => key !== 'reckon' && text && String(text).trim())
    .sort(([a], [b]) =>
      (prompts[parseInt(a)]?.order ?? parseInt(a)) -
      (prompts[parseInt(b)]?.order ?? parseInt(b))
    )
    .map(([key, text]) => ({
      key,
      num: askedPrompt(entry, prompts[parseInt(key)], parseInt(key))?.num || null,
      text: String(text).trim(),
    }));
}

function groupByDay(entries) {
  const groups = new Map();
  for (const entry of entries || []) {
    const d = new Date(entry.date);
    const key = d.toDateString();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        time: d.getTime(),
        label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
        entries: [],
      });
    }
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()]
    .sort((a, b) => a.time - b.time)
    .map(g => {
      // Morning before evening within a day, whatever order they were saved in.
      g.entries.sort((a, b) => (a.type === 'morning' ? 0 : 1) - (b.type === 'morning' ? 0 : 1));
      g.sessions = g.entries
        .map(e => (e.type === 'morning' ? 'Morning' : 'Evening'))
        .join(' · ');
      return g;
    });
}

const s = StyleSheet.create({
  panel: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.inputBg, marginBottom: 14, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  headerText: { flex: 1, paddingRight: 12 },
  title: { fontSize: font.labelSize, letterSpacing: 2, color: colors.accent, fontFamily: font.bodyMedium, textTransform: 'uppercase' },
  sub: { fontSize: 13, color: colors.textSecondary, fontFamily: font.body, marginTop: 6 },

  dayList: { borderTopWidth: 0.5, borderTopColor: colors.border },
  day: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  dayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 16 },
  dayLabel: { fontSize: 15, color: colors.textPrimary, fontFamily: font.body },
  dayLabelOpen: { color: colors.accent, fontFamily: font.bodyMedium },
  daySessions: { fontSize: 12, color: colors.textSecondary, fontFamily: font.body },

  entry: { paddingHorizontal: 16, paddingBottom: 16 },
  entryType: { fontSize: 11, letterSpacing: 1.5, color: colors.accentDim, fontFamily: font.bodyMedium, textTransform: 'uppercase', marginBottom: 10 },
  answer: { marginBottom: 12 },
  answerNum: { fontSize: 11, letterSpacing: 1, color: colors.textSecondary, fontFamily: font.bodyMedium, marginBottom: 4 },
  answerText: { fontSize: 15, lineHeight: 24, color: colors.textPrimary, fontFamily: font.body },
});
