import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { writeMindfulSession } from './health';

// Tracks how long the user has been on the screen (in foreground) and
// returns a `commit()` function that writes a Mindful Session covering
// that duration to Apple Health. AppState backgrounding pauses the
// timer so leaving the app mid-practice doesn't inflate the session.
export function useMindfulSession() {
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') startRef.current = Date.now();
    });
    return () => sub.remove();
  }, []);

  function commit() {
    const start = startRef.current;
    const end = Date.now();
    writeMindfulSession(start, end);
  }

  return commit;
}
