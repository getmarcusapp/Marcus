import { useRef } from 'react';
import { Animated } from 'react-native';

// Tilt parallax was disabled per Valeriya's call: the 3D rotation with
// perspective caused parts of the skull (and other tilt-bound elements)
// to extend beyond their bounding boxes, which then clipped at parent
// edges — producing the "cropped logo" issue across hero surfaces.
//
// The hook is preserved as a no-op so callsites stay valid; if the
// effect is ever wanted again, restore the DeviceMotion subscription
// and the interpolated rotateX/rotateY transforms below. The
// accelerometer subscription is removed here to keep the sensor idle
// (battery / privacy) while the feature is off.
export function useDeviceTilt() {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  // Empty transform — the skull and any other consumers render flat.
  const tiltTransform = {};
  return { rotateX, rotateY, tiltTransform };
}
