import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { colors, radius, spacing, font } from '../constants/theme';
import { virtues } from '../constants/virtues';
import { saveJournal, getTodayJournal, getJournals, incrementStreak, updateJournalEntry, getTodayReading, getCompassDone } from '../store/db';

const morningPrompts = [
  {
    num: 'I',
    q: 'What is in my control today — and what must I release?',
    hint: "The Stoics divide all things into two categories: what is 'up to us' and what is not. Up to us: our judgments, intentions, how we respond. Not up to us: other people's behavior, outcomes, reputation, the weather, the economy.\n\nImportantly, your thoughts themselves are not fully in your control — they arise unbidden. What is in your control is whether you assent to a thought, dwell on it, act on it. The Stoic practice is not suppression but discernment: this impression is mine to engage with; that one I can let pass.\n\nReleasing what is not yours doesn't mean you don't care. It means you stop exhausting yourself on things you cannot move.",
  },
  {
    num: 'II',
    q: 'Where will courage be required of me today?',
    hint: "Courage (andreia) is one of the four cardinal virtues — but the Stoics meant something precise by it. Not recklessness, not aggression. The willingness to act rightly even when it is uncomfortable, costly, or unpopular.\n\nCourage is required whenever you know what the right thing is but feel resistance to doing it: the difficult conversation you've been avoiding, the boundary you need to hold, the work that demands your honest effort when distraction is easier.\n\nAsking this in the morning puts you on alert. You've named the moment before it arrives. When it comes, you've already decided.",
  },
  {
    num: 'III',
    q: 'What are you postponing that matters? Name one thing.',
    hint: "Seneca wrote that we suffer more in imagination than in reality — but he also observed that we are experts at deferring what matters in favor of what is urgent, easy, or comfortable.\n\nThe Stoics were deeply aware of mortality as a clarifying force. If you knew today was your last, what would you regret not having done? That regret is information. It points at what actually matters to you beneath the noise of daily preference.\n\nNaming one thing — just one — makes it real. The act of naming is the act of committing. Not to completing it today necessarily, but to acknowledging that it exists and that you are responsible for it.",
  },
  {
    num: 'IV',
    q: 'What difficulty might arise today, and how would a person of virtue meet it?',
    hint: "This is premeditatio malorum — the premeditation of adversity. The Stoics practiced it daily. Marcus Aurelius began most mornings by mentally rehearsing the difficult people and situations he would face.\n\nModern research confirms what the Stoics intuited: negative visualization — mentally simulating obstacles before they occur — reduces anxiety and improves performance. It works because the obstacle loses its power to surprise you. You've already met it, already chosen your response.\n\nAsk: not 'what bad thing might happen' in a fearful way, but 'how would a person who embodies wisdom, courage, and justice meet this?' You're not predicting disaster. You're rehearsing virtue.",
  },
  {
    num: 'V · Memento mori',
    q: 'The hourglass turns. What do you owe the day?',
    hint: "Memento mori — remember that you will die — is not morbid for the Stoics. It is clarifying. Marcus Aurelius returned to it constantly, not to generate despair but to burn away the trivial.\n\nThe Stoic observation is simple: your time is finite. Most of it will be ordinary. The question is whether you will show up to the ordinary with intention or let it pass unconsciously.\n\n'What do you owe the day?' is not about productivity. It is about presence and integrity. What does this day deserve from you — given that it exists, given that you exist, given that neither will last?",
  },
];

