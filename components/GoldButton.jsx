import React from 'react';
import { TouchableOpacity, View, Image, StyleSheet, NativeModules, UIManager, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '../constants/theme';

// Valeriya's pre-composed button background — gradient + noise baked in
// at 4x (2068×336). Stretches to fit button bounds; borderRadius clipping
// happens via overflow:'hidden' on the outer TouchableOpacity.
const BUTTON_BG = require('../assets/button-bg.png');

// Detect whether a native module is registered in the running binary. We
// use this to short-circuit the SVG / MaskedView features before the
// rebuild lands so a JS-only reload doesn't crash the bundle.
function hasNative(name) {
  if (NativeModules?.[name]) return true;
  if (Platform.OS === 'ios' && UIManager?.getViewManagerConfig?.(name)) return true;
  return false;
}
const HAS_SVG = hasNative('RNSVGSvgView');
const HAS_MASKED_VIEW = hasNative('RNCMaskedView');

// MaskedView + react-native-svg are native deps added for the gold-button
// system; lazy-require both so the JS bundle keeps loading on the existing
// dev client. The noise + GoldSecondary will only render once the rebuild
// lands; before that they fall back to a non-noise / non-gradient state.
let MaskedView;
function loadMaskedView() {
  if (!MaskedView) {
    MaskedView = require('@react-native-masked-view/masked-view').default;
  }
  return MaskedView;
}

let SvgModule;
function loadSvg() {
  if (SvgModule === undefined) {
    try {
      SvgModule = require('react-native-svg');
    } catch (e) {
      SvgModule = null;
    }
  }
  return SvgModule;
}

// Gold gradient — symmetric metallic sheen, vertical (top → bottom).
// Tones matched to the skull logo's gold (sampled at ~#C39B5F, luma 129-168)
// per V: the bright accent midpoint (#FFCE82, luma 212) read hotter than the
// logo, so the peak is capped at the skull's lightest gold and the edges sit
// in its darker range — same gold family, sheen retained, no longer out-
// shining the skull. (The accent gold for text/labels stays #FFCE82.)
const GOLD_STOPS = ['#AC844F', '#CBA164', '#AC844F'];
const GOLD_LOCATIONS = [0, 0.5, 1];
const NOISE_OPACITY = 0.40;

function GoldGradient({ style }) {
  return (
    <LinearGradient
      colors={GOLD_STOPS}
      locations={GOLD_LOCATIONS}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={style}
    />
  );
}

// Procedural noise via SVG <feTurbulence>. Renders at device pixel density
// so the grain stays crisp instead of getting bilinear-smoothed like a
// PNG. Color-matrixed to brown (#473513) with alpha tied to luminance of
// the turbulence output. baseFrequency 0.9 gives fine grain matching the
// Figma "size 0.5" spec.
function NoiseLayer({ style }) {
  if (!HAS_SVG) return null;
  const Svg = loadSvg();
  if (!Svg) return null;
  const { default: SvgRoot, Defs, Filter, FeTurbulence, FeColorMatrix, Rect } = Svg;
  return (
    <View pointerEvents="none" style={style}>
      <SvgRoot width="100%" height="100%">
        <Defs>
          <Filter id="goldNoise" x="0" y="0" width="100%" height="100%">
            <FeTurbulence type="fractalNoise" baseFrequency="2.5" numOctaves="1" seed="2" stitchTiles="stitch" />
            <FeColorMatrix
              type="matrix"
              values="0 0 0 0 0.278  0 0 0 0 0.207  0 0 0 0 0.075  0.333 0.333 0.333 0 0"
            />
          </Filter>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" filter="url(#goldNoise)" />
      </SvgRoot>
    </View>
  );
}

// Filled gold button — pure vertical metallic gradient, no noise overlay.
// (Noise via PNG / procedural feTurbulence both read harder than Figma's
// renderer; gradient-only lands closest to the smooth-sheen reference.)
export function GoldPrimary({
  onPress,
  disabled,
  style,
  children,
  activeOpacity = 0.85,
  hitSlop,
  borderRadius = radius.md,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={activeOpacity}
      hitSlop={hitSlop}
      style={[s.base, { borderRadius }, style, disabled && s.disabled]}
    >
      <GoldGradient style={StyleSheet.absoluteFill} />
      {children}
    </TouchableOpacity>
  );
}

// Gradient stroke + gradient text/icon, no fill. The stroke is faked with
// an outer gradient layer and an inset background-colored layer that
// leaves a `borderWidth` ring of gradient visible. Children are masked so
// any Text/Icon picks up the same gradient.
//
// bgColor must match the surface the button sits on (defaults to the
// screen body bg). Children should not set their own color — the mask
// applies the gradient over their alpha.
export function GoldSecondary({
  onPress,
  disabled,
  style,
  children,
  activeOpacity = 0.85,
  hitSlop,
  borderRadius = radius.md,
  borderWidth = 1,
  bgColor = colors.bg,
  // Inner-flow layout — applied to both the invisible sizer and the
  // MaskedView's mask shape so the gradient overlay stays aligned with
  // what consumers see. Pass gap/padding here, not on `style`, since
  // `style` applies to the outer TouchableOpacity (which absolutes can't
  // participate in flex from).
  contentStyle,
  // `flatStroke` swaps the gradient stroke for a solid colors.accent
  // border. On small chips (≤22pt tall) the gradient's shadow stop
  // compresses into a sharp dark patch — flat stroke reads cleaner.
  // Text/icon stay masked with the gradient regardless.
  flatStroke = false,
}) {
  // Before the dev client rebuild lands, MaskedView isn't in the native
  // binary. Fall back to a flat-gold outline so the button still renders
  // (just without the gradient text/stroke). Once rebuilt, full gradient.
  if (!HAS_MASKED_VIEW) {
    // Fallback inner needs explicit row layout; default flexDirection is
    // column, which was stacking icon below text on Past X pills.
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        activeOpacity={activeOpacity}
        hitSlop={hitSlop}
        style={[
          s.base,
          { borderRadius, borderWidth, borderColor: '#9F7E4C' },
          style,
          disabled && s.disabled,
        ]}
      >
        <View style={[s.fallbackInner, contentStyle]} pointerEvents="none">{children}</View>
      </TouchableOpacity>
    );
  }
  const MV = loadMaskedView();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={activeOpacity}
      hitSlop={hitSlop}
      style={[
        s.base,
        { borderRadius },
        flatStroke && { borderWidth, borderColor: colors.accent },
        style,
        disabled && s.disabled,
      ]}
    >
      {!flatStroke && (
        <>
          <GoldGradient style={StyleSheet.absoluteFill} />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                margin: borderWidth,
                backgroundColor: bgColor,
                borderRadius: Math.max(0, borderRadius - borderWidth),
              },
            ]}
          />
        </>
      )}
      {/* Visible sizer — actual children layout. opacity:0 so it just
          contributes to the TouchableOpacity's intrinsic size; the
          gradient-tinted version is rendered on top via MaskedView. */}
      <View style={[s.sizer, contentStyle]} pointerEvents="none">{children}</View>
      <MV
        style={StyleSheet.absoluteFill}
        maskElement={
          <View style={[StyleSheet.absoluteFill, s.maskInner, contentStyle]}>{children}</View>
        }
      >
        <GoldGradient style={StyleSheet.absoluteFill} />
      </MV>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  base: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mask elements must use opaque/black children; alpha drives what's
  // revealed. Whatever the consumer passes (Text, Ionicons, etc.) just
  // needs non-transparent color; the gradient replaces it.
  maskInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  // Invisible sizer that gives the parent its intrinsic dimensions.
  sizer: { opacity: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  // Pre-rebuild fallback inner — fully visible; needs an explicit row
  // layout since the consumer's `style` goes on the outer TouchableOpacity
  // and a plain View defaults to flexDirection: column.
  fallbackInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
});
