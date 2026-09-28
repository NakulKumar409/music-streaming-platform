import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  State,
} from 'react-native-track-player';
import { AppState, Platform } from 'react-native';
import logger from '../utils/logger';
import { getPlaybackDescriptorForSessionRecovery } from './streamService';

// Only resume after a temporary interruption when this service itself paused a
// track that had actually been playing. Never auto-resume user-paused audio.
let resumeAfterTemporaryDuck = false;
let servicePlayIntent = false;
let recoveryInFlight = false;
let lastRecoveredSourceUrl: string | null = null;

/**
 * Background Playback Service
 *
 * Handles remote media controls from notification, lock screen and control
 * center. Product/player state remains authoritative in the foreground app.
 *
 * Next/previous are intentionally not exposed here. The application queue is
 * currently owned by React state and is not synchronized into TrackPlayer's
 * native queue, so advertising those actions while JS is suspended would be
 * misleading and unreliable.
 */
export default async function playbackService() {
  logger.log('[PlaybackService] Starting background playback service');

  // Re-assert the production-safe system capability contract when the native
  // service starts. The foreground provider may be initialized first, but no
  // notification/lock-screen action should advertise a queue operation that
  // the native player cannot execute independently while React is suspended.
  try {
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        alwaysPauseOnInterruption: false,
        stopForegroundGracePeriod: 0,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SeekTo,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.Stop,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SeekTo,
        Capability.Stop,
      ],
      progressUpdateEventInterval: 1,
    });
  } catch (error) {
    logger.error('[PlaybackService] Failed to enforce remote capabilities:', error);
  }

  try {
    servicePlayIntent = (await TrackPlayer.getState()) === State.Playing;
  } catch {
    servicePlayIntent = false;
  }

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      servicePlayIntent = true;
      const state = await TrackPlayer.getState();
      if (state !== State.Playing) await TrackPlayer.play();
    } catch (error) {
      logger.error('[PlaybackService] RemotePlay error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemotePause, async () => {
    try {
      servicePlayIntent = false;
      const state = await TrackPlayer.getState();
      if (state === State.Playing) await TrackPlayer.pause();
      resumeAfterTemporaryDuck = false;
    } catch (error) {
      logger.error('[PlaybackService] RemotePause error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteStop, async () => {
    try {
      servicePlayIntent = false;
      resumeAfterTemporaryDuck = false;
      await TrackPlayer.reset();
    } catch (error) {
      logger.error('[PlaybackService] RemoteStop error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, async (event) => {
    try {
      await TrackPlayer.seekTo(event.position);
    } catch (error) {
      logger.error('[PlaybackService] RemoteSeek error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async (event) => {
    try {
      const progress = await TrackPlayer.getProgress();
      const jumpAmount = event.interval || 10;
      const requestedPosition = Math.max(0, progress.position + jumpAmount);
      const newPosition =
        Number.isFinite(progress.duration) && progress.duration > 0
          ? Math.min(requestedPosition, progress.duration)
          : requestedPosition;
      await TrackPlayer.seekTo(newPosition);
    } catch (error) {
      logger.error('[PlaybackService] RemoteJumpForward error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async (event) => {
    try {
      const progress = await TrackPlayer.getProgress();
      const jumpAmount = event.interval || 10;
      await TrackPlayer.seekTo(Math.max(0, progress.position - jumpAmount));
    } catch (error) {
      logger.error('[PlaybackService] RemoteJumpBackward error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
    try {
      if (event.permanent) {
        servicePlayIntent = false;
        resumeAfterTemporaryDuck = false;
        await TrackPlayer.pause();
        return;
      }

      if (event.paused) {
        const state = await TrackPlayer.getState();
        resumeAfterTemporaryDuck = state === State.Playing;
        if (resumeAfterTemporaryDuck) await TrackPlayer.pause();
        return;
      }

      if (resumeAfterTemporaryDuck) {
        resumeAfterTemporaryDuck = false;
        await TrackPlayer.play();
      }
    } catch (error) {
      resumeAfterTemporaryDuck = false;
      logger.error('[PlaybackService] RemoteDuck error:', error);
    }
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async (state) => {
    logger.log('[PlaybackService] PlaybackState changed:', state.state);
    if (state.state === State.Playing) {
      servicePlayIntent = true;
    } else if (
      state.state === State.Paused &&
      !resumeAfterTemporaryDuck &&
      !recoveryInFlight
    ) {
      servicePlayIntent = false;
    } else if (
      !recoveryInFlight &&
      (state.state === State.Stopped ||
        state.state === State.Ended ||
        state.state === State.None)
    ) {
      servicePlayIntent = false;
    }
    // State.Error deliberately preserves intent until PlaybackError either
    // restores the protected source or fails closed.
  });

  TrackPlayer.addEventListener(Event.PlaybackTrackChanged, async (event) => {
    logger.log('[PlaybackService] PlaybackTrackChanged:', {
      track: event.track,
      position: event.position,
      nextTrack: event.nextTrack,
    });
  });

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    logger.log('[PlaybackService] PlaybackQueueEnded:', event);
  });

  TrackPlayer.addEventListener(Event.PlaybackError, async (error) => {
    logger.error('[PlaybackService] PlaybackError:', error);

    // While the app is active the foreground provider owns recovery so the UI
    // can preserve pending seek state and present a user-readable error if
    // recovery fails. The background service becomes the sole owner only when
    // React UI is inactive/suspended.
    if (AppState.currentState === 'active') return;
    if (recoveryInFlight) return;

    recoveryInFlight = true;
    try {
      const track: any = await TrackPlayer.getActiveTrack();
      const failedUrl = String(track?.url || '');
      const contentId = Number(track?.contentId);
      const sessionId = Number(track?.playbackSessionId);

      if (
        !track ||
        !track.useStreamAccess ||
        !failedUrl ||
        !Number.isSafeInteger(contentId) ||
        contentId <= 0 ||
        !Number.isSafeInteger(sessionId) ||
        sessionId <= 0 ||
        lastRecoveredSourceUrl === failedUrl
      ) {
        servicePlayIntent = false;
        await TrackPlayer.pause().catch(() => undefined);
        return;
      }

      lastRecoveredSourceUrl = failedUrl;
      const progress = await TrackPlayer.getProgress().catch(() => ({
        position: 0,
        duration: 0,
        buffered: 0,
      }));
      const resumePosition = Math.max(0, Number(progress.position) || 0);

      const descriptor = await getPlaybackDescriptorForSessionRecovery(
        contentId,
        sessionId,
        'audio',
        track.preferredQuality
      );

      const replacementTrack = {
        ...track,
        url: descriptor.playbackUrl,
        playbackSessionId: descriptor.sessionId,
      };

      await TrackPlayer.load(replacementTrack);
      if (resumePosition > 0) {
        await TrackPlayer.seekTo(resumePosition);
      }
      if (servicePlayIntent) {
        await TrackPlayer.play();
      }

      logger.log('[PlaybackService] Protected audio source recovered in background', {
        contentId,
        resumedAtSeconds: resumePosition,
      });
    } catch (recoveryError) {
      servicePlayIntent = false;
      logger.error('[PlaybackService] Background audio recovery failed:', recoveryError);
      await TrackPlayer.pause().catch(() => undefined);
    } finally {
      recoveryInFlight = false;
      resumeAfterTemporaryDuck = false;
    }
  });

  if (Platform.OS === 'ios') {
    TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async (event) => {
      logger.log('[PlaybackService] PlaybackActiveTrackChanged:', event);
    });
  }

  logger.log('[PlaybackService] Background playback service initialized');
}
