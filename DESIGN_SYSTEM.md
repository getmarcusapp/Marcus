# Marcus — Design System Reference

A working reference for the app's look-and-feel after the Valeriya brand pass: tokens, typography, the GoldButton system, page heroes, input fields, cards, empty states, and the Figma → iOS conversion notes.

Source of truth for tokens: `constants/theme.js`.
Source of truth for the gradient-button system: `components/GoldButton.jsx`.

---

## 1. Tokens

### Colors

**Backgrounds** (unified near-black canvas per Valeriya):
- `bg` / `bgDeep` / `bgCard` / `bgElevated` — all `#0a0a0a`. Token names kept distinct so per-surface tweaks remain possible.

**Borders** (subtle hierarchy without competing fills):
- `border` — `#252525` (bumped from `#1e1e1e` so card edges read in bright light)
- `borderMid` — `#2a2a2a`
- `borderStrong` — `#363636`
- `borderBright` — `#444444`

**Input fields:**
- `inputBg` — `#121212` (one step above screen black, subtle elevation)
- `inputBorder` — `#474747` (non-active stroke)
- `inputBorderActive` — `#878787` (focused stroke)

**Text:**
- `textPrimary` — `#F0F0F0`
- `textSecondary` — `#C8C8C8`
- `textMuted` — `#A0A0A0`
- `textDim` — `#707070`
- `textGhost` — `#2a2a2a`

