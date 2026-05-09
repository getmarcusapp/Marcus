import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
  KeyboardAvoidingView, Platform, InputAccessoryView, Keyboard,
  ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MEDITATIONS, useMeditationPlayer, toggle as toggleMeditation, formatMedTime } from '../lib/meditationPlayer';
import { useMiniPlayerInset } from '../components/MiniMeditationPlayer';
import { colors, radius, spacing, font } from '../constants/theme';

const HERO_GRADIENT = ['#4a3a26', '#1a1410', '#000000'];
import { virtues, VIRTUE_DETAILS } from '../constants/virtues';
import { saveJournal, getTodayJournal, getJournals, incrementStreak, updateJournalEntry } from '../store/db';
import { getNextPracticeAfter } from '../store/practice-flow';
import { cancelJournalNotification } from '../notifications';
import * as haptics from '../lib/haptics';
import * as health from '../lib/health';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMindfulSession } from '../lib/useMindfulSession';

async function maybeAskHealthPermission() {
  const asked = await AsyncStorage.getItem('health_permission_asked');
  if (asked === 'true') return;
  const available = await health.isAvailable();
  if (!available) return;
  Alert.alert(
    'Sync to Apple Health?',
    'Marcus can record each practice you complete as Mindful Minutes, so your reflection time joins the rest of your wellness data. You can change this anytime in Settings.',
    [
      {
        text: 'Maybe later',
        style: 'cancel',
        onPress: async () => { await AsyncStorage.setItem('health_permission_asked', 'true'); },
      },
      {
        text: 'Connect',
        onPress: async () => {
          await health.requestPermission();
          await AsyncStorage.setItem('health_permission_asked', 'true');
        },
      },
    ],
  );
}

const morningPrompts = [
  {
    num: 'I · Discern',
    q: 'What is in my control today — and what must I release?',
    hint: "The Stoics divide all things into two categories: what is 'up to us' and what is not. Up to us: our judgments, intentions, how we respond. Not up to us: other people's behavior, outcomes, reputation, the weather, the economy.\n\nImportantly, your thoughts themselves are not fully in your control: they arise unbidden. What is in your control is whether you assent to a thought, dwell on it, act on it. The Stoic practice is not suppression but discernment: this impression is mine to engage with; that one I can let pass.\n\nReleasing what is not yours doesn't mean you don't care. It means you stop exhausting yourself on things you cannot move.",
  },
  {
    num: 'II · Brace',
    q: 'Where will courage be required of me today?',
    hint: "Courage (andreia) is one of the four cardinal Virtues, but the Stoics meant something precise by it. Not recklessness, not aggression. The willingness to act rightly even when it is uncomfortable, costly, or unpopular.\n\nCourage is required whenever you know what the right thing is but feel resistance to doing it: the difficult conversation you've been avoiding, the boundary you need to hold, the work that demands your honest effort when distraction is easier.\n\nAsking this in the morning puts you on alert. You've named the moment before it arrives. When it comes, you've already decided.",
  },
  {
    num: 'III · Name',
    q: 'What am I postponing that matters? Name one thing.',
    hint: "Seneca wrote that we suffer more in imagination than in reality, but he also observed that we are experts at deferring what matters in favor of what is urgent, easy, or comfortable.\n\nThe Stoics were deeply aware of mortality as a clarifying force. If you knew today was your last, what would you regret not having done? That regret is information. It points at what actually matters to you beneath the noise of daily preference.\n\nNaming one thing — just one — makes it real. The act of naming is the act of committing. Not to completing it today necessarily, but to acknowledging that it exists and that you are responsible for it.",
  },
  {
    num: 'IV · Foresee',
    q: 'What difficulty might I face today, and how would a person of Virtue meet it?',
    hint: "This is premeditatio malorum: the premeditation of adversity. The Stoics practiced it daily. Marcus Aurelius began most mornings by mentally rehearsing the difficult people and situations he would face.\n\nModern research confirms what the Stoics intuited: negative visualization — mentally simulating obstacles before they occur — reduces anxiety and improves performance. It works because the obstacle loses its power to surprise you. You've already met it, already chosen your response.\n\nAsk: not 'what bad thing might happen' in a fearful way, but 'how would a person who embodies wisdom, courage, and justice meet this?' You're not predicting disaster. You're rehearsing Virtue.",
  },
  {
    num: 'V · Question',
    q: 'What impression are you carrying into today that deserves examination before you act on it?',
    hint: "A worry, assumption, or reaction you haven't questioned yet.",
    info: {
      title: 'The Discipline of Assent',
      source: 'Epictetus, Discourses 1.1',
      body: "Epictetus taught that between every event and your response, there is a moment where an impression arises in the mind. Before you act on it, you can examine it. Is this impression accurate? Is what is troubling me actually harmful, or does it just feel that way?\n\nHe called this the discipline of assent — choosing which impressions to accept and which to question.\n\nExamples of impressions worth examining:\n\n• You check your phone and read a terse message. The impression: \"this person is angry with me.\" Is that what the words actually say, or is that one interpretation?\n\n• You have a difficult meeting today. The impression: \"this will go badly and I will not handle it well.\" Is that a fact, or a story?\n\n• Something didn't work out last week. The impression: \"I am behind, things aren't working.\" Is that an accurate reading of reality, or a judgment made on incomplete information?\n\nThe practice is not to eliminate the impression — it is to see it clearly before deciding whether to act on it.",
    },
  },
];

