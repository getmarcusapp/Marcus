import { requireOptionalNativeModule } from 'expo-modules-core';

// Lock screen and Control Center "Now Playing" for the meditation player
// (ios/NowPlayingModule.swift). Optional, so a build without the native
// module (Expo Go, Android) just skips it.
export default requireOptionalNativeModule('NowPlaying');
