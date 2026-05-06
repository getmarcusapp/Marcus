import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';

export const MEDITATIONS = {
  'view-from-above': {
    id: 'view-from-above',
    title: 'The View From Above',
    subtitle: 'Perspective',
    description: 'Rise above your circumstances to see them at their actual scale.',
    time: 'Anytime',
    duration: '5 min',
    file: require('../assets/meditations/view-from-above.mp3'),
  },
  'premeditatio': {
    id: 'premeditatio',
    title: 'Premeditatio Malorum',
    subtitle: 'Preparation',
    description: 'Look at what might go wrong before the day begins so it cannot surprise you.',
    time: 'Morning',
    duration: '5 min',
    file: require('../assets/meditations/premeditatio-malorum.mp3'),
  },
  'evening-examination': {
    id: 'evening-examination',
    title: 'The Evening Examination',
    subtitle: 'Accounting',
    description: 'Ask three honest questions and put the day down.',
    time: 'Evening',
    duration: '5 min',
    file: require('../assets/meditations/evening-examination.mp3'),
  },
  'negative-visualization': {
    id: 'negative-visualization',
    title: 'Negative Visualization',
    subtitle: 'Gratitude',
    description: 'Imagine the absence of what you love to see it clearly.',
    time: 'Anytime',
    duration: '5 min',
    file: require('../assets/meditations/negative-visualization.mp3'),
  },
  'present-moment': {
    id: 'present-moment',
    title: 'The Present Moment',
    subtitle: 'Attention',
    description: 'Pure attention training. Not staying. Returning.',
    time: 'Anytime',
    duration: '5 min',
    file: require('../assets/meditations/present-moment.mp3'),
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

async function loadAndPlay(med) {
  await ensureAudioMode();
  if (sound) {
    await sound.unloadAsync().catch(() => {});
    sound = null;
  }
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
    sound = newSound;
    isPlaying = true;
  } catch (e) {
    console.log('meditation audio error', e);
  } finally {
    isLoading = false;
    notify();
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
