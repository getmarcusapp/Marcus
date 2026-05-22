import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';

// Full-screen looping background video with a tunable dark overlay.
// Used on the intro / success moments (onboarding WelcomeStep, /ready,
// /welcome) where a static gradient would have been used otherwise. The
// overlay sits between the video and the content so the video stays
// legible chrome rather than competing with the foreground typography.
//
// Usage:
//   <VideoBackground>
//     <SafeAreaView>...content...</SafeAreaView>
//   </VideoBackground>
//
// Notes:
//  - Video is muted + looped + autoplay; carries no audio in source.
//  - Default overlay opacity is 0.8 per Valeriya's spec.
//  - resizeMode COVER so the video fills the screen on any aspect ratio.
export function VideoBackground({ children, overlayOpacity = 0.8 }) {
  return (
    <View style={s.wrap}>
      <Video
        source={require('../assets/intro-video.mov')}
        style={StyleSheet.absoluteFillObject}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping
        isMuted
        // Native iOS playback only — no controls, no surfaces shown.
        useNativeControls={false}
      />
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: `rgba(0,0,0,${overlayOpacity})` },
        ]}
      />
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
});
