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

  border: '#1e1e1e',
  borderMid: '#2a2a2a',
  borderStrong: '#363636',
  borderBright: '#444444',

  textPrimary: '#F0F0F0',
  textSecondary: '#C8C8C8',
  textMuted: '#A0A0A0',
  textDim: '#707070',
  textGhost: '#2a2a2a',

  accent: '#C8A97A',
  accentDim: '#8a7254',
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
  serif: 'Georgia',
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