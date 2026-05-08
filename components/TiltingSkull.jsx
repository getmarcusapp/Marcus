import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { DeviceMotion } from 'expo-sensors';

// Parallax tilt — the skull "follows" the user as they tilt the phone,
// simulating depth on a flat PNG. Capped at ±18° rotation per axis with
// low-pass damping so it eases instead of jittering.
const MAX_TILT_DEG = 18;
const TILT_SCALE = 0.6;
const SMOOTHING = 0.18;
const UPDATE_INTERVAL_MS = 33; // ~30 Hz
const PERSPECTIVE = 600;

export function TiltingSkull({ source, style }) {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let smoothedBeta = 0;
    let smoothedGamma = 0;
    let sub = null;

    (async () => {
      try {
        const available = await DeviceMotion.isAvailableAsync();
        if (!available) return;
        const perm = await DeviceMotion.requestPermissionsAsync();
        if (perm.status !== 'granted') return;

        DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
        sub = DeviceMotion.addListener(({ rotation }) => {
          if (!mounted || !rotation) return;
          smoothedBeta = smoothedBeta * (1 - SMOOTHING) + rotation.beta * SMOOTHING;
          smoothedGamma = smoothedGamma * (1 - SMOOTHING) + rotation.gamma * SMOOTHING;
          // Radians → degrees, then scale + cap. Negative so the skull
          // appears to compensate for tilt (face the user).
          const betaDeg = -smoothedBeta * (180 / Math.PI);
          const gammaDeg = -smoothedGamma * (180 / Math.PI);
          const tiltX = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, betaDeg * TILT_SCALE));
          const tiltY = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, gammaDeg * TILT_SCALE));
          rotateX.setValue(tiltX);
          rotateY.setValue(tiltY);
        });
      } catch (e) {
        // Sensor unavailable / permission denied — skull renders flat.
      }
    })();

    return () => {
      mounted = false;
      if (sub) sub.remove();
    };
  }, []);

  const animatedStyle = {
    transform: [
      { perspective: PERSPECTIVE },
      {
        rotateX: rotateX.interpolate({
          inputRange: [-MAX_TILT_DEG, MAX_TILT_DEG],
          outputRange: [`-${MAX_TILT_DEG}deg`, `${MAX_TILT_DEG}deg`],
        }),
      },
      {
        rotateY: rotateY.interpolate({
          inputRange: [-MAX_TILT_DEG, MAX_TILT_DEG],
          outputRange: [`-${MAX_TILT_DEG}deg`, `${MAX_TILT_DEG}deg`],
        }),
      },
    ],
  };

  return <Animated.Image source={source} style={[style, animatedStyle]} resizeMode="contain" />;
}
