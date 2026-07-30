# Dispatch draft: the review ask

**Not published.** This lives here deliberately, outside `public/`, so it cannot be
served or accidentally go live. `lib/dispatches.js` gates only on `minVersion` /
`maxVersion` and never on date, so anything added to `public/dispatches.json` is
live the moment `main` deploys. A review ask on launch day is too early.

## When to publish

Once **1.2.0 has been live for a week or two**, so the people who see it have had
time with the new work (7th meditation, the mid-day pause, the journal changes)
and the passive `SKStoreReviewController` prompt has already had its shot at the
users who sealed three days.

Do not stack this against the `midday-pause-2026-07` dispatch. Let that one clear
first; two asks in the same week reads as noise in an inbox whose whole promise is
"no noise".

## How to publish

1. Paste the object below into the `dispatches` array in `public/dispatches.json`.
2. Set `date` to the actual publish date.
3. Merge to `main`. Vercel deploys, the app picks it up on next foreground.
4. Watch the `rate_tapped` event in Aptabase to see whether it converted.

To pull it back: delete the object and redeploy. Anyone who already read it has it
marked read locally, so it will not reappear for them.

## The dispatch

```json
{
  "id": "rate-ask-2026-08",
  "date": "2026-08-DD",
  "type": "notice",
  "minVersion": "1.2.0",
  "title": "A small ask",
  "body": "Marcus is built by one person, with no marketing behind it. The App Store is where it lives or does not: people find the practice mostly because other people said something about it.\n\nIf it has earned a place in your day, rating it takes under a minute and genuinely helps.\n\nIf something is broken or missing instead, Contact support in Settings reaches me directly, and that is more useful to me than a star.\n\nEither way, thank you for practicing.",
  "cta": { "label": "Rate Marcus", "url": "https://apps.apple.com/app/id6789749038?action=write-review" }
}
```

## Why the copy reads this way

- **No "leave 5 stars", no "if you love Marcus".** Soliciting specifically
  positive ratings breaks App Store guideline 1.1.7 and is a rejection risk. The
  ask is neutral, which is also what keeps it honest.
- **Solo-developer framing is true and it is the persuasive part.** It gives a
  real reason the rating matters rather than asserting that it does.
- **Problems are routed to support, not to the store.** With a small review count
  a single frustrated one-star is disproportionate, and a bug report reaches you
  where you can actually fix it. This is not filtering: anyone can still review.
- **It closes on thanks, not on the ask**, which matches the register everywhere
  else in the app.
