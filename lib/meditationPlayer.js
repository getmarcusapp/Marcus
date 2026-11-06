import { useEffect, useState } from 'react';
import { Audio, InterruptionModeIOS } from 'expo-av';
import { addPracticeTime } from './practiceTime';
import { writeMindfulSession } from './health';
import { track } from './analytics';
import { Asset } from 'expo-asset';
import NowPlaying from '../modules/now-playing';

// Imagery: public-domain classical art, one per meditation, credited in
// app/imagery.jsx (MEDITATION_NOTES). Audio is built from the scripts in
// content/meditations/ by scripts/meditations.js and installed as HE-AAC.
//
// `group` places a meditation in the Meditate tab; GROUPS sets the order.
// `previewStart` is where the voice enters, past the opening bowl.
export const GROUPS = [
  { id: 'morning', label: 'Morning' },
  { id: 'anytime', label: 'Anytime' },
  { id: 'hard', label: 'Hard moments' },
  { id: 'perspective', label: 'Perspective' },
  { id: 'evening', label: 'Evening' },
];

export const MEDITATIONS = {
  'premeditatio': {
    id: 'premeditatio',
    title: 'Premeditatio Malorum',
    subtitle: 'Preparation',
    description: 'Look at what might go wrong before the day begins so it cannot surprise you.',
    time: 'Morning',
    duration: '8 min',
    group: 'morning',
    previewStart: 4,
    file: require('../assets/meditations/premeditatio-malorum.m4a'),
    image: require('../assets/meditations/img/premeditatio-malorum.jpg'),
  },
  'debts-of-book-one': {
    id: 'debts-of-book-one',
    title: 'The Debts of Book One',
    subtitle: 'Gratitude',
    description: 'Name who taught you what, the way Marcus opens the Meditations.',
    time: 'Morning',
    duration: '8 min',
    group: 'morning',
    previewStart: 4,
    file: require('../assets/meditations/debts-of-book-one.m4a'),
    image: require('../assets/meditations/img/debts-of-book-one.jpg'),
  },
  'present-moment': {
    id: 'present-moment',
    title: 'The Present Moment',
    subtitle: 'Attention',
    description: 'Pure attention training. Not staying. Returning.',
    time: 'Anytime',
    duration: '8 min',
    group: 'anytime',
    previewStart: 4,
    file: require('../assets/meditations/present-moment.m4a'),
    image: require('../assets/meditations/img/present-moment.jpg'),
  },
  'dichotomy-of-control': {
    id: 'dichotomy-of-control',
    title: 'The Dichotomy of Control',
    subtitle: 'Control',
    description: 'Sort what is yours to control from what is not, and set the rest down.',
    time: 'Anytime',
    duration: '8 min',
    group: 'anytime',
    previewStart: 4,
    file: require('../assets/meditations/dichotomy-of-control.m4a'),
    image: require('../assets/meditations/img/dichotomy-of-control.jpg'),
  },
  'inner-citadel': {
    id: 'inner-citadel',
    title: 'The Inner Citadel',
    subtitle: 'Retreat',
    description: 'A mid-day return to the quiet you carry with you.',
    time: 'Midday',
    duration: '8 min',
    group: 'anytime',
    previewStart: 4,
    file: require('../assets/meditations/inner-citadel.m4a'),
    image: require('../assets/meditations/img/inner-citadel.jpg'),
  },
  'view-from-above': {
    id: 'view-from-above',
    title: 'The View From Above',
    subtitle: 'Perspective',
    description: 'Rise above your circumstances to see them at their actual scale.',
    time: 'Anytime',
    duration: '9 min',
    group: 'anytime',
    previewStart: 4,
    file: require('../assets/meditations/view-from-above.m4a'),
    image: require('../assets/meditations/img/view-from-above.jpg'),
  },
  'before-you-react': {
    id: 'before-you-react',
    title: 'Before You React',
    subtitle: 'Anger',
    description: 'For the moment after something has gone wrong. Delay, then judge.',
    time: 'When needed',
    duration: '8 min',
    group: 'hard',
    previewStart: 4,
    file: require('../assets/meditations/before-you-react.m4a'),
    image: require('../assets/meditations/img/before-you-react.jpg'),
  },
  'what-frightens-us': {
    id: 'what-frightens-us',
    title: 'What Frightens Us',
    subtitle: 'Anxiety',
    description: 'We suffer more often in imagination than in reality.',
    time: 'When needed',
    duration: '8 min',
    group: 'hard',
    previewStart: 4,
    file: require('../assets/meditations/what-frightens-us.m4a'),
    image: require('../assets/meditations/img/what-frightens-us.jpg'),
  },
  'amor-fati': {
    id: 'amor-fati',
    title: 'Amor Fati',
    subtitle: 'Acceptance',
    description: 'Wish for things to happen as they actually do.',
    time: 'Anytime',
    duration: '8 min',
    group: 'hard',
    previewStart: 4,
    file: require('../assets/meditations/amor-fati.m4a'),
    image: require('../assets/meditations/img/amor-fati.jpg'),
  },
  'memento-mori': {
    id: 'memento-mori',
    title: 'Memento Mori',
    subtitle: 'Mortality',
    description: 'Remember that you will die. Not to grieve, but to live differently.',
    time: 'Anytime',
    duration: '8 min',
    group: 'perspective',
    previewStart: 4,
    file: require('../assets/meditations/memento-mori.m4a'),
    image: require('../assets/meditations/img/memento-mori.jpg'),
  },
  'negative-visualization': {
    id: 'negative-visualization',
    title: 'Negative Visualization',
    subtitle: 'Gratitude',
    description: 'Imagine the absence of what you love to see it clearly.',
    time: 'Anytime',
    duration: '8 min',
    group: 'perspective',
    previewStart: 4,
    file: require('../assets/meditations/negative-visualization.m4a'),
    image: require('../assets/meditations/img/negative-visualization.jpg'),
  },
  'river-of-time': {
    id: 'river-of-time',
    title: 'The River of Time',
    subtitle: 'Impermanence',
    description: 'Let what passes, pass. Stand well beside the river.',
    time: 'Anytime',
    duration: '8 min',
    group: 'perspective',
    previewStart: 4,
    file: require('../assets/meditations/river-of-time.m4a'),
    image: require('../assets/meditations/img/river-of-time.jpg'),
  },
  'circles-of-concern': {
    id: 'circles-of-concern',
    title: 'Circles of Concern',
    subtitle: 'Justice',
    description: 'Draw the circles of care inward, until they hold everyone.',
    time: 'Anytime',
    duration: '8 min',
    group: 'perspective',
    previewStart: 4,
    file: require('../assets/meditations/circles-of-concern.m4a'),
    image: require('../assets/meditations/img/circles-of-concern.jpg'),
  },
  'evening-examination': {
    id: 'evening-examination',
    title: 'The Evening Examination',
    subtitle: 'Accounting',
    description: 'Ask three honest questions and put the day down.',
    time: 'Evening',
    duration: '8 min',
    group: 'evening',
    previewStart: 4,
    file: require('../assets/meditations/evening-examination.m4a'),
    image: require('../assets/meditations/img/evening-examination.jpg'),
  },
  'before-sleep': {
    id: 'before-sleep',
    title: 'Before Sleep',
    subtitle: 'Rest',
    description: 'Set the day down, loosen the body, and rest. Made for listening in bed.',
    time: 'Bedtime',
    duration: '10 min',
    group: 'evening',
    previewStart: 6,
    file: require('../assets/meditations/before-sleep.m4a'),
    image: require('../assets/meditations/img/before-sleep.jpg'),
  },
};

