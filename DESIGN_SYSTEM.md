# Marcus — Design System Reference

A working reference for the app's look-and-feel: tokens, typography, buttons, input fields, cards, heroes, and the conversion notes between Valeriya's Figma library and iOS.

Source of truth for tokens: `constants/theme.js`.

---

## 1. Tokens

### Colors

**Backgrounds (unified near-black canvas per Valeriya):**
- `bg` / `bgDeep` / `bgCard` / `bgElevated` — all `#0a0a0a`. Token names kept distinct so per-surface tweaks remain possible.

**Borders (dark-to-light scale, used for hierarchy without fills):**
- `border` — `#1e1e1e`
- `borderMid` — `#2a2a2a`
- `borderStrong` — `#363636`
- `borderBright` — `#444444`

**Input fields (per Valeriya's library — slight elevation + bright stroke):**
- `inputBg` — `#1A1A1A` (one step above screen `#0a0a0a`)
- `inputBorder` — `#474747` (non-active stroke)
- `inputBorderActive` — `#878787` (active / focused stroke)

**Text:**
- `textPrimary` — `#F0F0F0` (active body / hero)
- `textSecondary` — `#C8C8C8` (body / typed answers when stored)
- `textMuted` — `#A0A0A0` (non-focused input text, sub-labels)
- `textDim` — `#707070` (eyebrows, placeholders, micro labels)
- `textGhost` — `#2a2a2a` (rarely used)

**Accent (Stoic gold):**
- `accent` — `#C8A97A` (primary action, links, key affordances)
- `accentDim` — `#8a7254` (subtle accent)
- `accentBg` — `#1a1610` (tinted backgrounds for accent surfaces)

**Light zone (cards / writing surfaces with light fill, used sparingly):**
- `lightBg` `#F7F5F2`, `lightBg2` `#EFECEA`, `lightBg3` `#E8E5E1`
- `lightWhite` `#FFFFFF`
- `lightBorder` `#DDDAD6`, `lightBorder2` `#CCCAC6`
- `lightText` `#1A1A1A`, `lightText2` `#3A3A3A`
- `lightMuted` `#6A6A6A`, `lightDim` `#9A9A9A`

**Semantic:**
- `virtueGood` `#6a9a6a`, `virtueBad` `#9a6a4a`
- `successBg` `#0a140a`, `successBorder` `#3a5a3a`

### Typography (`font`)

| Token | Size | Use |
|---|---|---|
| `heroSize` | 36 | Largest heroes (rare; titles are typically `titleSize`) |
| `titleSize` | 28 | Page hero titles (compass, journal, emotions, review, read, meditate) |
| `bodySize` | 17 | Body prose (compass body, reflection text in read.jsx) |
| `subSize` | 15 | Sub-titles, hero captions |
| `labelSize` | 11 | Section eyebrows, labels |
| `microSize` | 10 | Tiniest tracked uppercase labels |
| `sectionTracking` | 1.8 | Letter-spacing for uppercase section labels |
| `serif` | `Georgia` | Serif family for quotes + Stoic body passages |

### Radii

| Token | Value | Use |
|---|---|---|
| `radius.sm` | 8 | Small accents (vpills, distortion subtleties) |
| `radius.md` | 12 | H56 primary buttons, input fields, navPills |
| `radius.lg` | 16 | Cards (prompt cards, fieldCards, reframeCard, insightCard) |
| `radius.xl` | 20 | Reserved |
| `radius.pill` | 100 | Old pill buttons (mostly retired) |

Hand-tuned radii outside the token set (intentional, distinct affordances):
- **EDIT chips** — `6` (square button look)
- **NEXT/TODAY tags** — `5` (very square)
- **Role suggestion pills** — `20` (full pill)
- **Filter pills** (archives) — `18`

### Spacing

| Token | Value |
|---|---|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 16 |
| `lg` | 20 |
| `xl` | 24 |
| `xxl` | 32 |

---

## 2. Typography hierarchy

**Hero title** (page heroes): `fontSize: titleSize (28)`, `fontWeight: '300'`, `color: textPrimary`, `letterSpacing: -0.5`, `lineHeight: 36`, with subtle `textShadowColor: 'rgba(0,0,0,0.7)'` for legibility over images.

**Eyebrow** (uppercase tag above title): `fontSize: labelSize (11)`, `letterSpacing: sectionTracking (1.8)`, `color: accent`, `textTransform: 'uppercase'`, `marginBottom: 8`.

**Sub** (caption under hero): `fontSize: subSize (15)`, `color: textMuted`.

**Section label** (e.g., `III · Reframe`): `fontSize: 11`, `letterSpacing: 3`, `color: accentDim`, `textTransform: 'uppercase'`, `marginTop: 36`, `marginBottom: 14`.

**Body prose** (compass body, reading reflection): `fontSize: 17`, `color: textSecondary`, `lineHeight: 28`. Sans-serif. Serif reserved for ancient quotes only.

**Quotes / Stoic passages**: `fontFamily: font.serif (Georgia)`, `fontSize: 19`, `color: textPrimary`, `lineHeight: 32`.

**Hero headlines never end with a period.** Removed app-wide.

---

## 3. Buttons

**Two-tier system on iPhone**, derived from Valeriya's Figma library scaled by 1/1.5 (her artboard is 591pt wide vs iPhone's ~393pt). See [Figma → iOS conversion](#7-figma--ios-conversion).

### H56 — primary, no-keyboard

Used for hero CTAs, in-body primary actions, onboarding `Continue`-style buttons.

**Filled-gold variant** (primary commit action):
- `height: 56`
- `borderRadius: radius.md (12)`
- `backgroundColor: accent`
- `text: #1a1a1a` (dark on gold), `fontSize: 14–15`, `fontWeight: '500'`, `letterSpacing: 0.3`
- `paddingHorizontal: 16`, `alignItems / justifyContent: center`

**Outlined-gold variant** (secondary):
- Same dimensions
- `backgroundColor: bg`
- `borderWidth: 1`, `borderColor: accent`
- `text: accent`

**Files using H56 in-body / hero:**
- `journal.jsx` (Complete morning journal)
- `emotions.jsx` (Log this trigger)
- `review.jsx` (Seal this week)
- `read.jsx` (Generate new reading)
- `settings-notifications.jsx` (Save & schedule notifications)
- `onboarding.jsx` (Continue, Use these to start, Set reminders, Maybe later)
- `paywall.jsx` (Start 7-day free trial)
- `ready.jsx` primary CTA
- `JournalEntryEditor` Cancel/Save pair

### H44 — keyboard accessory

Used in every `InputAccessoryView` keyboard bar. Apple's 44pt touch target minimum, rounded up from Valeriya's H56 ÷ 1.5 = 37pt.

- `flex: 1`, `height: 44`
- Same outlined/filled variants as H56
- Side-by-side in pairs (Cancel + Save, Done + Next prompt, etc.) inside `accessoryBarPair` container:
  - `flexDirection: 'row'`, `gap: 10`
  - `paddingHorizontal: 16`, `paddingVertical: 8`
  - `backgroundColor: bg`, `borderTopWidth: 0.5`, `borderTopColor: border`

All accessory bar text has `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.8}` for small-screen safety.

### EDIT chip — small inline affordance

Used wherever a small "edit" or "delete" affordance is needed inline.

- `flexDirection: 'row'`, `alignItems: 'center'`, `gap: 4`
- `borderWidth: 1`, `borderColor: accent`
- `borderRadius: 6` (square button look, distinct from tags + buttons)
- `paddingHorizontal: 10`, `paddingVertical: 5`
- Label: `fontSize: 10–12`, `color: accent`, `letterSpacing: 0.3`
- Glyph: Ionicons `create-outline` / `trash-outline` / `checkmark` at `size: 12`

**Locations:**
- `onboarding.jsx` — `compassPreviewEdit` (compass preview + reminder rows)
- `compass.jsx` — `roleDeleteChip`
- `journal-history.jsx` — `editBtn`
- `emotions-history.jsx` — `histEditBtn`

### Tab pills (compass Why/Overcome/Aspire/Roles)

- `flex: 1`, `paddingVertical: 10`, `paddingHorizontal: 8`
- `borderWidth: 1`, `borderColor: accent`, `borderRadius: radius.md (12)`
- Active: `backgroundColor: accent`, text turns `#1a1a1a`
- Inactive: `backgroundColor: bg`, text `accent`
- Label: `fontSize: 11`, `letterSpacing: 0.5`, `textTransform: 'uppercase'`
- Text uses `numberOfLines={1} + adjustsFontSizeToFit` so long labels (OVERCOME) fit on small screens

### NEXT / TODAY tags

Small uppercase status tags inside practice tiles.

- `borderWidth: 0.5`, `borderColor: border`
- `borderRadius: 5` (very square)
- `paddingHorizontal: 10`, `paddingVertical: 4`
- Text: `fontSize: 10`, `color: accent`, `letterSpacing: 1.4`, `textTransform: 'uppercase'`

---

## 4. Input fields

All input fields share a **two-state visual pattern** per Valeriya's library:

| State | Stroke | Body text |
|---|---|---|
| **Non-active** | `inputBorder` (`#474747`) | `textMuted` (grey) |
| **Active** (focused) | `inputBorderActive` (`#878787`) | `textPrimary` (white) |

**Background:** `inputBg` (`#1A1A1A`) — one step above screen black for subtle elevation. The outline carries hierarchy; the bg gives a hint of layering without competing fills.

**Label / question text** stays white (`textPrimary`) in both states.

**Implementations:**
- `journal.jsx` / `review.jsx` — prompt cards use the existing `openPrompt` state to indicate active
- `emotions.jsx` — `focusedField` state tracks which field is active (trigger / reaction / response)
- `compass.jsx` — `focusedField` tracks which input is active (edit / roleName / roleCommitment)
- `read.jsx` — `insightFocused` for the insight card
- `onboarding.jsx` — `compassInput` toggles `compassInputFocused` overlay

---

## 5. Cards

### Practice tile (routine row)

The numbered daily/weekly tiles on the Practice screen.

- Wrapped in `routineCard` container (`borderWidth: 0.5`, `borderColor: border`, `borderRadius: radius.lg`)
- Each row: `flexDirection: 'row'`, gap between dot / content / tag
- Status dot: 18pt circle, `bgCard` border or filled `accent` when done with checkmark glyph
- Title: `fontSize: 17`, `fontWeight: '500'`, `color: textPrimary`
- Sub: `fontSize: 13`, `color: textMuted`
- Done state: title turns `textMuted`, no NEXT tag

### Prompt card (journal, review)

- `borderWidth: 0.5`, `borderColor: border` (non-active) / `borderBright` (active)
- `borderRadius: radius.lg`
- `padding: 20`, `marginBottom: 10`
- `backgroundColor: bg` (matches screen — outline-only treatment)

### Field card (emotions)

Same shape as prompt card, used for trigger / reaction / response inputs. Active variant brightens the stroke.

### Reframe card (emotions, dynamic emotion color)

Inside the III · Reframe section, this card takes on the selected emotion's color (border + tint) and contains the reframe text + distortion grid + response input.

### Archive entry row (journal-history, emotions-history)

- `padding: 18`, `borderBottomWidth: 0.5`, `borderBottomColor: border`
- `backgroundColor: bgCard`
- Top row: date + emotion/virtue subtitle on left, EDIT chip top-right
- Identical geometry across journal-history and emotions-history

---

## 6. Page heroes

Each main screen has a hero image header with a title at the bottom.

**Container:**
- `minHeight: 280`
- `borderBottomWidth: 0.5`, `borderBottomColor: border`
- `overflow: 'hidden'`, `justifyContent: 'flex-end'`

**Image:** `StyleSheet.absoluteFillObject`, `resizeMode: 'cover'`.

**Gradient scrim** (compressed to bottom — top 55% transparent):

```js
<LinearGradient
  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
  locations={[0, 0.55, 0.8, 1]}
  style={StyleSheet.absoluteFillObject}
/>
```

Applied uniformly across compass, journal, review, read, emotions, meditate page heroes.

**Hero content:** `padding: spacing.xl`, `paddingTop: 52`, with title at bottom (or eyebrow + title + sub stacked).

---

## 7. Figma → iOS conversion

Valeriya's Figma artboard is **591pt wide** vs iPhone's typical ~393pt. To preserve her visual proportions on iPhone, divide Figma values by **1.5**.

| Valeriya's label | Figma px | iOS target | Used for |
|---|---|---|---|
| H56 small | 56 | **44** (Apple touch minimum) | Keyboard accessory pairs |
| H80 medium | 80 | **56** | All primary CTAs (hero + in-body) |

For details on why: she designs on a 1.5x artboard. Same logic applies to any future spec values from her library — divide by 1.5 to get the iOS-pt value.

---

## 8. Special components

### `PracticeHeader` (components/PracticeHeader.jsx)

Sticky header on the daily practice flow screens (compass, reading, journal). Always 4 segments (I–IV) — Weekly Review is a separate flow with its own chrome.

- Title row: ‹ arrow + Roman + current title + › arrow
- Segments row below: 4 hairlines, lit/dim based on position

### `ScreenHeader` (components/ScreenHeader.jsx)

Used on all non-practice-flow screens (settings, archives, weekly review). Renders a `‹ Back` text-link in a thin top bar.

### Tab bar (`_layout.jsx`)

Three logical tabs: Practice · Emotions · More.

- `height: 84`, `paddingBottom: 24`, `paddingTop: 10`
- `backgroundColor: '#080808'`, `borderTopColor: border`
- Icons: Ionicons `flame-outline` / `heart-outline` / `menu-outline` (menu is `size: 26`; the others are `size: 22` — menu's three thin bars read smaller at the same size)
- Labels: `fontSize: 9`, `letterSpacing: 1.4`, `textTransform: 'uppercase'`, `marginTop: 3`
- Active = `accent`, inactive = `textDim`

### Logical tab highlighting

`_layout.jsx` defines `PRACTICE_ROUTES` and `EMOTIONS_ROUTES` sets. `useLogicalTabKey()` reads `usePathname()` and maps hidden routes (compass, journal, etc.) back to the parent tab so the right icon stays illuminated as the user navigates flow screens.

---

## 9. Conventions

- **No periods on hero headlines** — Valeriya's rule, applied across all `title` / `stepTitle` / `previewTitle` / `heroTitle` / `sealedRestTitle` sites.
- **Avoid em-dashes** — prefer commas / colons / periods in body copy.
- **Scroll-to-top on focus** — every screen resets to top via `useFocusEffect` on tab/route re-entry.
- **No iOS scroll indicators** — `showsVerticalScrollIndicator={false}` everywhere.
- **Touch target floor** — 44pt minimum (per Apple HIG); buttons round up if math says lower.

---

## 10. File map

Where each layer lives:

| Concern | File |
|---|---|
| Color / font / radius / spacing tokens | `constants/theme.js` |
| Tab nav + logical tab highlighting | `app/_layout.jsx` |
| Practice flow chrome | `components/PracticeHeader.jsx` |
| Non-practice screen chrome | `components/ScreenHeader.jsx` |
| Shared journal editor | `components/JournalEntryEditor.jsx` |
| Mini meditation player | `components/MiniMeditationPlayer.jsx` |
| Per-screen styles | inline `StyleSheet.create(...)` at the bottom of each `app/*.jsx` |

Per-screen `StyleSheet` blocks are the operational layer — most visual changes happen there. The theme tokens are the canon.
