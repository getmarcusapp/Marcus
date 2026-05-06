import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';

// Imagery: public-domain classical art, one per meditation, mapped to theme.
// Cropped/overlaid in the components for visual cohesion.
//   View From Above    -> Caspar David Friedrich, "Wanderer above the Sea of Fog" (1818)
//   Premeditatio       -> Bust of Marcus Aurelius (Capitoline Museums)
//   Evening Examination-> Caravaggio, "Saint Jerome Writing" (1605-6)
//   Negative Visualization -> Philippe de Champaigne, "Vanitas (Still Life with a Skull)" (1671)
//   Present Moment     -> Francisco de Zurbarán, "Cup of Water and a Rose" (c. 1630)
export const MEDITATIONS = {
  'view-from-above': {
    id: 'view-from-above',
    title: 'The View From Above',
    subtitle: 'Perspective',
    description: 'Rise above your circumstances to see them at their actual scale.',
    time: 'Anytime',
    duration: '5 min',
    file: require('../assets/meditations/view-from-above.mp3'),
    image: require('../assets/meditations/img/view-from-above.jpg'),
  },
  'premeditatio': {
    id: 'premeditatio',
    title: 'Premeditatio Malorum',
    subtitle: 'Preparation',
    description: 'Look at what might go wrong before the day begins so it cannot surprise you.',
    time: 'Morning',
    duration: '5 min',
    file: require('../assets/meditations/premeditatio-malorum.mp3'),
    image: require('../assets/meditations/img/premeditatio-malorum.jpg'),
  },
  'evening-examination': {
    id: 'evening-examination',
    title: 'The Evening Examination',
    subtitle: 'Accounting',
    description: 'Ask three honest questions and put the day down.',
    time: 'Evening',
    duration: '5 min',
    file: require('../assets/meditations/evening-examination.mp3'),
    image: require('../assets/meditations/img/evening-examination.jpg'),
  },
  'negative-visualization': {
    id: 'negative-visualization',
    title: 'Negative Visualization',
    subtitle: 'Gratitude',
    description: 'Imagine the absence of what you love to see it clearly.',
    time: 'Anytime',
    duration: '5 min',
    file: require('../assets/meditations/negative-visualization.mp3'),
    image: require('../assets/meditations/img/negative-visualization.jpg'),
  },
  'present-moment': {
    id: 'present-moment',
    title: 'The Present Moment',
    subtitle: 'Attention',
    description: 'Pure attention training. Not staying. Returning.',
    time: 'Anytime',
    duration: '5 min',
    file: require('../assets/meditations/present-moment.mp3'),
    image: require('../assets/meditations/img/present-moment.jpg'),
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

const listeners = new Set();
let audioModeReady = false;

function notify() {
  const snapshot = { currentMedId, isPlaying, isLoading, position, duration };
  listeners.forEach(fn => fn(snapshot));
}

function onStatus(status) {
  if (!status.isLoaded) return;
  position = status.positionMillis || 0;
  duration = status.durationMillis || 0;
  if (status.didJustFinish) {
    isPlaying = false;
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
  });
  audioModeReady = true;
}

// Guards against rapid double-tap: if a load for the same id is already
// in flight, a second call is ignored; if a load for a different id comes
// in while one's in flight, the in-flight load's result is discarded.
let loadToken = 0;

async function loadAndPlay(med) {
  if (isLoading && currentMedId === med.id) return;
  await ensureAudioMode();
  if (sound) {
    await sound.unloadAsync().catch(() => {});
    sound = null;
  }
  const myToken = ++loadToken;
  currentMedId = med.id;
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

export async function seek(deltaSeconds) {
  if (!sound || duration <= 0) return;
  const newPos = Math.max(0, Math.min(duration, position + deltaSeconds * 1000));
  await sound.setPositionAsync(newPos).catch(() => {});
  position = newPos;
  notify();
}

export async function unload() {
  if (!sound) return;
  await sound.unloadAsync().catch(() => {});
  sound = null;
  currentMedId = null;
  isPlaying = false;
  isLoading = false;
  position = 0;
  duration = 0;
  notify();
}

export function getState() {
  return { currentMedId, isPlaying, isLoading, position, duration };
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