const eveningPrompts = [
  {
    num: 'I · Examine',
    q: 'Where did I act in accordance with my virtue today?',
    hint: "The evening Examen begins with what went right — not as self-congratulation but as honest accounting. The Stoics believed virtue was not an abstract aspiration but something demonstrated in specific moments: how you treated a person who frustrated you, whether you kept your word, whether you were present.\n\nLooking for evidence of virtue is a skill. Most people are faster to notice their failures than their successes. Naming what you did well isn't vanity — it's recognizing the character you're building, reinforcing the pattern you want to continue.\n\nBe specific. 'I was patient' is less useful than 'I stayed calm when the meeting ran over and I still gave my colleague my full attention.'",
  },
  {
    num: 'II · Confess',
    q: 'Where did I fall short? What would the Stoic have done?',
    hint: "The Stoics were unflinching self-examiners. Seneca wrote that we should 'censure' ourselves each evening — not to generate guilt but to learn. The goal is not punishment. It's accuracy.\n\nWhere you fell short tells you something true about yourself: a pattern of avoidance, a recurring trigger, a virtue you haven't yet developed. That information is valuable only if you look at it clearly rather than explaining it away or dwelling in shame.\n\nThe second question — what would the Stoic have done? — is the productive pivot. It transforms the failure from a verdict into a lesson. You're not broken. You're practicing.",
  },
  {
    num: 'III · Release',
    q: 'What am I carrying that I must set down before I sleep?',
    hint: "Epictetus taught that many of our burdens are not ours to carry — we've picked them up through habit, obligation, or the failure to distinguish what is ours from what is not.\n\nSome things you carry are legitimate: responsibilities, relationships, real problems that need your attention tomorrow. But many are not — the conversation that looped all day, the slight that happened and cannot be undone, the worry about something you cannot control.\n\nSetting something down doesn't mean it disappears. It means you stop running it in the background when it serves no purpose. Sleep is not for processing. What needs to be carried tomorrow will be there tomorrow. What doesn't — let it go tonight.",
  },
  {
    num: 'IV · Gratitude',
    q: 'Name one thing — however small — that deserves your thanks.',
    hint: "Stoic gratitude is not the forced positivity of modern self-help. It is a corrective to a perceptual error: we habituate to what we have and stop seeing it. The practice is attention, not cheerfulness.\n\nMarcus Aurelius wrote long passages cataloguing what specific people had taught him, what specific circumstances had given him. The specificity matters. 'I'm grateful for my health' is a thought. 'I noticed my body carried me through a hard day without complaint' is perception.\n\nOne thing. However small. The smaller the better, in some ways — it proves you were paying attention.",
  },
];

const virtueDetails = {
  wisdom: { latin: 'Sophia', definition: 'The virtue of discernment and right judgment. Wisdom means seeing things clearly — not as you wish them to be, but as they are.', question: 'Am I perceiving this clearly or through bias, fear, or ego?' },
  courage: { latin: 'Andreia', definition: 'The virtue of strength and moral fortitude. Courage is doing the right thing even when it is hard.', question: 'What fear is stopping me right now?' },
  moderation: { latin: 'Sophrosyne', definition: 'The virtue of temperance and balance. Neither indulgence nor deprivation — the disciplined middle path.', question: 'Where am I in excess today?' },
  justice: { latin: 'Dikaiosyne', definition: 'The virtue of fairness and right action toward others. Justice is about how you treat the people around you.', question: 'Did I treat others with fairness today?' },
};

