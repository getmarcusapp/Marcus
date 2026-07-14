import { useRef, useCallback } from 'react';
import { Keyboard } from 'react-native';

// Keeps the caret visible while typing in a growing multiline TextInput.
//
// The app's writing surfaces all use the same recipe: a ScrollView with
// automaticallyAdjustKeyboardInsets + a multiline TextInput with
// scrollEnabled={false} (so the input grows with its text) + an
// InputAccessoryView docked above the keyboard. iOS only auto-scrolls on
// FOCUS changes — when the caret wraps to a new line mid-typing, the input
// grows downward and the caret walks behind the accessory bar / keyboard,
// so the user can't see what they're typing (QA checklist §5).
//
// This hook fixes it surgically: each time a growing input's content height
// increases while the keyboard is up, scroll the host ScrollView down by
// exactly the height delta. The caret stays visually pinned; nothing else
// moves. Height shrink (deleting lines) is left to iOS — the caret is
// already visible in that direction.
//
// Usage:
//   const scrollRef = useRef(null);
//   const { onScroll, onGrow } = useCaretScroll(scrollRef);
//   <ScrollView ref={scrollRef} onScroll={onScroll} scrollEventThrottle={16} ...>
//     <TextInput multiline scrollEnabled={false}
//       onContentSizeChange={onGrow('myInput')} ... />
//
// `key` distinguishes multiple inputs on one screen (emotions has three).
// The first onContentSizeChange per key (mount) only records the baseline —
// no scroll. Keyboard.isVisible() gates out programmatic text loads (e.g.
// restoring a saved draft on screen focus), which also fire content-size
// changes but must not scroll the page.
export function useCaretScroll(scrollRef) {
  const offsetY = useRef(0);
  const heights = useRef({});

  // Track the live scroll offset so the nudge is relative to wherever the
  // user (or iOS's inset adjustment) has actually scrolled to.
  const onScroll = useCallback((e) => {
    offsetY.current = e.nativeEvent.contentOffset.y;
  }, []);

  const onGrow = useCallback((key) => (e) => {
    const h = e.nativeEvent.contentSize.height;
    const prev = heights.current[key];
    heights.current[key] = h;
    if (prev !== undefined && h > prev && Keyboard.isVisible()) {
      scrollRef.current?.scrollTo({
        y: offsetY.current + (h - prev),
        animated: false,
      });
    }
  }, [scrollRef]);

  return { onScroll, onGrow };
}
