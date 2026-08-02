import { useRef, useState, useCallback } from 'react';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as haptics from '../lib/haptics';
import { track } from '../lib/analytics';

// Share a quote as the branded image card.
//
// The capture pipeline (mount an off-screen card, wait a frame for layout,
// captureRef, hand the file to Share) had been written out longhand in
// app/read.jsx and again in app/saved.jsx. This is the third caller, so it
// lives here once.
//
// app/read.jsx keeps its own copy on purpose: its share message carries the
// AI reflection as well as the quote, which is a different payload rather than
// a different implementation.
//
// Usage:
//   const { cardRef, pending, shareQuote } = useQuoteShare('practice');
//   ...
//   {pending && (
//     <View ref={cardRef} collapsable={false} style={{ position:'absolute', left:-9999, top:-9999 }}>
//       <ReadingShareCard quote={pending.text} author={pending.author} work={pending.work} />
//     </View>
//   )}
export function useQuoteShare(source) {
  const cardRef = useRef(null);
  const [pending, setPending] = useState(null);

  const shareQuote = useCallback(async ({ text, author, work }) => {
    if (!text) return;
    haptics.tap();
    setPending({ text, author, work });
    // Let the off-screen card lay out before capturing it. Without this the
    // capture races the mount and produces a blank image.
    await new Promise(r => setTimeout(r, 60));
    const tail = ['— Marcus · a daily Stoic practice', 'https://getmarcus.app'].join('\n');
    try {
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.92, result: 'tmpfile' });
      await Share.share({ url: uri, message: tail });
      track('quote_shared', { from: source || 'unknown' });
    } catch (e) {
      // Plain text beats failing silently if the capture goes wrong.
      const attr = [author, work].filter(Boolean).join(', ');
      await Share.share({
        message: [`"${text}"`, attr ? `— ${attr}` : '', '', tail].filter(Boolean).join('\n'),
      }).catch(() => {});
    } finally {
      setPending(null);
    }
  }, [source]);

  return { cardRef, pending, shareQuote };
}
