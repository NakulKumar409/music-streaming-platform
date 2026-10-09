import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';

import App from './App';

// Register the main application
registerRootComponent(App);

// Register the track player playback service safely
try {
  TrackPlayer.registerPlaybackService(() => require('./apps/fan/src/services/playbackService').default);
} catch (error) {
  console.warn('[TrackPlayer] Playback service registration error:', error);
}
