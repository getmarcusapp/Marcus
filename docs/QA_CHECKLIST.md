# Marcus — Pre-Build QA Checklist

Run on a real device before every TestFlight/App Store build. ~45–60 min.
The value is in the **intersections** (flow × state), not the happy paths.
Check items off; anything that fails gets a note and blocks the build until
triaged.

**Build under test:** ______  **Device:** ______  **Date:** ______

---

## 0 · Device states to prepare

- [ ] **State A — Fresh install**: delete the app, reinstall (first-run experience)
- [ ] **State B — Mid-practice**: existing data, today partially complete
- [ ] **State C — Settings extremes**: max Dynamic Type (Settings → Accessibility → Display & Text Size), Reduce Motion ON
- [ ] **State D — Denied everything**: notifications denied, Health denied

---

## 1 · Cold start & splash

- [ ] Cold launch: black native splash → gold skull/wordmark float-up → gradient bloom → dissolve to Home. No logo "pop," no white flash
- [ ] During the splash, tap the screen repeatedly — nothing underneath reacts
- [ ] Reduce Motion ON (State C): splash fades without float/zoom
- [ ] With App Lock enabled: lock screen appears immediately, FaceID prompts once, app switcher shows the skull cover (not journal text) when backgrounded

## 2 · Onboarding (State A)

- [ ] Welcome video plays and **loops** seamlessly (watch two full cycles)
- [ ] Reduce Motion ON: static gradient instead of video
- [ ] Back works from every step; no dead ends
- [ ] Reminders step: edit a time, then DENY the iOS prompt → alert says times are saved; continue lands on paywall
- [ ] Kill the app mid-onboarding → relaunch restarts onboarding cleanly
- [ ] "Restore from backup" → cancel → still on welcome, nothing broken

## 3 · Paywall

- [ ] Both plan cards show real store prices (no $0.00, no blank)
- [ ] Airplane mode → paywall shows "couldn't reach the App Store" retry state, NOT fake prices
- [ ] Terms of Use + Privacy Policy links open
- [ ] Restore purchases offline → says "couldn't reach," not "no subscription found"
- [ ] "Continue without trial" → lands in app; journal/emotions inputs show trial CTA placeholder and push to paywall on tap

## 4 · The daily loop (State B)

- [ ] Practice screen: correct date, Day N, done-states accurate
- [ ] Complete practices OUT OF ORDER (evening journal before reading) → streak still credits the day (More → stats)
- [ ] Complete all four → seal moment: haptic triple-beat, sealed screen, correct Day N
- [ ] Reopen app next morning (or after midnight): fresh day, NOT yesterday's sealed screen
- [ ] **Foundations row**: shows today's letter with TODAY tag → read it → row flips to checkmark + "Letter N arrives tomorrow" → letter re-opens on tap
- [ ] More → The Foundations: locked letters show "Arrives on day N" and don't open

## 5 · Writing surfaces — the keyboard gauntlet

Run on EVERY writing surface: morning journal, evening journal (incl. the
Reckoning step), weekly review (text prompts + Account + Commit), emotions
logger (all three fields), reading insight, compass editor, archive editors.

- [ ] Open the ⓘ hint, then tap the input → hint closes, input visible above keyboard
- [ ] Type a very long answer (10+ lines) → caret stays visible while typing
- [ ] Keyboard accessory buttons (Save/Cancel/steps) visible and tappable above keyboard
- [ ] Dismiss keyboard by dragging → can still save (visible button somewhere)
- [ ] Background the app mid-sentence → return → text still there
- [ ] Tab away mid-wizard → return → answers intact, same step

## 6 · The Reckoning (evening journal)

- [ ] Morning journal with III · Name answered → evening journal says "5 steps" and step one is **I · Morning** with your words quoted
- [ ] Subsequent steps read II · Examine … V · Gratitude
- [ ] No morning entry → evening says "4 steps," starts at I · Examine
- [ ] Reckoning ⓘ opens the Seneca info card
- [ ] Save with only the reckoning answered → entry saves; Past Entries shows "This morning · 'your words' · your answer" at top

## 7 · Emotions logger

- [ ] Log a trigger end-to-end; double-tap the log button rapidly → only ONE entry in history
- [ ] Free user (State A post-decline): fields show CTA placeholder, tap → paywall

## 8 · Audio

- [ ] Play a meditation → lock the screen → **audio keeps playing** (this broke once; native config)
- [ ] Mini-player follows across tabs; play a second meditation → first stops cleanly
- [ ] Background the app mid-meditation → return → position correct

## 9 · Notifications (State B, then State D)

- [ ] With reminders set: complete a practice before its reminder time → no reminder fires for it today (re-check next day it DOES fire)
- [ ] Settings → Notifications: banner reflects real permission state on open
- [ ] State D (denied): saving settings says "saved, enable in iOS Settings" and keeps your times

## 10 · Accessibility & sizes (State C)

- [ ] Max Dynamic Type: paywall, practice screen, journal landing — no clipped CTAs, nothing unreadable
- [ ] Reduce Motion: splash + welcome video both honor it
- [ ] Smallest device you have (or simulator iPhone SE): welcome screen, paywall, wizard — nothing below the fold that must be reachable

## 11 · Sharing & archives

- [ ] Share a reading → image card renders full quote (no mid-sentence ellipsis), attribution correct, no doubled "WORK · WORK"
- [ ] Past entries (journal/review/emotions/readings): dates formatted, edit → keyboard gauntlet basics, save persists
- [ ] Edit past review distortion pills only (no keyboard) → Save button reachable

## 12 · Money paths (sandbox)

- [ ] Start trial in sandbox → success routes to welcome/ready; Practice shows trial countdown pill
- [ ] More → Subscription shows correct state copy
- [ ] Dev Tools NOT visible in Settings (7 taps + PIN gate works; `marcus://settings-developer` in Safari bounces to Settings)

## 13 · Chaos pass (5 minutes, no checklist)

Tap fast. Rotate through tabs mid-animation. Background mid-everything.
Pull down on screens. Tap things twice. Open every ⓘ. Try to break it.
Note anything that felt wrong even if it recovered.

---

*Update this file when flows change. A checklist that drifts from the app
is worse than none — it certifies the wrong thing.*