export const MEDITATIONS_LIST = Object.values(MEDITATIONS);

// Module-level singleton state — survives screen mounts/unmounts so audio
// keeps playing as the user navigates between practice / journals / meditate.
let sound = null;
let currentMedId = null;
let isPlaying = false;
let isLoading = false;
let position = 0;
let duration = 0;
// Whether the full-screen player is up (components/FullMeditationPlayer.jsx).
// Collapsed, a loaded meditation shows in the mini player above the tabs.
let expanded = false;

// Practice-time accounting: count a meditation listen once per loaded session —
// when it completes (full duration), is closed (position reached), or is
// replaced by another meditation. sessionCounted guards against double-counting;
// a resumed/replayed session (no reload) is intentionally not re-counted.
let sessionCounted = false;
const LISTEN_MIN_MS = 30 * 1000;

function recordListen(ms) {
  if (sessionCounted) return;
  sessionCounted = true;
  // Analytics: audio is the most expensive content in the app to produce, so
  // record how far each meditation actually gets listened to. `completed` is
  // true when the file ran to its end (didJustFinish), false when the session
  // was closed or replaced partway. Fires regardless of LISTEN_MIN_MS —
  // abandons under 30s are exactly the signal worth seeing.
  if (currentMedId && Number.isFinite(ms)) {
    track('meditation_listened', {
      id: currentMedId,
      seconds: Math.round(ms / 1000),
      completed: duration > 0 && ms >= duration - 1500,
    });
  }
  if (Number.isFinite(ms) && ms >= LISTEN_MIN_MS) {
    addPracticeTime(ms);
    // Also log to Apple Health (gated on permission) as a mindful session of
    // the listened length ending now. Meditations were previously uncounted.
    writeMindfulSession(Date.now() - ms, Date.now());
  }
}