function JournalEntryEditor({ entry, onSave, onCancel }) {
  const isMorning = entry.type === 'morning';
  const prompts = isMorning ? morningPrompts : eveningPrompts;
  const [answers, setAnswers] = useState(entry.answers || {});
  const [selectedVirtue, setSelectedVirtue] = useState(entry.virtue || virtues[0].id);
  const [openPrompt, setOpenPrompt] = useState(0);
  const [openHint, setOpenHint] = useState(null);

  return (
    <View style={e.container}>
      <View style={e.header}>
        <Text style={e.headerTitle}>Edit {isMorning ? 'morning' : 'evening'} entry</Text>
        <Text style={e.headerDate}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
      </View>

      {isMorning && (
        <View style={e.virtueSection}>
          <Text style={e.sectionLabel}>Virtue focus</Text>
          <View style={e.virtuePills}>
            {virtues.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[e.vpill, selectedVirtue === v.id && e.vpillActive]}
                onPress={() => setSelectedVirtue(v.id)}
                activeOpacity={0.7}
              >
                <Text style={[e.vpillName, selectedVirtue === v.id && e.vpillNameActive]}>{v.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {prompts.map((prompt, idx) => (
        <TouchableOpacity
          key={idx}
          style={[e.promptCard, openPrompt === idx && e.promptCardOpen]}
          onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
          activeOpacity={0.8}
        >
          <View style={s.promptTopRow}>
            <Text style={e.promptNum}>{prompt.num}</Text>
            {prompt.hint && (
              <TouchableOpacity
                style={s.hintBtn}
                onPress={() => setOpenHint(openHint === idx ? null : idx)}
              >
                <Text style={s.hintBtnText}>ⓘ</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={e.promptQ}>{prompt.q}</Text>
          {openHint === idx && prompt.hint && (
            <View style={s.hintBox}>
              <Text style={s.hintText}>{prompt.hint}</Text>
            </View>
          )}
          {openPrompt === idx && (
            <View style={e.promptAnswer}>
              <TextInput
                style={e.promptInput}
                multiline
                placeholder="Write here..."
                placeholderTextColor={colors.textDim}
                value={answers[idx] || ''}
                onChangeText={text => setAnswers(prev => ({ ...prev, [idx]: text }))}
                scrollEnabled={false}
              />
            </View>
          )}
        </TouchableOpacity>
      ))}

      <View style={e.btnRow}>
        <TouchableOpacity style={e.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <Text style={e.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={e.saveBtn}
          onPress={() => onSave({ ...entry, answers, virtue: selectedVirtue })}
          activeOpacity={0.8}
        >
          <Text style={e.saveBtnText}>Save changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


// Group entries by month for chronological browsing
function groupByMonth(entries) {
  const groups = {};
  entries.forEach(entry => {
    const d = new Date(entry.date);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    if (!groups[key]) groups[key] = { label, entries: [] };
    groups[key].entries.push(entry);
  });
  return Object.keys(groups).sort().reverse().map(k => groups[k]);
}

export default function JournalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const type = params?.type || 'morning';
  const isMorning = type !== 'evening';
  const prompts = isMorning ? morningPrompts : eveningPrompts;

  const [answers, setAnswers] = useState({});
  const [selectedVirtue, setSelectedVirtue] = useState(virtues[0].id);
  const [openPrompt, setOpenPrompt] = useState(0);
  const [openHint, setOpenHint] = useState(null);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [showVirtueDetail, setShowVirtueDetail] = useState(false);
  const [viewMode, setViewMode] = useState('write'); // 'write' | 'history'
  const [history, setHistory] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterVirtue, setFilterVirtue] = useState('all');
  const [sortMode, setSortMode] = useState('date'); // 'date' | 'virtue'
  const [filterMonth, setFilterMonth] = useState('all');
  const [editingEntry, setEditingEntry] = useState(null);

  useFocusEffect(useCallback(() => {
    async function load() {
      const existing = await getTodayJournal(isMorning ? 'morning' : 'evening');
      if (existing) {
        setAnswers(existing.answers || {});
        setSelectedVirtue(existing.virtue || virtues[0].id);
        setAlreadySaved(true);
      } else {
        setAnswers({});
        setSelectedVirtue(virtues[0].id);
        setAlreadySaved(false);
      }
      const all = await getJournals();
      setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));
    }
    load();
  }, [type]));

  const answeredCount = Object.values(answers).filter(v => v && v.trim().length > 0).length;
  const selectedVirtueObj = virtues.find(v => v.id === selectedVirtue);
  const virtueDetail = virtueDetails[selectedVirtue];

  async function handleSave() {
    const entry = {
      id: Date.now().toString(),
      type: isMorning ? 'morning' : 'evening',
      date: new Date().toISOString(),
      virtue: selectedVirtue,
      answers,
    };
    const ok = await saveJournal(entry);
    if (ok) {
      await incrementStreak();
      setAlreadySaved(true);
      const all = await getJournals();
      setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));

      if (isMorning) {
        // Morning: offer to go to reading (likely not done yet) or back to practice
        Alert.alert(
          '',
          'Morning reflection saved.',
          [
            { text: 'Go to Practice', onPress: () => router.replace('/') },
            { text: 'Read today\'s wisdom', onPress: () => router.replace('/read') },
          ]
        );
      } else {
        // Evening: check if all practice items are complete
        const readingDone = await getTodayReading();
        const compassDone = await getCompassDone();
        const morningDone = await getTodayJournal('morning');
        const allDone = !!compassDone && !!readingDone && !!morningDone;

        if (allDone) {
          // Everything complete — go straight to the sealed state
          router.replace('/');
        } else if (readingDone) {
          // Reading done, just go to practice
          Alert.alert(
            '',
            'Evening reflection saved.',
            [{ text: 'Go to Practice', onPress: () => router.replace('/') }]
          );
        } else {
          // Reading not done yet — offer it
          Alert.alert(
            '',
            'Evening reflection saved.',
            [
              { text: 'Go to Practice', onPress: () => router.replace('/') },
              { text: 'Read today\'s wisdom', onPress: () => router.replace('/read') },
            ]
          );
        }
      }
    }
  }

 async function handleEditSave(updated) {
  const ok = await updateJournalEntry(updated);
  if (ok) {
    const all = await getJournals();
    setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));
    setEditingEntry(null);
    Alert.alert('', 'Entry updated.');
  }
}

  // Filtered + sorted history
  // Available months from history
  const availableMonths = [...new Set(history.map(e => {
    const d = new Date(e.date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }))].sort().reverse();

  const filteredHistory = history
    .filter(e => {
      if (filterVirtue !== 'all' && e.virtue !== filterVirtue) return false;
      if (filterMonth !== 'all') {
        const d = new Date(e.date);
        const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (key !== filterMonth) return false;
      }
      if (searchQ.trim()) {
        const q = searchQ.toLowerCase();
        const text = Object.values(e.answers || {}).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortMode === 'virtue') return (a.virtue || '').localeCompare(b.virtue || '');
      return new Date(b.date) - new Date(a.date);
    });

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentInset={{ bottom: 40 }}
          scrollIndicatorInsets={{ bottom: 40 }}
          style={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <TouchableOpacity onPress={() => router.back()} style={s.backRow}>
              <Text style={s.backArrow}>‹</Text>
              <Text style={s.backLabel}>Practice</Text>
            </TouchableOpacity>
            <Text style={s.eyebrow}>{isMorning ? 'Morning reflection' : 'Evening reflection'}</Text>
            <Text style={s.title}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{'\n'}
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </Text>
            <Text style={s.sub}>
              {isMorning ? '5–10 minutes · Before the world begins' : '10–15 minutes · Before the day closes'}
            </Text>
          </View>

          <View style={s.tabRow}>
            {['write', 'history'].map(t => (
              <TouchableOpacity
                key={t}
                style={[s.tabBtn, viewMode === t && s.tabBtnActive]}
                onPress={() => setViewMode(t)}
              >
                <Text style={[s.tabBtnText, viewMode === t && s.tabBtnTextActive]}>
                  {t === 'write' ? (alreadySaved ? 'Today' : 'Write') : 'History'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {viewMode === 'write' ? (
            <>
              <View style={s.mementoStrip}>
                <Text style={s.mementoText}>
                  {isMorning
                    ? '"This day will not come again. What will you make of the hours you are given?"'
                    : '"Did you live well today? Not perfectly — but with intention?"'}
                </Text>
                <Text style={s.mementoSub}>
                  {isMorning ? 'Memento mori · Carpe diem' : 'The day closes · Examine thyself'}
                </Text>
              </View>

              <View style={s.body}>
                {isMorning && (
                  <View style={s.virtueSection}>
                    <Text style={s.secLabel}>Today's virtue focus</Text>
                    <View style={s.virtuePills}>
                      {virtues.map(v => (
                        <TouchableOpacity
                          key={v.id}
                          style={[s.vpill, selectedVirtue === v.id && s.vpillActive]}
                          onPress={() => { setSelectedVirtue(v.id); setShowVirtueDetail(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.vpillName, selectedVirtue === v.id && s.vpillNameActive]}>
                            {v.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {selectedVirtueObj && (
                      <TouchableOpacity
                        style={s.virtueInfoCard}
                        onPress={() => setShowVirtueDetail(!showVirtueDetail)}
                        activeOpacity={0.8}
                      >
                        <View style={s.virtueInfoLeft}>
                          <Text style={s.virtueInfoName}>{selectedVirtueObj.name}</Text>
                          <Text style={s.virtueInfoLatin}>{virtueDetail?.latin}</Text>
                          <Text style={s.virtueInfoDesc}>{selectedVirtueObj.desc}</Text>
                        </View>
                        <Text style={s.virtueInfoChev}>{showVirtueDetail ? '∨' : '›'}</Text>
                      </TouchableOpacity>
                    )}
                    {showVirtueDetail && virtueDetail && (
                      <View style={s.virtueDetailCard}>
                        <Text style={s.virtueDetailText}>{virtueDetail.definition}</Text>
                        <View style={s.virtueDetailDivider} />
                        <Text style={s.virtueDetailQuestion}>"{virtueDetail.question}"</Text>
                      </View>
                    )}
                  </View>
                )}

                {prompts.map((prompt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[s.promptCard, openPrompt === idx && s.promptCardOpen]}
                    onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
                    activeOpacity={0.8}
                  >
                    <View style={s.promptTopRow}>
                      <Text style={s.promptNum}>{prompt.num}</Text>
                      {prompt.hint && (
                        <TouchableOpacity
                          style={s.hintBtn}
                          onPress={() => setOpenHint(openHint === idx ? null : idx)}
                        >
                          <Text style={s.hintBtnText}>ⓘ</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={s.promptQ}>{prompt.q}</Text>
                    {openHint === idx && prompt.hint && (
                      <View style={s.hintBox}>
                        <Text style={s.hintText}>{prompt.hint}</Text>
                      </View>
                    )}
                    {openPrompt === idx && (
                      <View style={s.promptAnswer}>
                        <TextInput
                          style={s.promptInput}
                          multiline
                          placeholder="Write here — no judgment, only honesty..."
                          placeholderTextColor={colors.textDim}
                          value={answers[idx] || ''}
                          onChangeText={text => setAnswers(prev => ({ ...prev, [idx]: text }))}
                          scrollEnabled={false}
                          keyboardAppearance="dark"
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                <View style={s.anchorCard}>
                  <Text style={s.anchorLabel}>{isMorning ? 'Morning anchor' : 'Evening anchor'}</Text>
                  <Text style={s.anchorText}>
                    {isMorning
                      ? '"When you wake, say this to yourself: today I will meet people who are meddlesome, ungrateful, arrogant, deceitful, envious, and unsocial. They are this way because they cannot tell good from evil. But I have seen that the nature of good is beautiful, and the nature of evil ugly, and that the wrongdoer is kin to me — not of the same blood, but sharing in the same reason and the same portion of the divine. I cannot be harmed by any of them. No one can make me ugly. I cannot be angry at a kinsman or hate him. We were made for cooperation — like hands, like feet, like the rows of upper and lower teeth."'
                      : '"Ask yourself at day\'s end: What was ill done? What done? What left undone? Starting from the first, proceed through all three."'}
                  </Text>
                  <Text style={s.anchorAuthor}>
                    {isMorning ? 'Marcus Aurelius · Meditations II.1' : 'Epictetus · Discourses III.10'}
                  </Text>
                </View>

                <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={s.saveBtnText}>
                    {alreadySaved ? 'Update journal' : `Complete ${isMorning ? 'morning' : 'evening'} journal`}
                  </Text>
                  <Text style={s.saveBtnSub}>{answeredCount} of {prompts.length} prompts answered</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={s.body}>
              {/* Search + Filter bar */}
              <View style={s.searchBar}>
                <TextInput
                  style={s.searchInput}
                  placeholder="Search entries..."
                  placeholderTextColor={colors.textDim}
                  value={searchQ}
                  onChangeText={setSearchQ}
                  clearButtonMode="while-editing"
                />
              </View>
              <View style={s.filterRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
                  {['all', ...virtues.map(v => v.id)].map(v => (
                    <TouchableOpacity
                      key={v}
                      style={[s.filterPill, filterVirtue === v && s.filterPillActive]}
                      onPress={() => setFilterVirtue(v)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterPillText, filterVirtue === v && s.filterPillTextActive]}>
                        {v === 'all' ? 'All virtues' : virtues.find(x => x.id === v)?.name || v}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              {availableMonths.length > 1 && (
                <View style={[s.filterRow, { paddingTop: 0 }]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 4 }}>
                    <TouchableOpacity
                      style={[s.filterPill, filterMonth === 'all' && s.filterPillActive]}
                      onPress={() => setFilterMonth('all')}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.filterPillText, filterMonth === 'all' && s.filterPillTextActive]}>All time</Text>
                    </TouchableOpacity>
                    {availableMonths.map(mk => {
                      const d = new Date(mk + '-01');
                      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                      return (
                        <TouchableOpacity
                          key={mk}
                          style={[s.filterPill, filterMonth === mk && s.filterPillActive]}
                          onPress={() => setFilterMonth(mk)}
                          activeOpacity={0.7}
                        >
                          <Text style={[s.filterPillText, filterMonth === mk && s.filterPillTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              <View style={s.sortRow}>
                <TouchableOpacity onPress={() => setSortMode(sortMode === 'date' ? 'virtue' : 'date')} style={s.sortBtn}>
                  <Text style={s.sortBtnText}>Sort: {sortMode === 'date' ? 'Date ↓' : 'Virtue A–Z'}</Text>
                </TouchableOpacity>
                {filteredHistory.length !== history.length && (
                  <Text style={s.filterCount}>{filteredHistory.length} of {history.length}</Text>
                )}
              </View>

              {filteredHistory.length === 0 && history.length > 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>No matches</Text>
                  <Text style={s.emptyText}>Try a different search or filter.</Text>
                </View>
              ) : filteredHistory.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>☽</Text>
                  <Text style={s.emptyTitle}>No entries yet</Text>
                  <Text style={s.emptyText}>
                    {`Your ${isMorning ? 'morning' : 'evening'} journal entries will appear here after you complete today's practice.\n\n${isMorning ? 'The morning journal has five prompts: what is in your control, where courage is required, what you are postponing, what difficulty might arise, and what you owe the day.' : 'The evening journal has four movements: examine where you acted with virtue, confess where you fell short, release what you are carrying, and find one thing that deserves your thanks.'}`}
                  </Text>
                </View>
              ) : (
                groupByMonth(filteredHistory).map(group => (
                  <View key={group.label}>
                    <View style={s.monthHeader}><Text style={s.monthHeaderText}>{group.label}</Text></View>
                    {group.entries.map(entry => (
                  <View key={entry.id}>
                    {editingEntry?.id === entry.id ? (
                      <JournalEntryEditor
                        entry={editingEntry}
                        onSave={handleEditSave}
                        onCancel={() => setEditingEntry(null)}
                      />
                    ) : (
                      <View style={s.histEntry}>
                        <View style={s.histEntryHeader}>
                          <View>
                            <Text style={s.histEntryDate}>
                              {new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </Text>
                            {entry.virtue && (
                              <Text style={s.histEntryVirtue}>{entry.virtue}</Text>
                            )}
                          </View>
                          <TouchableOpacity
                            style={s.editBtn}
                            onPress={() => setEditingEntry(entry)}
                            activeOpacity={0.7}
                          >
                            <Text style={s.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                        {Object.entries(entry.answers || {}).map(([idx, answer]) => {
                          if (!answer || !answer.trim()) return null;
                          const prompt = prompts[parseInt(idx)];
                          return (
                            <View key={idx} style={s.histAnswerBlock}>
                              {prompt && <Text style={s.histPromptNum}>{prompt.num}</Text>}
                              <Text style={s.histAnswer}>{answer}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  container: { borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.lg, overflow: 'hidden', marginBottom: 12 },
  header: { backgroundColor: colors.accentBg, padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.accentDim, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '600', color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
  headerDate: { fontSize: 13, color: colors.accentDim },
  virtueSection: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  sectionLabel: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 10 },
  virtuePills: { flexDirection: 'row', gap: 6 },
  vpill: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.sm, paddingVertical: 10, alignItems: 'center' },
  vpillActive: { borderColor: colors.accent, backgroundColor: colors.accentBg },
  vpillName: { fontSize: 11, fontWeight: '500', color: colors.textDim },
  vpillNameActive: { color: colors.accent },
  promptCard: { borderBottomWidth: 0.5, borderBottomColor: colors.border, padding: 14, backgroundColor: colors.bgCard },
  promptCardOpen: { backgroundColor: colors.bgElevated },
  promptNum: { fontSize: 9, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 6 },
  promptQ: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, fontFamily: font.serif },
  promptAnswer: { marginTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 12 },
  promptInput: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, minHeight: 80, textAlignVertical: 'top' },
  btnRow: { flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.bgDeep },
  cancelBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  saveBtn: { flex: 2, borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md, padding: 14, alignItems: 'center', backgroundColor: colors.accentBg },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 16, color: colors.textDim },
  hintBox: { marginTop: 12, padding: 12, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  header: {
    backgroundColor: colors.bgDeep,
    padding: spacing.xl,
    paddingTop: spacing.lg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backArrow: { fontSize: 24, color: colors.accent },
  backLabel: { fontSize: 13, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36 },
  sub: { fontSize: font.subSize, color: colors.textMuted, marginTop: 8 },
  tabRow: { flexDirection: 'row', gap: 10, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgDeep },
  searchBar: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  searchInput: { backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderMid, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: colors.textPrimary },
  filterRow: { paddingVertical: 6 },
  filterPill: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.bgCard },
  filterPillActive: { backgroundColor: colors.accentBg, borderColor: colors.accentDim },
  filterPillText: { fontSize: 12, color: colors.textDim, letterSpacing: 0.3 },
  filterPillTextActive: { color: colors.accent },
  sortRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  sortBtn: { padding: 4 },
  sortBtnText: { fontSize: 12, color: colors.textDim, letterSpacing: 0.5 },
  filterCount: { fontSize: 12, color: colors.textMuted },
  monthHeader: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: colors.bgDeep, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  monthHeaderText: { fontSize: 11, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
  tabBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, padding: 14, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.bgElevated, borderColor: colors.borderStrong },
  tabBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  tabBtnTextActive: { color: colors.textSecondary },
  mementoStrip: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    padding: spacing.xl,
    paddingVertical: 20,
  },
  mementoText: { fontSize: 15, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif, fontStyle: 'italic' },
  mementoSub: { fontSize: 10, color: colors.accentDim, marginTop: 8, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Light writing surface
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  virtueSection: { marginBottom: 8 },
  virtuePills: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  vpill: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', backgroundColor: colors.bgElevated },
  vpillActive: { borderColor: colors.textSecondary, backgroundColor: colors.bgElevated },
  vpillName: { fontSize: 12, fontWeight: '400', color: colors.textDim },
  vpillNameActive: { color: colors.textPrimary, fontWeight: '500' },
  virtueInfoCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 18, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.bgElevated,
  },
  virtueInfoLeft: { flex: 1 },
  virtueInfoName: { fontSize: 20, fontWeight: '400', color: colors.textPrimary, marginBottom: 2 },
  virtueInfoLatin: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  virtueInfoDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  virtueInfoChev: { fontSize: 20, color: colors.textDim },
  virtueDetailCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 18, marginBottom: 8, backgroundColor: colors.bgCard,
  },
  virtueDetailText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, fontFamily: font.serif },
  virtueDetailDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 14 },
  virtueDetailQuestion: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  promptCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 20, marginBottom: 10, backgroundColor: colors.bgElevated },
  promptCardOpen: { borderColor: colors.borderMid },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: font.microSize, letterSpacing: 2, color: colors.textDim, textTransform: 'uppercase' },
  promptQ: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, fontWeight: '400' },
  promptAnswer: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 100, textAlignVertical: 'top' },
  promptHeader: { marginBottom: 0 },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 16, color: colors.textDim },
  hintBox: { marginTop: 14, padding: 14, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
  anchorCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 20, marginBottom: 12, backgroundColor: colors.bgCard,
  },
  anchorLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textDim, textTransform: 'uppercase', marginBottom: 10 },
  anchorText: { fontSize: 17, color: colors.textPrimary, fontFamily: font.serif, lineHeight: 28 },
  anchorAuthor: { fontSize: 11, color: colors.textDim, marginTop: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  saveBtn: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 18, alignItems: 'center', backgroundColor: colors.bgElevated, marginBottom: 36,
  },
  saveBtnText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  saveBtnSub: { fontSize: 12, color: colors.textMuted, marginTop: 5 },
  empty: { padding: 40, alignItems: 'center', backgroundColor: colors.bgCard },
  emptyIcon: { fontSize: 32, marginBottom: 16, opacity: 0.4 },
  emptyTitle: { fontSize: 17, fontWeight: '500', color: colors.textSecondary, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, color: colors.textDim, textAlign: 'center', lineHeight: 22 },
  histEntry: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, marginBottom: 12, overflow: 'hidden', backgroundColor: colors.bgElevated },
  histEntryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: colors.bgCard, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  histEntryDate: { fontSize: 15, fontWeight: '500', color: colors.textPrimary, marginBottom: 3 },
  histEntryVirtue: { fontSize: 12, color: colors.textMuted, textTransform: 'capitalize', letterSpacing: 0.5 },
  editBtn: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  editBtnText: { fontSize: 12, color: colors.textMuted, letterSpacing: 0.5 },
  histAnswerBlock: { padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  histPromptNum: { fontSize: 9, letterSpacing: 2, color: colors.textDim, textTransform: 'uppercase', marginBottom: 5 },
  histAnswer: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
});