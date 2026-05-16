import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Hides in-body primary CTAs while the keyboard is up so they don't
// double up with the keyboard accessory bar's right-side commit button.
// Uses keyboardWillShow/Hide on iOS so the toggle happens during the
// slide animation (Android falls back to keyboardDidShow/Hide).
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return visible;
}