// Preview state — used by the onboarding meditations step. A preview is a
// short excerpt (PREVIEW_DURATION_MS) starting at med.previewStart so users
// can sample the narrator's voice past the singing-bowl intro.
let previewMedId = null;
let previewTimer = null;
const PREVIEW_DURATION_MS = 12000;

const listeners = new Set();
let audioModeReady = false;

function notify() {
  const snapshot = { currentMedId, isPlaying, isLoading, position, duration, previewMedId, expanded };
  listeners.forEach(fn => fn(snapshot));
  syncNowPlaying();
}

// Lock screen / Control Center (modules/now-playing). Pushed only when what
// it shows changes: the meditation, play/pause, or the duration arriving.
// iOS advances the elapsed time on its own while the rate is 1.
const artworkUris = {};
let nowPlayingKey = '';
function syncNowPlaying(force) {
  if (!NowPlaying) return;
  const med = currentMedId && MEDITATIONS[currentMedId];
  const key = med ? `${med.id}|${isPlaying}|${duration > 0}` : '';
  if (key === nowPlayingKey && !force) return;
  nowPlayingKey = key;
  if (!med) { NowPlaying.clear(); return; }
  if (artworkUris[med.id] === undefined) {
    artworkUris[med.id] = null;
    Asset.fromModule(med.image).downloadAsync()
      .then(a => { artworkUris[med.id] = a.localUri || null; syncNowPlaying(true); })
      .catch(() => {});
  }
  NowPlaying.update(med.title, 'Marcus', med.subtitle, artworkUris[med.id] || null,
    duration / 1000, position / 1000, isPlaying);
}

// The lock screen's buttons.
NowPlaying?.addListener?.('onRemoteCommand', ({ command, position: at }) => {
  const med = currentMedId && MEDITATIONS[currentMedId];
  if (!med) return;
  if (command === 'play') play(med);
  else if (command === 'pause') pause();
  else if (command === 'toggle') toggle(med);
  else if (command === 'forward') seek(15);
  else if (command === 'back') seek(-15);
  else if (command === 'seek') seekTo(at * 1000);
});

function onStatus(status) {
  if (!status.isLoaded) return;
  position = status.positionMillis || 0;
  duration = status.durationMillis || 0;
  // Mirror the OS's truth: a phone call, Siri, or another app seizing the
  // audio session pauses playback without any action of ours, and the UI
  // used to keep showing a pause icon over dead air (first tap then called
  // pause(), a no-op, so resuming took two taps). Skipped while loading so
  // the optimistic isPlaying=true during buffering doesn't flicker.
  if (!isLoading && typeof status.isPlaying === 'boolean') {
    isPlaying = status.isPlaying;
  }
  if (status.didJustFinish) {
    isPlaying = false;
    recordListen(duration);   // completed listen → count the full length
    position = 0;
    sound?.setPositionAsync(0).catch(() => {});
  }
  notify();
}

async function ensureAudioMode() {
  if (audioModeReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    // expo-av defaults to MixWithOthers, and iOS never gives a mixing app the
    // lock screen's Now Playing panel. A meditation should own the speaker.
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  });
  audioModeReady = true;
}

// Guards against rapid double-tap: if a load for the same id is already
// in flight, a second call is ignored; if a load for a different id comes
// in while one's in flight, the in-flight load's result is discarded.
let loadToken = 0;

async function loadAndPlay(med) {
  if (isLoading && currentMedId === med.id) return;
  recordListen(position);   // flush the outgoing session's listened time, if any
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  previewMedId = null;
  await ensureAudioMode();
  if (sound) {
    await sound.unloadAsync().catch(() => {});
    sound = null;
  }
  const myToken = ++loadToken;
  currentMedId = med.id;
  sessionCounted = false;   // fresh session for the newly loaded meditation
  isLoading = true;
  position = 0;
  duration = 0;
  notify();
  try {
    const { sound: newSound } = await Audio.Sound.createAsync(
      med.file,
      { shouldPlay: true },
      onStatus,
    );
    if (myToken !== loadToken) {
      // Another load superseded this one — discard.
      await newSound.unloadAsync().catch(() => {});
      return;
    }
    sound = newSound;
    isPlaying = true;
  } catch (e) {
    console.log('meditation audio error', e);
  } finally {
    if (myToken === loadToken) {
      isLoading = false;
      notify();
    }
  }
}

