import TrackPlayer, { Event, State, TrackType } from 'react-native-track-player';
import { Platform } from 'react-native';

/**
 * Background Playback Service
 * 
 * This service runs in the background and handles all remote media control events
 * from notification bar, lock screen, and control center.
 */
export default async function playbackService() {
  console.log('[PlaybackService] Starting background playback service');

  // Remote Play Event - Lock screen / Notification / Control Center play button
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    console.log('[PlaybackService] RemotePlay event received');
    try {
      const state = await TrackPlayer.getState();
      if (state !== State.Playing) {
        await TrackPlayer.play();
        console.log('[PlaybackService] Playback started from remote');
      }
    } catch (error) {
      console.error('[PlaybackService] RemotePlay error:', error);
    }
  });

  // Remote Pause Event - Lock screen / Notification / Control Center pause button
  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    console.log('[PlaybackService] RemotePause event received');
    try {
      const state = await TrackPlayer.getState();
      if (state === State.Playing) {
        await TrackPlayer.pause();
        console.log('[PlaybackService] Playback paused from remote');
      }
    } catch (error) {
      console.error('[PlaybackService] RemotePause error:', error);
    }
  });

  // Remote Next Event - Lock screen / Notification next button
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    console.log('[PlaybackService] RemoteNext event received');
    try {
      await TrackPlayer.skipToNext();
      console.log('[PlaybackService] Skipped to next track');
    } catch (error) {
      console.error('[PlaybackService] RemoteNext error:', error);
    }
  });

  // Remote Previous Event - Lock screen / Notification previous button
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    console.log('[PlaybackService] RemotePrevious event received');
    try {
      await TrackPlayer.skipToPrevious();
      console.log('[PlaybackService] Skipped to previous track');
    } catch (error) {
      console.error('[PlaybackService] RemotePrevious error:', error);
    }
  });

  // Remote Stop Event - Stop button from notification
  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    console.log('[PlaybackService] RemoteStop event received');
    try {
      await TrackPlayer.reset();
      console.log('[PlaybackService] Playback stopped and reset');
    } catch (error) {
      console.error('[PlaybackService] RemoteStop error:', error);
    }
  });

  // Remote Seek Event - Progress bar scrubbing from lock screen/notification
  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    console.log('[PlaybackService] RemoteSeek event received:', event.position);
    try {
      await TrackPlayer.seekTo(event.position);
      console.log('[PlaybackService] Seeked to position:', event.position);
    } catch (error) {
      console.error('[PlaybackService] RemoteSeek error:', error);
    }
  });

  // Remote Jump Forward Event - Fast forward button
  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    console.log('[PlaybackService] RemoteJumpForward event received');
    try {
      const progress = await TrackPlayer.getProgress();
      const jumpAmount = event.interval || 10; // Default 10 seconds
      const newPosition = Math.min(progress.position + jumpAmount, progress.duration);
      await TrackPlayer.seekTo(newPosition);
      console.log('[PlaybackService] Jumped forward', jumpAmount, 'seconds');
    } catch (error) {
      console.error('[PlaybackService] RemoteJumpForward error:', error);
    }
  });

  // Remote Jump Backward Event - Rewind button
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    console.log('[PlaybackService] RemoteJumpBackward event received');
    try {
      const progress = await TrackPlayer.getProgress();
      const jumpAmount = event.interval || 10; // Default 10 seconds
      const newPosition = Math.max(0, progress.position - jumpAmount);
      await TrackPlayer.seekTo(newPosition);
      console.log('[PlaybackService] Jumped backward', jumpAmount, 'seconds');
    } catch (error) {
      console.error('[PlaybackService] RemoteJumpBackward error:', error);
    }
  });

  // Audio Ducking Event - Handle audio interruptions (calls, notifications, etc.)
  TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
    console.log('[PlaybackService] RemoteDuck event received:', event);
    try {
      if (event.permanent) {
        // Permanent duck (like phone call) - pause playback
        await TrackPlayer.pause();
        console.log('[PlaybackService] Paused due to permanent duck (phone call)');
      } else {
        // Temporary duck (like notification sound)
        if (event.paused) {
          await TrackPlayer.pause();
          console.log('[PlaybackService] Paused due to temporary duck');
        } else {
          // Ducking ended, resume playback
          await TrackPlayer.play();
          console.log('[PlaybackService] Resumed after temporary duck');
        }
      }
    } catch (error) {
      console.error('[PlaybackService] RemoteDuck error:', error);
    }
  });

  // Playback State Change Event - Track state changes for debugging
  TrackPlayer.addEventListener(Event.PlaybackState, async (state) => {
    console.log('[PlaybackService] PlaybackState changed:', state.state);
  });

  // Playback Track Changed Event - Track changes for debugging
  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (event) => {
    console.log('[PlaybackService] PlaybackTrackChanged:', {
      track: event.track,
      position: event.position,
      nextTrack: event.nextTrack
    });
  });

  // Playback Queue Ended Event - Queue finished
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    console.log('[PlaybackService] PlaybackQueueEnded:', event);
  });

  // Playback Error Event - Handle playback errors
  TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
    console.error('[PlaybackService] PlaybackError:', error);
    // Attempt to recover by pausing
    try {
      await TrackPlayer.pause();
    } catch (e) {
      // Ignore recovery errors
    }
  });

  // Playback Active Track Changed - iOS specific
  if (Platform.OS === 'ios') {
    TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      console.log('[PlaybackService] PlaybackActiveTrackChanged:', event);
    });
  }

  console.log('[PlaybackService] Background playback service initialized successfully');
}

