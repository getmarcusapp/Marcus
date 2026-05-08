import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { DeviceMotion } from 'expo-sensors';

// Subtle parallax tilt — the skull "follows" the user as they tilt the
// phone, simulating depth on a flat PNG. Capped at ±6° rotation per axis
// with low-pass damping so it eases instead of jittering. Sensors are
// only sampled while this component is mounted; index.jsx unmounts the
// hero on navigation away, so battery cost is scoped to the Practice
// screen.
const MAX_TILT_RAD = Math.PI / 30; // 6°
const SMOOTHING = 0.15; // 0 = no movement, 1 = no damping
const UPDATE_INTERVAL_MS = 33; // ~30 Hz

export function TiltingSkull({ source, style }) {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let smoothedBeta = 0;
    let smoothedGamma = 0;

    DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
    const sub = DeviceMotion.addListener(({ rotation }) => {
      if (!mounted || !rotation) return;
      // Low-pass filter: blend new reading toward target each tick so the
      // skull doesn't twitch on every micro-shake.
      smoothedBeta = smoothedBeta * (1 - SMOOTHING) + rotation.beta * SMOOTHING;
      smoothedGamma = smoothedGamma * (1 - SMOOTHING) + rotation.gamma * SMOOTHING;

      // Compensate-for-tilt mapping so the skull appears to "look at" the
      // user — when the phone tilts left, the skull rotates right within
      // its frame to maintain face-to-user. Half-strength to stay subtle.
      const tiltX = Math.max(-MAX_TILT_RAD, Math.min(MAX_TILT_RAD, -smoothedBeta * 0.5));
      const tiltY = Math.max(-MAX_TILT_RAD, Math.min(MAX_TILT_RAD, -smoothedGamma * 0.5));

      rotateX.setValue(tiltX);
      rotateY.setValue(tiltY);
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const animatedStyle = {
    transform: [
      // Perspective makes the rotateX/Y read as 3D pivot rather than 2D skew.
      { perspective: 800 },
      {
        rotateX: rotateX.interpolate({
          inputRange: [-1, 1],
          outputRange: ['-1rad', '1rad'],
        }),
      },
      {
        rotateY: rotateY.interpolate({
          inputRange: [-1, 1],
          outputRange: ['-1rad', '1rad'],
        }),
      },
    ],
  };

  return <Animated.Image source={source} style={[style, animatedStyle]} resizeMode="contain" />;
}
