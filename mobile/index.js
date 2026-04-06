import { registerRootComponent } from 'expo';
import TrackPlayer from 'react-native-track-player';

import App from './App';

// Register the main application
registerRootComponent(App);

// Register the track player playback service
TrackPlayer.registerPlaybackService(() => require('./apps/fan/src/services/playbackService').default);