**Accent (the brand gold):**
- `accent` — `#FFCE82` (Valeriya's strategy-doc gold; bright, warm, luminous)
- `accentDim` — `#B38B5B`
- `accentBg` — `#1a1610` (tinted bg for accent surfaces)

**Hero gradient** (warm ember, declared per-file as `HERO_GRADIENT`):
```
['#3D2D12', '#150E08', '#000000']  with locations [0, 0.6, 1]
```
Applied on Practice / Ready / Paywall / Journal / Onboarding-Welcome / More heroes via `expo-linear-gradient`. The top stop is a gold-leaning amber (not red-brown), so it harmonizes with the brighter accent rather than competing.

**Semantic:**
- `virtueGood` `#6a9a6a`, `virtueBad` `#9a6a4a`
- `successBg` `#0a140a`, `successBorder` `#3a5a3a`

### Typography

Three families. Each owns a distinct role.

| Token | Value | Role |
|---|---|---|
| `font.display` | `'Didot'` | Marquee headlines, screen titles, declarative type. iOS-system; no external load. |
| `font.body` | `'Inter_400Regular'` | All body copy, default text. Loaded via `@expo-google-fonts/inter`. |
| `font.bodyMedium` | `'Inter_500Medium'` | Buttons, eyebrows, uppercase labels, anything that wants weight without becoming a headline. |
| `font.wordmark` | `'Cormorant_700Bold'` | The "Marcus" wordmark on Welcome + More tab. Nowhere else. |
| `font.serif` | `'Cormorant_400Regular'` | Quotes, philosophical passages, the literary voice. |

**Size tokens (kept for legacy / non-screen-title uses):**

| Token | Size |
|---|---|
| `heroSize` | 36 |
| `titleSize` | 28 |
| `bodySize` | 17 |
| `subSize` | 15 |
| `labelSize` | 11 |
| `microSize` | 10 |
| `sectionTracking` | 1.8 |

**Font loading.** `app/_layout.jsx` runs `useFonts({ Inter_400Regular, Inter_500Medium, Cormorant_400Regular, Cormorant_500Medium, Cormorant_700Bold })` and blocks first paint until fonts resolve. After load, `Text.defaultProps.style` is set to `{ fontFamily: 'Inter_400Regular' }` so any `<Text>` without an explicit `fontFamily` inherits Inter Regular.

### Radii

| Token | Value | Use |
|---|---|---|
| `radius.sm` | 8 | Small accents |
| `radius.md` | 12 | H56 primary buttons, input fields, nav pills |
| `radius.lg` | 16 | Prompt cards, field cards, intention cards |
| `radius.xl` | 20 | Reserved |
| `radius.pill` | 100 | Reserved (no current usage) |

**Hand-tuned radii outside the token set** (intentional, distinct affordances):
- **EDIT chips / Delete chip** — `4` (small inline chips)
- **NEXT / TODAY tags** — `5`
- **Filter pills** (archives) — `18`
- **Role suggestion pills** — `20`

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

The single most important rule: **three fonts, three lanes, never cross-applied**.

| Lane | Font | Used on |
|---|---|---|
| Marquee | Didot | 44pt onboarding step titles, paywall hero, ready screen, meditate header, practice-tab date (`heroDate`), sealed-state streak, paywall plan prices, empty-state titles |
| Voice | Cormorant | "Marcus" wordmark (Welcome + More) at Cormorant Bold 700; all italic quote bodies + pulled quotes + sealed-state quote in Cormorant Regular 400 |
| Utility | Inter | All body paragraphs (`Text.defaultProps` default), all button labels (Medium), all eyebrows / uppercase section labels (Medium), all tab labels (Medium) |

**Marquee tracking:** Didot has wider proportions than system sans. Relaxed letter-spacing on titles — `-0.5` rather than the `-1.5` that worked for system sans. Same logic for Cormorant Bold on the wordmark (`-1` at 64pt, `-0.5` at 44pt). When changing title sizes, re-tune tracking.

**Hero title shadow.** Titles overlaying images carry `textShadowColor: 'rgba(0,0,0,0.7)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8` for legibility against bright painting areas. Eyebrows get a stronger shadow (`rgba(0,0,0,0.85)`, radius 6).

**Hero titles never end with a period.** Applied across all `title` / `stepTitle` / `previewTitle` sites.

---

## 3. Gold button system

All gold buttons in the app are now driven by **two shared components** in `components/GoldButton.jsx`. Stops the previous drift where every screen redeclared its own outlined/filled-gold variants.

### `<GoldPrimary>` — gradient fill + procedural noise

Filled primary CTA. Vertical metallic gold gradient with a procedural noise overlay rendered via SVG `<feTurbulence>` for per-pixel grain.

Props:
- `onPress`, `disabled`, `style`, `children`, `activeOpacity`, `hitSlop`, `borderRadius`

Gradient stops (in `GoldButton.jsx`):
```
['#D9A868', '#FFCE82', '#D9A868']  with locations [0, 0.5, 1]
```
Symmetric metallic sheen — edges drop to a slightly toned-down gold, midpoint matches `accent`. Original Figma had a `#806338` shadow stop at 76% but in practice it rendered as a horizontal "black bar"; dropped.

Noise overlay: brown `#473513` at 25% alpha, generated by `<feTurbulence baseFrequency="0.9" numOctaves="1" stitchTiles="stitch">` color-matrixed to brown with alpha tied to luminance. Renders at the device's pixel density, no PNG asset.

**Used on every filled-gold primary CTA across the app** (Start trial, Manage subscription, Continue, Set reminders, Go to Practice, Save, Complete, Seal this week, Generate today's reading, Save insight, Save changes, Log this trigger, Pick patterns, accessory `Save` / `Next` / `Complete` buttons).

### `<GoldSecondary>` — gradient stroke + masked gradient text

Outlined / secondary button. Gradient renders as a thin stroke ring (via outer `<GoldGradient>` + inset bg-colored layer that leaves a `borderWidth` ring visible). Text and icons get the same gradient via `<MaskedView>` + `<LinearGradient>`.

Props (same as `GoldPrimary`) plus:
- `borderWidth` — defaults to 1. Lighter `0.5` on small chips.
- `bgColor` — surface the chip sits on (defaults to `colors.bg`). Pass `colors.bgCard` etc. when the parent card has a different bg so the inset blends.
- `flatStroke` — boolean. When `true`, draws a solid `colors.accent` border instead of the gradient stroke. The metallic gradient looks muddy on chips < ~22pt tall (the dark stop compresses into a sharp band), so small chips opt out of the gradient stroke and keep flat-gold borders. Text/icon still get masked-gradient.
- `contentStyle` — flex layout (gap / padding / direction) for the inner content. Pass this rather than `style` for spacing between icon + text — `style` applies to the outer `TouchableOpacity`, which doesn't propagate flex layout to absolute-positioned children.

**Used on every outlined-gold secondary across the app** (Past entries / readings / reviews / triggers pills, archive EDIT chips, compass Delete chip, onboarding reminder Edit/Done chip, accessory `Back` / `Cancel` / `Done` buttons, in-body `Cancel` in JournalEntryEditor + ReviewEntryEditor, the "Generate new reading" outlined H56, the "Maybe later" onboarding button).

### Native dependencies the button system requires

- `expo-linear-gradient` — gradient renderer (already in deps before this work).
- `react-native-svg` — procedural noise via `<feTurbulence>`.
- `@react-native-masked-view/masked-view` — gradient text + icon for `GoldSecondary`.

`GoldButton.jsx` runtime-detects whether the native modules are registered (`NativeModules` / `UIManager.getViewManagerConfig`) and falls back gracefully so a JS-only reload before the dev client is rebuilt won't crash the bundle.

### H44 vs H56 sizes

Two-tier system on iPhone, derived from Valeriya's Figma library scaled by 1/1.5 (her artboard is 591pt wide vs iPhone's ~393pt).

| Valeriya's label | Figma px | iOS pt | Used for |
|---|---|---|---|
| H56 small | 56 | **44** (Apple touch minimum) | Keyboard accessory pairs |
| H80 medium | 80 | **56** | All primary CTAs (hero + in-body) |

Use `<GoldPrimary style={{ height: 56 }}>` for in-body primary actions. For keyboard accessories, wrap pairs in an `accessoryBarPair` view:

```js
accessoryBarPair: {
  flexDirection: 'row', gap: 10, backgroundColor: bg,
  borderTopWidth: 0.5, borderTopColor: border,
  paddingHorizontal: 16, paddingVertical: 8,
}
```

Then `<GoldSecondary>` + `<GoldPrimary>` side-by-side, each `flex: 1, height: 44`.

### Button text

All button text uses `font.bodyMedium` (Inter Medium 500) with `letterSpacing: 0.3`. Filled-button text is dark (`#1a1a1a`) to read on the gold gradient; outlined-button text is `colors.accent` (gets replaced by the masked gradient at render time when `<MaskedView>` is available).

All accessory-bar text has `numberOfLines={1}`, `adjustsFontSizeToFit`, `minimumFontScale={0.8}` for small-screen safety.

---

## 4. Input fields

Two-state visual pattern:

| State | Stroke | Body text |
|---|---|---|
| Non-active | `inputBorder` `#474747` | `textMuted` |
| Active (focused) | `inputBorderActive` `#878787` | `textPrimary` |

**Background:** `inputBg` `#121212` — one step above screen black for subtle elevation. The outline carries hierarchy; the bg gives a hint of layering without competing fills.

**Label / question text** stays white (`textPrimary`) in both states.

**Body text inside text inputs:** Inter Regular default.

---

## 5. Cards

### Practice tile (routine row)
Numbered daily / weekly tiles on the Practice screen.
- `routineCard` container: `borderWidth: 0.5`, `borderColor: border`, `borderRadius: radius.lg`
- Row: flex-row, dot + content + tag
- Status dot: 18pt circle, filled `accent` with checkmark when done
- Title: `fontSize: 17`, `fontFamily: font.bodyMedium`
- Sub: `fontSize: 13`, `color: textMuted`
- Done state: title turns `textMuted`, no NEXT tag

### Prompt card (journal, review)
- `borderWidth: 0.5`, `borderColor: inputBorder` (non-active) / `inputBorderActive` (active)
- `borderRadius: radius.lg`
- `padding: 20`, `marginBottom: 10`
- `backgroundColor: inputBg`

### Field card (emotions)
Same shape as prompt card. Active variant brightens the stroke.

### Reframe card (emotions, dynamic emotion color)
Takes on the selected emotion's palette (border + tint + text). Distortion grid renders inside.

### Archive entry row (journal-history, emotions-history, read-archive, review-archive)
- `padding: 18`, `borderBottomWidth: 0.5`, `borderBottomColor: border`
- `backgroundColor: bgCard`
- Top row: date + emotion / virtue subtitle on left, `<GoldSecondary flatStroke>` EDIT chip top-right

---

## 6. Page heroes

Every main screen has a hero image header with title overlaid at the bottom-left.

**Container:**
- `minHeight: 280` (260 on some surfaces)
- `borderBottomWidth: 0.5`, `borderBottomColor: border`
- `overflow: 'hidden'`, `justifyContent: 'flex-end'`

**Image:** `StyleSheet.absoluteFillObject`, `resizeMode: 'cover'`.

**Gradient scrim** (uniform across heroes — stronger than the original to handle bright paintings like Wisdom):

```js
<LinearGradient
  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.95)']}
  locations={[0, 0.4, 0.75, 1]}
  style={StyleSheet.absoluteFillObject}
/>
```

**Hero text:** padded `28h / 48t / 32b`, eyebrow + title + optional sub, all left-aligned with text-shadow for image legibility (see §2).

**Important layout note:** padding lives on an inner `stepHeroText` / `medOnbHeroText` wrapper, **not** on the hero container. When the container has horizontal padding, iOS clips absolutely-positioned children (the painting) to the content box, producing a black gutter on the right.

---

## 7. Onboarding

Six-step flow, every step art-directed. No more text-on-black screens.

| Step | Treatment |
|---|---|
| 1. Welcome | Warm-ember gradient bg + skull + "Marcus" wordmark (Cormorant Bold 64pt, tracking `-1`) + welcome quote ("Be one.") + GoldPrimary "Continue" |
| 2. Philosophy ("A daily Stoic practice") | `compass.jpg` painting hero |
| 3. Practice preview ("The shape of your day") | `journal-morning.jpg` painting hero + 4 daily steps + "Also in your kit" (Guided meditations, Weekly Review, Emotion log, FaceID lock) |
| 4. Meditations ("Ancient attention training") | `view-from-above.jpg` painting hero + 6 meditation cards with painting thumbnails + audio previews |
| 5. Reminders ("A few gentle reminders") | `evening-examination.jpg` painting hero + editable notification rows |
| 6. Paywall | Warm-ember gradient + skull + plan selector. Top-back chrome via `<ScreenHeader>` when entered from inside the app; absent during onboarding. |

After paywall purchase → `ReadyScreen` ("Your practice begins now") → Practice.

### Compass intro

When a user first taps the Compass tab (no `has_seen_compass_intro` flag), `<CompassIntro>` shows: three preview cards with `<GoldSecondary>` Edit chips, "Use these to start" CTA. On dismiss, route returns to Practice (`router.replace('/')`) instead of dropping on the live Compass screen — avoids the redundancy of showing the same content twice.

---

## 8. Empty states

All four archives (read-archive, journal-history, review-archive, emotions-history) share the same structure for first-time / no-data state:

- 180×108 painting thumbnail at top (rounded 12pt), each pulling its in-app hero (`read.jpg` / `journal-morning|evening.jpg` / `review.jpg` / `emotions.jpg`)
- Eyebrow in Inter Medium uppercase
- Title in Didot 26pt with `letterSpacing: -0.5, lineHeight: 32`
- Body copy in Inter Regular (default)
- Optional CTA below

Transient empty states ("Nothing matches your filter") are plain text, no painting — they're temporary, not first-impressions.

---

## 9. Tab bar

Three logical tabs: Practice · Emotions · More.

- `height: 84`, `paddingBottom: 24`, `paddingTop: 10`
- `backgroundColor: '#0d0a08'` (warm-tinted black to match the hero gradient world)
- `borderTopColor: border`
- Icons: `flame-outline` / `heart-outline` / `menu-outline` (menu is `size: 26`; the others are `size: 22`)
- Labels: `fontSize: 9`, `letterSpacing: 1.4`, `fontFamily: font.bodyMedium`, `textTransform: 'uppercase'`
- Active = `accent`, inactive = `textDim`

### Logical tab highlighting

`_layout.jsx` defines `PRACTICE_ROUTES` and `EMOTIONS_ROUTES` sets. `useLogicalTabKey()` reads `usePathname()` and maps hidden routes (compass, journal, etc.) back to the parent tab so the right icon stays illuminated as the user navigates flow screens.

---

## 10. Chrome components

### `<PracticeHeader>`
Sticky header on the daily practice flow screens (compass, reading, journal). Title row: real Ionicons `chevron-back` + Roman + current title + `chevron-forward` (typographic glyphs replaced with icons in the brand pass — `›` at `fontWeight: 300` was under-weighted). Segments row below: 4 hairlines, lit/dim based on position.

### `<ScreenHeader>`
Used on all non-practice-flow screens (settings, archives, weekly review, paywall when entered from inside the app). Renders a `‹ Back` text-link in a thin top bar.

---

## 11. Conventions

- **Three fonts, three lanes.** Didot for marquee, Inter for utility, Cormorant for voice. If you find yourself reaching for a fourth, the system is breaking.
- **No periods on hero headlines.** Applied across all `title` / `stepTitle` / `previewTitle` sites.
- **Avoid em-dashes in user-facing copy** unless they earn it (per user feedback).
- **Scroll-to-top on focus** — every screen resets to top via `useFocusEffect` on tab/route re-entry.
- **No iOS scroll indicators** — `showsVerticalScrollIndicator={false}` everywhere.
- **Touch target floor** — 44pt minimum (Apple HIG); buttons round up if math says lower.
- **Hero gradients fade fast.** Top 40% transparent, last 25% near-black, so titles always sit on enough dark to read.

---

## 12. File map

| Concern | File |
|---|---|
| Color / font / radius / spacing tokens | `constants/theme.js` |
| Font loading + Text default | `app/_layout.jsx` |
| Gold button system | `components/GoldButton.jsx` |
| Tab nav + logical tab highlighting | `app/_layout.jsx` |
| Practice flow chrome | `components/PracticeHeader.jsx` |
| Non-practice screen chrome | `components/ScreenHeader.jsx` |
| Shared journal editor | `components/JournalEntryEditor.jsx` |
| Shared review editor | `components/ReviewEntryEditor.jsx` |
| Compass first-visit walkthrough | `components/CompassIntro.jsx` |
| Mini meditation player | `components/MiniMeditationPlayer.jsx` |
| Share cards (TestFlight share images) | `components/ReadingShareCard.jsx`, `components/ReviewShareCard.jsx` |
| Per-screen styles | inline `StyleSheet.create(...)` at the bottom of each `app/*.jsx` |

Per-screen `StyleSheet` blocks are the operational layer — most visual changes happen there. The theme tokens + GoldButton component are the canon.

---

## 13. Native dependencies the system relies on

| Dep | Used for |
|---|---|
| `expo-linear-gradient` | All hero gradients + GoldButton gradient stops |
| `react-native-svg` | Procedural noise on GoldPrimary via `<feTurbulence>` |
| `@react-native-masked-view/masked-view` | GoldSecondary gradient text + icon |
| `@expo-google-fonts/inter` | `Inter_400Regular` + `Inter_500Medium` |
| `@expo-google-fonts/cormorant` | `Cormorant_400Regular` + `Cormorant_500Medium` + `Cormorant_700Bold` |
| `expo-font` | Font loading helper |

Didot is iOS/macOS-system. No load needed.
