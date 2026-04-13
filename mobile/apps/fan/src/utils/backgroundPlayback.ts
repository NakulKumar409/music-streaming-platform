import TrackPlayer, { State, Event } from 'react-native-track-player';
import { Platform } from 'react-native';
import logger from './logger';

/**
 * Background Playback Utilities
 * 
 * Helper functions for managing background audio playback,
 * lock screen controls, and notification center integration.
 */

export interface PlaybackState {
  isPlaying: boolean;
  position: number;
  duration: number;
  track: string | null;
}

/**
 * Get current playback state from TrackPlayer
 */
export async function getPlaybackState(): Promise<PlaybackState> {
  try {
    const [state, progress, track] = await Promise.all([
      TrackPlayer.getState(),
      TrackPlayer.getProgress(),
      TrackPlayer.getActiveTrack(),
    ]);

    return {
      isPlaying: state === State.Playing,
      position: progress.position,
      duration: progress.duration,
      track: track?.id || null,
    };
  } catch (error) {
    logger.error('[BackgroundPlayback] Error getting playback state:', error);
    return {
      isPlaying: false,
      position: 0,
      duration: 0,
      track: null,
    };
  }
}

/**
 * Check if TrackPlayer is ready for playback
 */
export async function isTrackPlayerReady(): Promise<boolean> {
  try {
    const state = await TrackPlayer.getState();
    return state !== State.None;
  } catch {
    return false;
  }
}

/**
 * Format track duration for lock screen display
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Handle audio focus changes (for custom audio focus management if needed)
 */
export function handleAudioFocusChange(focus: 'gain' | 'loss' | 'loss_transient' | 'loss_transient_can_duck') {
  logger.log('[BackgroundPlayback] Audio focus changed:', focus);
  
  switch (focus) {
    case 'gain':
      // Audio focus gained - can resume playback
      TrackPlayer.play().catch(() => undefined);
      break;
    case 'loss':
      // Permanent audio focus loss - stop playback
      TrackPlayer.pause().catch(() => undefined);
      break;
    case 'loss_transient':
      // Temporary loss (phone call, etc.) - pause
      TrackPlayer.pause().catch(() => undefined);
      break;
    case 'loss_transient_can_duck':
      // Can duck (lower volume) - handled by TrackPlayer automatically
      break;
  }
}

/**
 * Background playback event types for app-level handling
 */
export type BackgroundEventType = 
  | 'remote-play'
  | 'remote-pause'
  | 'remote-next'
  | 'remote-previous'
  | 'remote-seek'
  | 'remote-stop'
  | 'playback-error'
  | 'playback-complete';

/**
 * Callback type for background events
 */
export type BackgroundEventCallback = (type: BackgroundEventType, data?: any) => void;

/**
 * Subscribe to background playback events
 * Note: Main event handling is done in playbackService.ts
 * This is for additional app-level event handling if needed
 */
export function subscribeToBackgroundEvents(callback: BackgroundEventCallback) {
  const subscriptions: { remove: () => void }[] = [];

  // Map TrackPlayer events to app-level events
  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemotePlay, () => callback('remote-play'))
  );
  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemotePause, () => callback('remote-pause'))
  );
  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemoteNext, () => callback('remote-next'))
  );
  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemotePrevious, () => callback('remote-previous'))
  );
  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemoteSeek, (data) => callback('remote-seek', data))
  );
  subscriptions.push(
    TrackPlayer.addEventListener(Event.RemoteStop, () => callback('remote-stop'))
  );
  subscriptions.push(
    TrackPlayer.addEventListener(Event.PlaybackError, (data) => callback('playback-error', data))
  );
  subscriptions.push(
    TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () => callback('playback-complete'))
  );

  // Return cleanup function
  return () => {
    subscriptions.forEach(sub => sub.remove());
  };
}

/**
 * Configure audio session for background playback (iOS specific)
 */
export async function configureAudioSession(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  try {
    // Additional iOS audio session configuration if needed
    // Most configuration is handled by TrackPlayer automatically
    logger.log('[BackgroundPlayback] iOS audio session configured');
  } catch (error) {
    logger.error('[BackgroundPlayback] Error configuring audio session:', error);
  }
}

/**
 * Debug helper to log current playback state
 */
export async function logPlaybackState(): Promise<void> {
  try {
    const state = await getPlaybackState();
    const track = await TrackPlayer.getActiveTrack();
    const queue = await TrackPlayer.getQueue();
    
    logger.log('[BackgroundPlayback] Current State:', {
      isPlaying: state.isPlaying,
      position: formatDuration(state.position),
      duration: formatDuration(state.duration),
      currentTrack: track?.title || 'None',
      artist: track?.artist || 'None',
      queueLength: queue.length,
    });
  } catch (error) {
    logger.error('[BackgroundPlayback] Error logging state:', error);
  }
}

/**
 * Reset TrackPlayer completely - useful for error recovery
 */
export async function resetPlayback(): Promise<void> {
  try {
    await TrackPlayer.reset();
    logger.log('[BackgroundPlayback] TrackPlayer reset complete');
  } catch (error) {
    logger.error('[BackgroundPlayback] Error resetting TrackPlayer:', error);
  }
}

/**
 * Test background playback functionality
 * Call this in development to verify setup
 */
export async function testBackgroundPlayback(): Promise<boolean> {
  try {
    const isReady = await isTrackPlayerReady();
    if (!isReady) {
      logger.warn('[BackgroundPlayback] TrackPlayer not ready for test');
      return false;
    }

    // Test adding a track
    await TrackPlayer.add({
      id: 'test-track',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      title: 'Test Track',
      artist: 'Test Artist',
    });

    // Test playback
    await TrackPlayer.play();
    
    // Wait a moment then pause
    setTimeout(async () => {
      await TrackPlayer.pause();
      await TrackPlayer.reset();
      logger.log('[BackgroundPlayback] Background playback test completed successfully');
    }, 2000);

    return true;
  } catch (error) {
    logger.error('[BackgroundPlayback] Background playback test failed:', error);
    return false;
  }
}
