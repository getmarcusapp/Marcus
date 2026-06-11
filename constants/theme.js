export const colors = {
  // ── Dark zones (hero, nav, headers, sealed state) ──
  // Unified near-black per Valeriya's design system: everything that used
  // to be a distinct grey fill (bgCard, bgElevated) now reads as one canvas,
  // with hierarchy expressed via borders + typography rather than fills.
  // Tokens kept as separate names so per-spot tweaks can still happen if a
  // surface truly needs to read as a different shade.
  bg: '#0a0a0a',
  bgDeep: '#0a0a0a',
  bgCard: '#0a0a0a',
  bgElevated: '#0a0a0a',

  // Single border per V's meeting (Plate II simplification). Previous
  // tokens border #252525, borderMid #2A2A2A, borderStrong #363636,
  // borderBright #444444, and inputBorder #474747 all consolidated into
  // ONE token at #474747. Brighter than the old #252525, so strokes are
  // present rather than near-invisible. Do not reintroduce dim variants.
  border: '#474747',

  // Input field tokens. The single non-active border is `border` above;
  // active/focused state uses this brighter stroke per V's spec.
  inputBg: '#121212',
  inputBorderActive: '#878787',

  // Text scale collapsed to two steps per V's meeting (Plate II). Previous
  // tokens textMuted #A0A0A0, textDim #707070, textGhost #2A2A2A retired —
  // anything dim now standardizes on textSecondary. If a specific element
  // needs to read as disabled or placeholder, give it an explicit
  // hard-coded value with a comment; do not reintroduce dim tokens.
  textPrimary: '#F0F0F0',
  textSecondary: '#C8C8C8',

  // Accent. accentBg (#1A1610 warm-dark brown) retired per V — accent-tinted
  // surfaces (memento strips, lock screen, notification banners) now use
  // colors.bg for a flat dark backdrop without the warm tint.
  accent: '#FFCE82',
  accentDim: '#B38B5B',

  // ── Light zones (share cards, writing surfaces, light-mode artifacts) ──
  // Kept for the share-card export pipeline (renders on white background).
  lightBg: '#F7F5F2',
  lightBg2: '#EFECEA',
  lightBg3: '#E8E5E1',
  lightWhite: '#FFFFFF',
  lightBorder: '#DDDAD6',
  lightBorder2: '#CCCAC6',
  lightText: '#1A1A1A',
  lightText2: '#3A3A3A',
  lightMuted: '#6A6A6A',
  lightDim: '#9A9A9A',
  // Semantic colors (virtueGood / virtueBad / successBg / successBorder)
  // retired per V — virtues/success no longer distinguished by hue in the
  // dark UI. Where a state was previously colored, callers now use accent
  // (positive) / accentDim (warning) / border (neutral state divider).
};

export const font = {
  heroSize: 36,
  titleSize: 28,
  // Base body text per V's meeting: 17 → 18 for better readability and to
  // match the design-system canonical scale.
  bodySize: 18,
  subSize: 15,
  // microSize (10pt) retired per V's meeting — eyebrow/label-tier text
  // standardizes on labelSize (11pt). Every former micro consumer now uses
  // labelSize. If anything genuinely needs <11pt later, give it an explicit
  // hard-coded value with a comment; do not reintroduce micro.
  labelSize: 11,
  sectionTracking: 1.8,
  // Brand typography — the app uses ONLY two families: Inter and Cinzel.
  // - display (Cinzel): marquee headlines, dates, the gold "Day N", screen
  //   titles, virtue names, the wordmark on share cards. Roman inscriptional
  //   caps — matches the Cinzel wordmark image. ALL-CAPS by nature (no true
  //   lowercase, no italic), so it's display-only.
  // - body / bodyMedium (Inter): UI text, buttons, section labels, list
  //   titles, inputs — everything readable/scannable.
  // - bodyLightItalic (Inter Light Italic): the reflective/quote voice
  //   (floating quotes, share-card quotes, philosophical asides). True italic
  //   variant — RN won't synthesize italic from a custom TTF.
  // (Didot and Cormorant were both retired in favor of Cinzel + Inter.)
  display: 'Cinzel_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  // Real semibold/bold faces. Use these instead of fontWeight overrides —
  // a bare fontWeight without fontFamily renders San Francisco, not Inter
  // (the brand rule is Inter/Cinzel only).
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  bodyLight: 'Inter_300Light',
  bodyLightItalic: 'Inter_300Light_Italic',
};

export const radius = {
  sm: 8,    // small accents
  md: 12,   // buttons, inputs, prompt/field cards (took over for the
            // retired radius.lg = 16 per V's meeting)
  chip: 4,  // EDIT chip, TODAY tag (small label-bearing rects)
  pill: 20, // Filter pill / role pill / pill-shaped action buttons
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};
