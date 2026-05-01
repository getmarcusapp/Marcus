import { getCompassDone, getTodayReading, getTodayJournal } from './db';

const STEPS = {
  compass: { label: 'Compass', href: '/compass' },
  reading: { label: 'Daily reading', href: '/read' },
  morning: { label: 'Morning journal', href: { pathname: '/journal', params: { type: 'morning' } } },
};

// Returns the next undone step in the morning routine flow after `completed`,
// or null if nothing should be suggested. Evening is intentionally never
// suggested — winding-down feel.
export async function getNextPracticeAfter(completed) {
  const compassDone = !!(await getCompassDone());
  const readingDone = !!(await getTodayReading());
  const morningDone = !!(await getTodayJournal('morning'));

  const status = { compass: compassDone, reading: readingDone, morning: morningDone };
  const order = ['compass', 'reading', 'morning'];
  const startIdx = completed ? order.indexOf(completed) + 1 : 0;

  for (let i = startIdx; i < order.length; i++) {
    if (!status[order[i]]) return STEPS[order[i]];
  }
  return null;
}