export async function play(med) {
  // Already loaded and just paused? Resume in place.
  if (sound && currentMedId === med.id) {
    await sound.playAsync().catch(() => {});
    isPlaying = true;
    notify();
    return;
  }
  await loadAndPlay(med);
}

export async function pause() {
  if (!sound) return;
  await sound.pauseAsync().catch(() => {});
  isPlaying = false;
  notify();
}

export async function toggle(med) {
  if (currentMedId !== med.id) {
    await loadAndPlay(med);
    return;
  }
  if (isPlaying) {
    await pause();
  } else {
    await play(med);
  }
}

// Open a meditation in the full-screen player, starting it unless it is
// already the one loaded (then it just comes back up, playing or paused).
export async function open(med) {
  expanded = true;
  notify();
  if (currentMedId !== med.id) await loadAndPlay(med);
}

export function expand() {
  if (!currentMedId) return;
  expanded = true;
  notify();
}

export function collapse() {
  expanded = false;
  notify();
}

export async function seekTo(ms) {
  if (!sound || duration <= 0) return;
  const newPos = Math.max(0, Math.min(duration, ms));
  position = newPos;
  notify();
  syncNowPlaying(true);
  await sound.setPositionAsync(newPos).catch(() => {});
}

export async function seek(deltaSeconds) {
  if (!sound || duration <= 0) return;
  const newPos = Math.max(0, Math.min(duration, position + deltaSeconds * 1000));
  await sound.setPositionAsync(newPos).catch(() => {});
  position = newPos;
  notify();
  syncNowPlaying(true);
}

export async function unload() {
  expanded = false;
  if (!sound) { currentMedId = null; notify(); return; }
  recordListen(position);   // explicit close (mini-player X) → count what was heard
  await sound.unloadAsync().catch(() => {});
  sound = null;
  currentMedId = null;
  isPlaying = false;
  isLoading = false;
  position = 0;
  duration = 0;
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  previewMedId = null;
  notify();
}

// Preview: play a 12-second excerpt starting at med.previewStart. Tapping
// the same meditation again toggles it off. Tapping a different one
// supersedes. Auto-stops when the timer fires. Deliberately does NOT touch
// currentMedId / isPlaying — those drive the floating MiniMeditationPlayer,
// and we don't want that surfacing during a 12-second onboarding sample.
export async function playPreview(med) {
  if (previewMedId === med.id) {
    await stopPreview();
    return;
  }
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  // If a real meditation was playing, kill it — preview takes the speaker.
  if (sound) {
    await sound.unloadAsync().catch(() => {});
    sound = null;
  }
  currentMedId = null;
  isPlaying = false;
  await ensureAudioMode();

  const myToken = ++loadToken;
  previewMedId = med.id;
  isLoading = true;
  notify();

  try {
    const startMs = (med.previewStart || 60) * 1000;
    const { sound: newSound } = await Audio.Sound.createAsync(
      med.file,
      { shouldPlay: true, positionMillis: startMs },
      // No status callback — we don't want preview position bleeding into
      // the shared position/duration state that the mini player reads.
    );
    if (myToken !== loadToken) {
      await newSound.unloadAsync().catch(() => {});
      return;
    }
    sound = newSound;
    isLoading = false;
    notify();

    previewTimer = setTimeout(() => {
      stopPreview().catch(() => {});
    }, PREVIEW_DURATION_MS);
  } catch (e) {
    console.log('meditation preview error', e);
    isLoading = false;
    previewMedId = null;
    notify();
  }
}

export async function stopPreview() {
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  if (sound) {
    await sound.unloadAsync().catch(() => {});
    sound = null;
  }
  previewMedId = null;
  isLoading = false;
  notify();
}

export function getState() {
  return { currentMedId, isPlaying, isLoading, position, duration, previewMedId, expanded };
}

export function useMeditationPlayer() {
  const [state, setState] = useState(getState);
  useEffect(() => {
    listeners.add(setState);
    return () => listeners.delete(setState);
  }, []);
  return state;
}

export function formatMedTime(ms) {
  if (!ms) return '0:00';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