const eveningPrompts = [
  {
    num: 'I · Examine',
    q: 'Where did I act in accordance with my Virtue today?',
    hint: "The evening Examen begins with what went right, not as self-congratulation but as honest accounting. The Stoics believed Virtue was not an abstract aspiration but something demonstrated in specific moments: how you treated a person who frustrated you, whether you kept your word, whether you were present.\n\nLooking for evidence of Virtue is a skill. Most people are faster to notice their failures than their successes. Naming what you did well isn't vanity. It's recognizing the character you're building, reinforcing the pattern you want to continue.\n\nBe specific. 'I was patient' is less useful than 'I stayed calm when the meeting ran over and I still gave my colleague my full attention.'",
  },
  {
    num: 'II · Confess',
    q: 'Where did I fall short? What would the Stoic have done?',
    hint: "The Stoics were unflinching self-examiners. Seneca wrote that we should 'censure' ourselves each evening, not to generate guilt but to learn. The goal is not punishment. It's accuracy.\n\nWhere you fell short tells you something true about yourself: a pattern of avoidance, a recurring trigger, a Virtue you haven't yet developed. That information is valuable only if you look at it clearly rather than explaining it away or dwelling in shame.\n\nThe second question — what would the Stoic have done? — is the productive pivot. It transforms the failure from a verdict into a lesson. You're not broken. You're practicing.",
  },
  {
    num: 'III · Release',
    q: 'What am I carrying that I must set down before I sleep?',
    hint: "Epictetus taught that many of our burdens are not ours to carry. We've picked them up through habit, obligation, or the failure to distinguish what is ours from what is not.\n\nSome things you carry are legitimate: responsibilities, relationships, real problems that need your attention tomorrow. But many are not: the conversation that looped all day, the slight that happened and cannot be undone, the worry about something you cannot control.\n\nSetting something down doesn't mean it disappears. It means you stop running it in the background when it serves no purpose. Sleep is not for processing. What needs to be carried tomorrow will be there tomorrow. What doesn't — let it go tonight.",
  },
  {
    num: 'IV · Gratitude',
    q: 'Name one thing — however small — that deserves my thanks.',
    hint: "Stoic gratitude is not the forced positivity of modern self-help. It is a corrective to a perceptual error: we habituate to what we have and stop seeing it. The practice is attention, not cheerfulness.\n\nMarcus Aurelius wrote long passages cataloging what specific people had taught him, what specific circumstances had given him. The specificity matters. 'I'm grateful for my health' is a thought. 'I noticed my body carried me through a hard day without complaint' is perception.\n\nOne thing. However small. The smaller the better, in some ways. It proves you were paying attention.",
  },
];

const virtuePronunciations = {
  sophia: 'soh-FEE-ah',
  andreia: 'an-DRAY-ah',
  sophrosyne: 'soh-FROH-sih-nee',
  dikaiosyne: 'dee-KAY-oh-sih-nee',
};

