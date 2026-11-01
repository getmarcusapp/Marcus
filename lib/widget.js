// Feeds the home-screen and lock-screen widget (targets/widget).
//
// The widget cannot run JavaScript, so the app writes the next fourteen days
// of quotes into the shared App Group and the widget changes at midnight on
// its own. Called whenever the app comes to the foreground, so the window is
// topped up as long as the app is opened once a fortnight.
//
// The native module exists only in builds that include the widget target, so
// it is required lazily and every failure is swallowed: a missing widget must
// never take the app down.
import { morningQuotes, getQuoteForDate } from '../constants/quotes';

const APP_GROUP = 'group.com.harvana.marcus';
const KEY = 'widgetQuotes';
const DAYS = 14;

const dayKey = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function syncWidget() {
  try {
    const { ExtensionStorage } = require('@bacons/apple-targets');
    const storage = new ExtensionStorage(APP_GROUP);
    const today = new Date();
    const items = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const q = getQuoteForDate(morningQuotes, d);
      items.push({ date: dayKey(d), text: q.text, author: q.author, ref: q.ref || q.source || '' });
    }
    storage.set(KEY, items);
    ExtensionStorage.reloadWidget();
  } catch {
    // Older build without the widget, or not iOS.
  }
}
