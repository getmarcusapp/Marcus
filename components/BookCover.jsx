import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radius, font } from '../constants/theme';
import { coverUrl } from '../constants/library';

// A book cover from Open Library, with a typographic fallback.
//
// Covers are the only real colour on the reading surfaces, which are otherwise
// type on near-black, so they do a lot of work. But not every ISBN has one:
// Musonius Rufus's lectures have no cover at all, and `default=false` on the
// Open Library URL makes those return 404 rather than a grey placeholder. When
// that happens, onError swaps in the title set in Cinzel, which matches the
// treatment used for the Stoics who have no surviving likeness and reads as a
// deliberate choice rather than a broken image.
//
// Shared by app/library.jsx and app/stoic.jsx so the fallback behaves the same
// in both places.
export function BookCover({ book, width = 116 }) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[s.wrap, { width }]}>
      {failed ? (
        <View style={s.fallback}>
          <Text
            style={[s.fallbackText, width < 100 && { fontSize: 11, lineHeight: 15 }]}
            numberOfLines={5}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {book.title}
          </Text>
        </View>
      ) : (
        <Image
          source={{ uri: coverUrl(book.isbn) }}
          style={s.image}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    aspectRatio: 0.66,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: '#111',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  fallbackText: {
    fontFamily: font.display,
    fontSize: 14,
    lineHeight: 19,
    color: colors.accentDim,
    textAlign: 'center',
  },
});
