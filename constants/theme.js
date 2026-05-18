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

  border: '#252525',
  borderMid: '#2a2a2a',
  borderStrong: '#363636',
  borderBright: '#444444',

  // Input field tokens per Valeriya's library — applied to every text input
  // surface (journal/review prompt cards, emotions fieldCards, compass edit
  // inputs, read insight card, onboarding compass input). The bg sits one
  // step above the screen black so the field has subtle elevation; strokes
  // shift between non-active and active focus states.
  inputBg: '#121212',
  inputBorder: '#474747',
  inputBorderActive: '#878787',

  textPrimary: '#F0F0F0',
  textSecondary: '#C8C8C8',
  textMuted: '#A0A0A0',
  textDim: '#707070',
  textGhost: '#2a2a2a',

  accent: '#FFCE82',
  accentDim: '#B38B5B',
  accentBg: '#1a1610',

  // ── Light zones (cards, writing surfaces, checklists) ──
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

  virtueGood: '#6a9a6a',
  virtueBad: '#9a6a4a',

  successBg: '#0a140a',
  successBorder: '#3a5a3a',
};

export const font = {
  heroSize: 36,
  titleSize: 28,
  bodySize: 17,
  subSize: 15,
  labelSize: 11,
  microSize: 10,
  sectionTracking: 1.8,
  // Brand typography per Valeriya's strategy doc.
  // - display (Didot): marquee headlines — iOS-system, no load needed.
  // - body / bodyMedium (Inter): UI text + buttons + section labels.
  // - wordmark (Cormorant Medium): "Marcus" brand name on welcome screen.
  // - serif (Cormorant Regular): in-app quote / philosophical voice.
  //   Cormorant is brand-consistent with the wordmark (same family) but
  //   engineered for text sizes, so quote bodies stay legible — unlike
  //   Didot, which is a display serif and gets heavy at 15-19pt.
  display: 'Didot',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  wordmark: 'Cormorant_700Bold',
  serif: 'Cormorant_400Regular',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 100,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};