function JournalEntryEditor({ entry, onSave, onCancel }) {
  const isMorning = entry.type === 'morning';
  const prompts = isMorning ? morningPrompts : eveningPrompts;
  const [answers, setAnswers] = useState(entry.answers || {});
  const [selectedVirtue, setSelectedVirtue] = useState(entry.virtue || virtues[0].id);
  const [openPrompt, setOpenPrompt] = useState(-1);
  const [openHint, setOpenHint] = useState(null);

  return (
    <View style={e.container}>
      <View style={e.header}>
        <Text style={e.headerTitle}>Edit {isMorning ? 'morning' : 'evening'} entry</Text>
        <Text style={e.headerDate}>{new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
      </View>

      {isMorning && (
        <View style={e.virtueSection}>
          <Text style={e.sectionLabel}>Virtue Focus</Text>
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
            {(prompt.hint || prompt.info) && (
              <TouchableOpacity
                style={s.hintBtn}
                onPress={() => setOpenHint(openHint === idx ? null : idx)}
              >
                <Text style={s.hintBtnText}>ⓘ</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={e.promptQ}>{prompt.q}</Text>
          {prompt.info && prompt.hint && (
            <Text style={s.promptSub}>{prompt.hint}</Text>
          )}
          {openHint === idx && (prompt.info || prompt.hint) && (
            <View style={s.hintBox}>
              {prompt.info ? (
                <>
                  <Text style={s.hintTitle}>{prompt.info.title}</Text>
                  <Text style={s.hintSource}>{prompt.info.source}</Text>
                  <View style={s.hintDivider} />
                  {prompt.info.body.split('\n\n').map((para, i) => (
                    <Text key={i} style={[s.hintText, i > 0 && { marginTop: 10 }]}>{para}</Text>
                  ))}
                </>
              ) : (
                <Text style={s.hintText}>{prompt.hint}</Text>
              )}
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
  const playerInset = useMiniPlayerInset();
  const params = useLocalSearchParams();
  const fromPractice = !!params?.type;
  const fromPath = params?.from || '/';
  const fromLabel = params?.fromLabel || 'Practice';
  const defaultType = params?.type || (new Date().getHours() < 13 ? 'morning' : 'evening');
  const [sessionType, setSessionType] = useState(defaultType);
  const isMorning = sessionType !== 'evening';
  const commitMindfulSession = useMindfulSession();
  const journalMedPlayer = useMeditationPlayer();

  // Sync sessionType when navigating here explicitly from practice with a type param
  useEffect(() => {
    if (params?.type) {
      setSessionType(params.type);
    }
  }, [params?.type]);
  const prompts = isMorning ? morningPrompts : eveningPrompts;

  const [answers, setAnswers] = useState({});
  const [selectedVirtue, setSelectedVirtue] = useState(virtues[0].id);
  const [openPrompt, setOpenPrompt] = useState(-1);
  const [openHint, setOpenHint] = useState(null);
  const promptInputRefs = useRef({});

  useEffect(() => {
    if (openPrompt < 0) return;
    const t = setTimeout(() => promptInputRefs.current[openPrompt]?.focus(), 200);
    return () => clearTimeout(t);
  }, [openPrompt]);
  const [alreadySaved, setAlreadySaved] = useState(false);
  const [showVirtueDetail, setShowVirtueDetail] = useState(false);
  const [viewMode, setViewMode] = useState('write'); // 'write' | 'history'
  const [history, setHistory] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [filterVirtue, setFilterVirtue] = useState('all');
  const [sortMode, setSortMode] = useState('date'); // 'date' | 'virtue'
  const [filterMonth, setFilterMonth] = useState('all');
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    async function reload() {
      const existing = await getTodayJournal(isMorning ? 'morning' : 'evening');
      if (existing) { setAnswers(existing.answers || {}); setSelectedVirtue(existing.virtue || virtues[0].id); setAlreadySaved(true); }
      else { setAnswers({}); setSelectedVirtue(virtues[0].id); setAlreadySaved(false); }
      const all = await getJournals();
      setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));
    }
    reload();
  }, [sessionType]);

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
  }, [sessionType]));

  const answeredCount = Math.min(Object.values(answers).filter(v => v && v.trim().length > 0).length, prompts.length);
  const selectedVirtueObj = virtues.find(v => v.id === selectedVirtue);
  const virtueDetail = VIRTUE_DETAILS[selectedVirtue];

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
      haptics.success();
      commitMindfulSession();
      cancelJournalNotification(isMorning ? 'morning' : 'evening');
      maybeAskHealthPermission();
      await incrementStreak();
      setAlreadySaved(true);
      const all = await getJournals();
      setHistory(all.filter(j => j.type === (isMorning ? 'morning' : 'evening')));

      if (isMorning) {
        const next = await getNextPracticeAfter('morning');
        if (next) {
          Alert.alert('', 'Morning reflection saved.', [
            { text: 'Go to Practice', onPress: () => router.replace('/') },
            { text: `${next.label} →`, onPress: () => router.replace(next.href) },
          ]);
        } else {
          router.replace('/');
        }
      } else {
        // Evening — never redirect to other practice items; just go home.
        router.replace('/');
      }
    }
  }

 async function handleEditSave(updated) {
  const ok = await updateJournalEntry(updated);
  if (ok) {
    haptics.action();
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
          contentContainerStyle={{ paddingBottom: playerInset }}
          style={s.scroll}
          showsVerticalScrollIndicator={true}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.header}>
            <Image
              source={isMorning
                ? require('../assets/heroes/journal-morning.jpg')
                : require('../assets/heroes/journal-evening.jpg')}
              style={s.headerImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.8)']}
              locations={[0, 0.45, 0.75, 1]}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={s.headerContent}>
              {fromPractice && (
                <TouchableOpacity onPress={() => router.replace(fromPath)} style={s.backRow}>
                  <Text style={s.backArrow}>‹</Text>
                  <Text style={s.backLabel}>{fromLabel}</Text>
                </TouchableOpacity>
              )}
              <View style={s.typeToggle}>
                  {['morning', 'evening'].map(t => (
                    <TouchableOpacity key={t} style={[s.typeBtn, sessionType === t && s.typeBtnActive]} onPress={() => { setSessionType(t); setViewMode('write'); setOpenPrompt(-1); setOpenHint(null); }} activeOpacity={0.7}>
                      <Text style={[s.typeBtnText, sessionType === t && s.typeBtnTextActive]}>{t === 'morning' ? '☽  Morning' : '◑  Evening'}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
              <Text style={s.eyebrow}>{isMorning ? 'Morning Journal' : 'Evening Journal'}</Text>
              <Text style={s.title}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}{'\n'}
                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              </Text>
              <Text style={s.sub}>
                {isMorning ? 'Before the world begins' : 'Before the day closes'}
              </Text>
            </View>
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
              <LinearGradient
                colors={HERO_GRADIENT}
                locations={[0, 0.6, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={s.mementoStrip}
              >
                <Text style={s.mementoText}>
                  {isMorning
                    ? '"When you wake, expect to meet people who are difficult: meddling, arrogant, ungrateful. They are this way because they cannot tell good from evil. But they share your nature, and no one can truly harm you. You were made to work with them, not against them."'
                    : '"Ask yourself at day\'s end: What did I do well? What did I do badly? What did I leave undone? Walk through each in turn."'}
                </Text>
                <Text style={s.mementoSub}>
                  {isMorning ? 'Marcus Aurelius · Meditations II.1' : 'Epictetus · Discourses III.10'}
                </Text>
              </LinearGradient>

              <View style={s.body}>
                {isMorning && (
                  <View style={s.virtueSection}>
                    <Text style={s.secLabel}>Today's Virtue Focus</Text>
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

                {(() => {
                  const journalMed = MEDITATIONS[isMorning ? 'premeditatio' : 'evening-examination'];
                  const isCurrent = journalMedPlayer.currentMedId === journalMed.id;
                  const jIsPlaying = isCurrent && journalMedPlayer.isPlaying;
                  const jIsLoading = isCurrent && journalMedPlayer.isLoading;
                  const jPosition = isCurrent ? journalMedPlayer.position : 0;
                  const jDuration = isCurrent ? journalMedPlayer.duration : 0;
                  const jProgress = jDuration > 0 ? jPosition / jDuration : 0;
                  const jLoaded = jDuration > 0;
                  return (
                    <TouchableOpacity
                      style={s.listenCard}
                      onPress={() => { haptics.tap(); toggleMeditation(journalMed); }}
                      activeOpacity={0.85}
                      disabled={jIsLoading}
                    >
                      <View style={s.listenThumb}>
                        <Image source={journalMed.image} style={s.listenThumbImg} resizeMode="cover" />
                        <View style={s.listenThumbOverlay}>
                          {jIsLoading ? (
                            <ActivityIndicator color={colors.accent} size="small" />
                          ) : (
                            <Ionicons
                              name={jIsPlaying ? 'pause-circle' : 'play-circle'}
                              size={32}
                              color={colors.accent}
                            />
                          )}
                        </View>
                      </View>
                      <View style={s.listenContent}>
                        <Text style={s.listenEyebrow}>Listen first · 5 min</Text>
                        <Text style={s.listenTitle}>{journalMed.title}</Text>
                        {jLoaded ? (
                          <>
                            <View style={s.listenProgressBar}>
                              <View style={[s.listenProgressFill, { flex: jProgress }]} />
                              <View style={{ flex: Math.max(0, 1 - jProgress) }} />
                            </View>
                            <View style={s.listenTimeRow}>
                              <Text style={s.listenTimeText}>{formatMedTime(jPosition)}</Text>
                              <Text style={s.listenTimeText}>{formatMedTime(jDuration)}</Text>
                            </View>
                          </>
                        ) : (
                          <Text style={s.listenDesc}>
                            {isMorning
                              ? 'A meditation that primes the practice below.'
                              : 'A meditation that primes the reflection below.'}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })()}

                {prompts.map((prompt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[s.promptCard, openPrompt === idx && s.promptCardOpen]}
                    onPress={() => setOpenPrompt(openPrompt === idx ? -1 : idx)}
                    activeOpacity={0.8}
                  >
                    <View style={s.promptTopRow}>
                      <Text style={s.promptNum}>{prompt.num}</Text>
                      {(prompt.hint || prompt.info) && (
                        <TouchableOpacity
                          style={s.hintBtn}
                          onPress={() => setOpenHint(openHint === idx ? null : idx)}
                        >
                          <Text style={s.hintBtnText}>ⓘ</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={s.promptQ}>{prompt.q}</Text>
                    {prompt.info && prompt.hint && (
                      <Text style={s.promptSub}>{prompt.hint}</Text>
                    )}
                    {openHint === idx && (prompt.info || prompt.hint) && (
                      <View style={s.hintBox}>
                        {prompt.info ? (
                          <>
                            <Text style={s.hintTitle}>{prompt.info.title}</Text>
                            <Text style={s.hintSource}>{prompt.info.source}</Text>
                            <View style={s.hintDivider} />
                            {prompt.info.body.split('\n\n').map((para, i) => (
                              <Text key={i} style={[s.hintText, i > 0 && { marginTop: 10 }]}>{para}</Text>
                            ))}
                          </>
                        ) : (
                          <Text style={s.hintText}>{prompt.hint}</Text>
                        )}
                      </View>
                    )}
                    {openPrompt === idx && (
                      <View style={s.promptAnswer}>
                        <TextInput
                          ref={el => { promptInputRefs.current[idx] = el; }}
                          style={s.promptInput}
                          multiline
                          placeholder="Write here. No judgment, only honesty..."
                          placeholderTextColor={colors.textDim}
                          value={answers[idx] || ''}
                          onChangeText={text => setAnswers(prev => ({ ...prev, [idx]: text }))}
                          scrollEnabled={false}
                          keyboardAppearance="dark"
                          inputAccessoryViewID={Platform.OS === 'ios' ? 'journalAccessory' : undefined}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

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
                      const [yr, mo] = mk.split('-');
                      const d = new Date(parseInt(yr, 10), parseInt(mo, 10) - 1, 1);
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
                  <Text style={s.emptyTitle}>Nothing matches your filter.</Text>
                  <Text style={s.emptyText}>Adjust your search or open the field wider.</Text>
                </View>
              ) : filteredHistory.length === 0 ? (
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>{isMorning ? '☼' : '☽'}</Text>
                  <Text style={s.emptyTitle}>Your {isMorning ? 'mornings' : 'evenings'} are not yet written.</Text>
                  <Text style={s.emptyText}>
                    {isMorning
                      ? 'Four prompts each morning — what is in your control, where courage is required, what you are postponing, what difficulty might arise. Begin one when you are ready.'
                      : 'Four movements each evening — where you acted with Virtue, where you fell short, what you are carrying, and one thing that deserves your thanks.'}
                  </Text>
                  <TouchableOpacity
                    style={s.emptyCta}
                    onPress={() => setViewMode('write')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.emptyCtaText}>
                      {isMorning ? 'Begin morning practice →' : 'Begin evening practice →'}
                    </Text>
                  </TouchableOpacity>
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
                ))}
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="journalAccessory">
          <View style={s.accessoryBar}>
            <TouchableOpacity
              onPress={() => Keyboard.dismiss()}
              style={s.accessoryDone}
              activeOpacity={0.7}
            >
              <Text style={s.accessoryDoneText}>Done</Text>
            </TouchableOpacity>
            {openPrompt < prompts.length - 1 ? (
              <TouchableOpacity
                onPress={() => { haptics.tap(); setOpenPrompt(openPrompt + 1); }}
                style={s.accessoryAction}
                activeOpacity={0.7}
              >
                <Text style={s.accessoryActionText}>Next prompt →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); handleSave(); }}
                style={s.accessoryAction}
                activeOpacity={0.7}
              >
                <Text style={s.accessoryActionText}>
                  {alreadySaved ? 'Update journal →' : 'Complete journal →'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </InputAccessoryView>
      )}
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
  hintBtnText: { fontSize: 18, color: colors.accent },
  hintBox: { marginTop: 12, padding: 12, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  header: {
    backgroundColor: colors.bgDeep,
    minHeight: 280,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  headerImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  headerContent: { padding: spacing.xl, paddingTop: spacing.lg },
  typeToggle: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  typeBtn: { flex: 1, borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center', backgroundColor: colors.bgCard },
  typeBtnActive: { backgroundColor: colors.accentBg, borderColor: colors.accentDim },
  typeBtnText: { fontSize: 13, color: colors.textDim, letterSpacing: 0.5 },
  typeBtnTextActive: { color: colors.accent, fontWeight: '500' },
  backRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 18,
  },
  backArrow: { fontSize: 22, color: colors.accent, marginTop: -2 },
  backLabel: { fontSize: 12, color: colors.accent, letterSpacing: 0.8, textTransform: 'uppercase' },
  eyebrow: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.textMuted, textTransform: 'uppercase', marginBottom: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  title: { fontSize: font.titleSize, fontWeight: '300', color: colors.textPrimary, letterSpacing: -0.5, lineHeight: 36, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  sub: { fontSize: font.subSize, color: colors.textMuted, marginTop: 8, textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.bgDeep },
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
  tabBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.accent },
  tabBtnText: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textDim },
  tabBtnTextActive: { color: colors.accent },
  mementoStrip: {
    backgroundColor: colors.accentBg,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    padding: spacing.xl,
    paddingVertical: 20,
  },
  mementoText: { fontSize: 17, color: colors.textPrimary, lineHeight: 28, fontFamily: font.serif },
  mementoSub: { fontSize: 10, color: colors.accentDim, marginTop: 8, letterSpacing: 1.5, textTransform: 'uppercase' },

  // Light writing surface
  body: { padding: spacing.md, backgroundColor: colors.bgCard },
  secLabel: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
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
  virtueInfoDesc: { fontSize: 14, color: colors.textSecondary, lineHeight: 21 },
  virtueInfoChev: { fontSize: 20, color: colors.textDim },
  virtueDetailCard: {
    borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg,
    padding: 18, marginBottom: 8, backgroundColor: colors.bgCard,
  },
  virtueDetailText: { fontSize: 15, color: colors.textSecondary, lineHeight: 24, fontFamily: font.serif },
  virtueDetailDivider: { height: 0.5, backgroundColor: colors.border, marginVertical: 14 },
  virtueDetailQuestion: { fontSize: 14, color: colors.textMuted, lineHeight: 22 },
  listenCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.lg,
    padding: 12, paddingRight: 16, marginBottom: 14, backgroundColor: colors.accentBg,
  },
  listenThumb: {
    width: 64, height: 64, borderRadius: radius.md,
    overflow: 'hidden', backgroundColor: '#000',
    position: 'relative',
  },
  listenThumbImg: { width: '100%', height: '100%' },
  listenThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  listenContent: { flex: 1 },
  listenEyebrow: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase', marginBottom: 4 },
  listenTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
  listenDesc: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  listenProgressBar: {
    height: 2, backgroundColor: colors.border, borderRadius: 1,
    flexDirection: 'row', overflow: 'hidden', marginTop: 4, marginBottom: 6,
  },
  listenProgressFill: { backgroundColor: colors.accent, borderRadius: 1 },
  listenTimeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  listenTimeText: { fontSize: 10, color: colors.textDim, letterSpacing: 0.3 },
  promptCard: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg, padding: 20, marginBottom: 10, backgroundColor: colors.bgElevated },
  promptCardOpen: { borderColor: colors.borderMid },
  promptTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  promptNum: { fontSize: font.microSize, letterSpacing: 2, color: colors.accent, textTransform: 'uppercase' },
  promptQ: { fontSize: 15, color: colors.textPrimary, lineHeight: 24, fontWeight: '400' },
  promptAnswer: { marginTop: 16, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 16 },
  promptInput: { fontSize: 16, color: colors.textPrimary, lineHeight: 26, minHeight: 100, textAlignVertical: 'top' },
  nextPromptBtn: { marginTop: 12, alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 4 },
  nextPromptText: { fontSize: 12, color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  accessoryDone: { paddingVertical: 6, paddingHorizontal: 8 },
  accessoryDoneText: { fontSize: 14, color: colors.textDim, letterSpacing: 0.3 },
  accessoryAction: { paddingVertical: 6, paddingHorizontal: 8 },
  accessoryActionText: { fontSize: 13, fontWeight: '600', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
  promptHeader: { marginBottom: 0 },
  hintBtn: { padding: 4 },
  hintBtnText: { fontSize: 18, color: colors.accent },
  hintBox: { marginTop: 14, padding: 14, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border },
  hintText: { fontSize: 16, color: colors.textSecondary, lineHeight: 26, fontFamily: font.serif },
  // Subtitle shown beneath the question for prompts that ship a richer
  // info card (currently the discipline-of-assent prompt) — orients the
  // user before they tap the ⓘ to read the teaching.
  promptSub: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic', marginTop: 6, lineHeight: 20 },
  // Header treatment inside the hintBox when prompt.info is present:
  // small uppercase title in accent, dim source citation below, then a
  // hairline divider before the body paragraphs.
  hintTitle: { fontSize: font.labelSize, letterSpacing: font.sectionTracking, color: colors.accent, textTransform: 'uppercase', marginBottom: 4 },
  hintSource: { fontSize: 12, color: colors.textDim, fontStyle: 'italic', letterSpacing: 0.3 },
  hintDivider: { height: 0.5, backgroundColor: colors.border, marginTop: 12, marginBottom: 12 },
  saveBtn: {
    borderWidth: 0.5, borderColor: colors.borderMid, borderRadius: radius.md,
    padding: 18, alignItems: 'center', backgroundColor: colors.bgElevated, marginBottom: 36,
  },
  saveBtnText: { fontSize: 13, fontWeight: '500', color: colors.textPrimary, letterSpacing: 1, textTransform: 'uppercase' },
  saveBtnSub: { fontSize: 12, color: colors.textMuted, marginTop: 5 },
  empty: { padding: 40, paddingTop: 56, alignItems: 'center', backgroundColor: colors.bgCard },
  emptyIcon: { fontSize: 32, marginBottom: 16, color: colors.accentDim },
  emptyTitle: { fontSize: 18, fontWeight: '400', color: colors.textPrimary, marginBottom: 12, textAlign: 'center', fontFamily: font.serif },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  emptyCta: {
    marginTop: 28,
    borderWidth: 0.5, borderColor: colors.accentDim, borderRadius: radius.md,
    paddingVertical: 14, paddingHorizontal: 22,
    backgroundColor: colors.accentBg,
  },
  emptyCtaText: { fontSize: 13, fontWeight: '500', color: colors.accent, letterSpacing: 1, textTransform: 'uppercase' },
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