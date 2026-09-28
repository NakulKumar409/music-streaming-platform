import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, Platform } from "react-native";

import { createVideoPlayer, VideoPlayer } from "expo-video";

import logger from "../utils/logger";

// Try to import TrackPlayer, fallback for Expo Go compatibility
let TrackPlayer: any = null;
let TrackPlayerState: any = null;
let Event: any = null;
let Capability: any = null;
let AppKilledPlaybackBehavior: any = null;
let RepeatMode: any = null;
let PitchAlgorithm: any = null;
let TrackPlayerAvailable = false;

try {
  const TrackPlayerModule = require("react-native-track-player");
  TrackPlayer = TrackPlayerModule.default;
  TrackPlayerState = TrackPlayerModule.State;
  Event = TrackPlayerModule.Event;
  Capability = TrackPlayerModule.Capability;
  AppKilledPlaybackBehavior = TrackPlayerModule.AppKilledPlaybackBehavior;
  RepeatMode = TrackPlayerModule.RepeatMode;
  PitchAlgorithm = TrackPlayerModule.PitchAlgorithm;
  TrackPlayerAvailable = true;
} catch (e) {
  logger.warn(
    "TrackPlayer not available, running in Expo Go without background audio playback"
  );
}

// Type for Track when module is available
type Track = any;

type AudioLoadOptions = {
  resumePositionMs?: number;
  shouldPlay?: boolean;
  recovery?: boolean;
};

import { recordPlayback } from "../services/libraryService";
import {
  adoptActivePlaybackLease,
  getActivePlaybackLease,
  getPlaybackDescriptor,
  getPlaybackDescriptorForRecovery,
  getPlaybackErrorPresentation,
  getPlaybackUrl,
  normalizePlaybackUrl,
  validatePlaybackUrl,
  type VideoQuality,
} from "../services/streamService";
import { evaluateAudioProgressSample } from "../utils/audioProgressSync";
import { toFiniteDurationMs } from "../utils/mediaTime";

import type { MediaItem, PlayerState } from "../media.types";

// Removed SoundLike type as it is no longer needed with expo-audio

type MediaPlayerContextValue = {
  state: PlayerState;
  currentItem: MediaItem | null;
  playQueue: (queue: MediaItem[], index: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  pendingSeekPositionMs: number | null;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  setShuffle: (enabled: boolean) => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: PlayerState["repeatMode"]) => void;
  cycleRepeatMode: () => void;
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  close: () => Promise<void>;
  videoAudioOnlyMode: boolean;
  videoRestoreNonce: number;
  videoRestorePositionMs: number;

  inlineVideoHostActive: boolean;
  setInlineVideoHostActive: (active: boolean) => void;

  inlineAudioHostActive: boolean;
  setInlineAudioHostActive: (active: boolean) => void;

  videoPlayer: VideoPlayer | null;
  audioPlayer: null;
  isPlayerReady: boolean;
  onVideoPlaybackStatusUpdate: (status: any) => void;

  preferredQuality: VideoQuality;
  setPreferredQuality: (q: VideoQuality) => void;
  setExpanded: (expanded: boolean) => void;
};

const MediaPlayerContext = createContext<MediaPlayerContextValue | undefined>(
  undefined
);

const EMPTY_STATE: PlayerState = {
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  isExpanded: false,
  isShuffle: false,
  repeatMode: "off",
  playbackRate: 1,
  volume: 1,
};

export function useMediaPlayer() {
  const ctx = useContext(MediaPlayerContext);
  if (!ctx)
    throw new Error("useMediaPlayer must be used within a MediaPlayerProvider");
  return ctx;
}

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>(EMPTY_STATE);

  const IOS_INTERRUPTION_DO_NOT_MIX = 1;
  const ANDROID_INTERRUPTION_DUCK_OTHERS = 1;

  const [videoAudioOnlyMode, setVideoAudioOnlyMode] = useState(false);
  const [videoRestoreNonce, setVideoRestoreNonce] = useState(0);
  const videoRestorePositionMsRef = useRef(0);

  const [inlineVideoHostActive, setInlineVideoHostActive] = useState(false);
  const [inlineAudioHostActive, setInlineAudioHostActive] = useState(false);

  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const audioPlayer = null;

  // Audio source identity is deliberately kept outside render state. It is used
  // only to reject duplicate recovery for the same failed signed URL.
  const audioSourceRef = useRef<string | null>(null);
  const lastRecoveredAudioSourceRef = useRef<string | null>(null);
  // User playback intent is separate from transient engine state. A source
  // reset during recovery may emit pause/stopped events, but must not override
  // a newer user pause/play action.
  const audioPlayIntentRef = useRef(false);
  const foregroundRecoveryInFlightRef = useRef(false);
  const recoverAudioPlaybackRef = useRef<
    ((input: {
      failedUrl: string;
      resumePositionMs: number;
      shouldPlay: boolean;
      reason?: unknown;
    }) => Promise<boolean>) | null
  >(null);

  // Web fallback: dedicated HTMLAudioElement when TrackPlayer is unavailable (Expo Web / browser)
  const webAudioRef = useRef<any | null>(null);

  // Audio seek coordination. A seek increments the generation so any async
  // progress read that started before it can never overwrite the new target.
  const seekGenerationRef = useRef(0);
  const pendingSeekRef = useRef<{ generation: number; targetMs: number } | null>(null);
  const [pendingSeekPositionMs, setPendingSeekPositionMs] = useState<number | null>(null);
  const skipToIndexRef = useRef<(index: number) => Promise<void>>(async () => {});

  const [videoSource, setVideoSource] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<VideoPlayer | null>(null);

  // Lazy initialization of VideoPlayer to avoid "Activity not available" crash at startup
  useEffect(() => {
    let isMounted = true;

    // Defer creation to the first effect run (after initial render/mount)
    // this ensures the Android Activity is ready for the native module.
    try {
      logger.log("[MediaPlayer] Initializing VideoPlayer lazily...");
      const player = createVideoPlayer(videoSource);

      // Configure background playback capabilities
      player.showNowPlayingNotification = true;
      player.staysActiveInBackground = true;
      player.timeUpdateEventInterval = 0.1; // 100ms updates for smooth seekbar

      if (isMounted) {
        setVideoPlayer(player);
        logger.log("[MediaPlayer] VideoPlayer initialized successfully");
      }
    } catch (e) {
      logger.error(
        "[MediaPlayer] Failed to create VideoPlayer in useEffect",
        e
      );
    }

    return () => {
      isMounted = false;
      // Note: VideoPlayer will be cleaned up by native garbage collection
      // or we could explicitly null it if needed in future versions.
    };
  }, []); // Run only once on mount

  // Keep player in sync with source changes
  useEffect(() => {
    if (videoPlayer && videoSource) {
      try {
        videoPlayer.replace(videoSource);
        // Reset state for new source
        setState((s) => ({ ...s, positionMs: 0, durationMs: 0 }));
      } catch (e) {
        logger.warn("[MediaPlayer] Failed to replace video source", e);
      }
    }
  }, [videoSource, videoPlayer]);

  // Sync video player native events to context state
  useEffect(() => {
    if (!videoPlayer) return;

    logger.log("[MediaPlayer] Attaching VideoPlayer event listeners");

    const playingSub = videoPlayer.addListener("playingChange", (event) => {
      setState((s) => ({ ...s, isPlaying: event.isPlaying }));
    });

    const timeSub = videoPlayer.addListener("timeUpdate", (event) => {
      const pos = Math.round(event.currentTime * 1000);
      setState((s) => {
        // Only update if difference is significant or it's a state change
        // this helps reduce unnecessary re-renders while keeping 100ms smoothness.
        if (Math.abs(s.positionMs - pos) < 50 && s.isPlaying) return s;
        return { ...s, positionMs: pos };
      });
    });

    const sourceSub = videoPlayer.addListener("sourceLoad", (event) => {
      if (event.duration > 0) {
        setState((s) => ({
          ...s,
          durationMs: Math.round(event.duration * 1000),
        }));
      }
    });

    return () => {
      playingSub.remove();
      timeSub.remove();
      sourceSub.remove();
    };
  }, [videoPlayer]);

  const [preferredQuality, setPreferredQuality] =
    useState<VideoQuality>("Auto");

  const audioLoadTokenRef = useRef(0);
  const mediaSelectionTokenRef = useRef(0);

  const cancelPendingMediaSelection = useCallback(() => {
    mediaSelectionTokenRef.current += 1;
  }, []);

  const cancelPendingAudioLoad = useCallback(() => {
    audioLoadTokenRef.current += 1;
    foregroundRecoveryInFlightRef.current = false;
  }, []);

  const currentItem = state.queue.length
    ? state.queue[state.currentIndex] ?? null
    : null;

  const lastVideoContentKeyRef = useRef<string | null>(null);

  const playbackRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const lastRecordedRef = useRef<string | null>(null);

  const stateRef = useRef<PlayerState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearPendingSeek = useCallback((generation?: number) => {
    const pending = pendingSeekRef.current;
    if (!pending) return;
    if (generation !== undefined && pending.generation !== generation) return;
    pendingSeekRef.current = null;
    setPendingSeekPositionMs(null);
  }, []);

  const resetSeekCoordinator = useCallback(() => {
    // Invalidate every in-flight progress read and clear any seek owned by the
    // previous source. This is required on reset/track change.
    seekGenerationRef.current += 1;
    pendingSeekRef.current = null;
    setPendingSeekPositionMs(null);
  }, []);

  const beginPendingSeek = useCallback((targetMs: number) => {
    const generation = seekGenerationRef.current + 1;
    seekGenerationRef.current = generation;
    pendingSeekRef.current = { generation, targetMs };
    setPendingSeekPositionMs(targetMs);
    return generation;
  }, []);

  const applyAudioProgress = useCallback(
    (positionMs: number, durationMs: number, generationAtRead?: number) => {
      const safePosition = Math.max(0, Math.round(positionMs));
      const safeDuration =
        Number.isFinite(durationMs) && durationMs > 0
          ? Math.round(durationMs)
          : 0;

      const pending = pendingSeekRef.current;
      const decision = evaluateAudioProgressSample({
        positionMs: safePosition,
        generationAtRead,
        currentGeneration: seekGenerationRef.current,
        pendingSeek: pending,
      });

      if (!decision.accept) return false;
      if (decision.confirmsSeek && pending) {
        clearPendingSeek(pending.generation);
      }

      setState((s) => {
        const nextDuration = safeDuration > 0 ? safeDuration : s.durationMs;
        if (
          s.positionMs === safePosition &&
          s.durationMs === nextDuration
        ) {
          return s;
        }
        return {
          ...s,
          positionMs: safePosition,
          durationMs: nextDuration,
        };
      });
      return true;
    },
    [clearPendingSeek]
  );

  useEffect(() => {
    // Skip TrackPlayer setup if not available (Expo Go compatibility)
    if (!TrackPlayerAvailable) {
      setIsPlayerReady(true); // Mark as ready even without TrackPlayer
      logger.log(
        "[MediaPlayer] TrackPlayer not available, audio playback disabled in Expo Go"
      );
      return;
    }

    let unmounted = false;
    const setup = async () => {
      let isSetup = false;
      try {
        await TrackPlayer.getActiveTrackIndex();
        isSetup = true;
      } catch {
        await TrackPlayer.setupPlayer({
          autoHandleInterruptions: true,
          autoUpdateMetadata: true,
        });
        isSetup = true;
      }

      if (isSetup) {
        await TrackPlayer.updateOptions({
          android: {
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior?.StopPlaybackAndRemoveNotification,
            alwaysPauseOnInterruption: false,
            // Keep notification visible when paused
            stopForegroundGracePeriod: 0,
          },
          // Main capabilities shown in notification/lock screen
          // Keep this identical to playbackService.ts. The React queue is not
          // mirrored into TrackPlayer's native queue, so advertising native
          // next/previous would be unreliable once the app is backgrounded.
          capabilities: [
            Capability?.Play,
            Capability?.Pause,
            Capability?.SeekTo,
            Capability?.JumpForward,
            Capability?.JumpBackward,
            Capability?.Stop,
          ],
          compactCapabilities: [
            Capability?.Play,
            Capability?.Pause,
          ],
          notificationCapabilities: [
            Capability?.Play,
            Capability?.Pause,
            Capability?.SeekTo,
            Capability?.Stop,
          ],
        });
        if (!unmounted) setIsPlayerReady(true);
        logger.log(
          "[MediaPlayer] TrackPlayer setup complete with background capabilities"
        );
      }
    };
    setup();
    return () => {
      unmounted = true;
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      logger.log("App state changed to:", next);
      const item = currentItemRef.current;
      const s = stateRef.current;

      if (next !== "active") {
        if (item?.mediaType === "video" && s.isPlaying) {
          // Do NOT pause. Keep playback going, but mark UI as audio-only.
          videoRestorePositionMsRef.current = s.positionMs;
          setVideoAudioOnlyMode(true);
          // setAudioModeAsync removed for TrackPlayer

          // iOS can briefly pause the playback object during the transition; force resume.
          (async () => {
            if (!videoPlayer) return;
            try {
              videoPlayer.volume = 1.0;
            } catch {
              // ignore
            }
            try {
              videoPlayer.play();
            } catch {
              // ignore
            }
          })().catch(() => undefined);
        }
        return;
      }

      // Back to active: reconcile protected native audio first. Background
      // recovery can rotate both URL and server session while React is suspended.
      if (item?.mediaType === "audio" && TrackPlayerAvailable) {
        void (async () => {
          try {
            const activeTrack: any = await TrackPlayer.getActiveTrack();
            if (!activeTrack) {
              audioSourceRef.current = null;
              audioPlayIntentRef.current = false;
              resetSeekCoordinator();
              setState((prev) => ({
                ...prev,
                isPlaying: false,
                positionMs: 0,
              }));
              return;
            }

            const expectedContentId = String(item.contentId ?? item.id);
            const nativeContentId = String(
              activeTrack.contentId ?? activeTrack.id ?? ""
            );
            if (
              nativeContentId &&
              expectedContentId &&
              nativeContentId !== expectedContentId
            ) {
              logger.warn("[MediaPlayer] Native audio track does not match React queue", {
                expectedContentId,
                nativeContentId,
              });
              return;
            }

            const nativeUrl = String(activeTrack.url || "");
            if (nativeUrl) {
              audioSourceRef.current = nativeUrl;
            }

            if (activeTrack.useStreamAccess) {
              const contentId = item.contentId ?? item.id;
              const nativeSessionId = Number(activeTrack.playbackSessionId);
              const cachedLease = getActivePlaybackLease(contentId);

              if (
                !cachedLease ||
                cachedLease.sessionId === nativeSessionId
              ) {
                adoptActivePlaybackLease(contentId, nativeSessionId);
              } else {
                // A heartbeat/recovery path already installed a newer lease
                // while React was suspended. Never overwrite it with stale
                // session metadata from the still-loaded native source.
                logger.warn(
                  "[MediaPlayer] Preserving newer foreground playback lease",
                  {
                    contentId,
                    nativeSessionId,
                    cachedSessionId: cachedLease.sessionId,
                  }
                );
              }
            }

            // React may have been suspended while lock-screen controls changed
            // native playback. Reconcile explicit native play/pause/terminal
            // states so the foreground button and heartbeat cannot return stale.
            const nativeState = await TrackPlayer.getState();
            if (nativeState === TrackPlayerState?.Playing) {
              audioPlayIntentRef.current = true;
              setState((prev) =>
                prev.isPlaying ? prev : { ...prev, isPlaying: true }
              );
            } else if (
              nativeState === TrackPlayerState?.Paused ||
              nativeState === TrackPlayerState?.Stopped ||
              nativeState === TrackPlayerState?.Ended
            ) {
              audioPlayIntentRef.current = false;
              setState((prev) =>
                prev.isPlaying ? { ...prev, isPlaying: false } : prev
              );
            } else if (
              nativeState === TrackPlayerState?.Error ||
              nativeState === TrackPlayerState?.None
            ) {
              // Error/None may be observed while a protected source is being
              // replaced. Reflect the engine as not playing but preserve the
              // user's intent until recovery definitively succeeds or fails.
              setState((prev) =>
                prev.isPlaying ? { ...prev, isPlaying: false } : prev
              );
            }
          } catch (error) {
            logger.warn("[MediaPlayer] Failed to reconcile native audio on foreground", error);
          }
        })();
      }

      // Back to active: re-show video and ask consumers to restore position.
      if (videoAudioOnlyMode) {
        setVideoAudioOnlyMode(false);
        setVideoRestoreNonce((n) => n + 1);

        // Best-effort: keep volume at 1.0 and re-assert play if we were playing.
        if (s.isPlaying) {
          (async () => {
            if (!videoPlayer) return;
            try {
              videoPlayer.volume = 1.0;
            } catch {
              // ignore
            }
            try {
              videoPlayer.play();
            } catch {
              // ignore
            }
          })().catch(() => undefined);
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, [videoAudioOnlyMode, videoPlayer, resetSeekCoordinator]);

  useEffect(() => {
    if (!currentItem?.id || !state.isPlaying) return;

    const key = `${currentItem.contentId ?? currentItem.id}`;

    // This effect owns UX playback-history recording only. Trusted heartbeat
    // lifecycle is owned once, at App level, by PlaybackHeartbeatLifecycleBridge.
    if (lastRecordedRef.current !== key) {
      if (playbackRecordTimerRef.current) {
        clearTimeout(playbackRecordTimerRef.current);
        playbackRecordTimerRef.current = null;
      }

      playbackRecordTimerRef.current = setTimeout(() => {
        lastRecordedRef.current = key;
        recordPlayback(key).catch(() => undefined);
      }, 500);
    }

    return () => {
      if (playbackRecordTimerRef.current) {
        clearTimeout(playbackRecordTimerRef.current);
        playbackRecordTimerRef.current = null;
      }
    };
  }, [currentItem?.id, state.isPlaying]);

  const currentItemRef = useRef<MediaItem | null>(currentItem);
  useEffect(() => {
    currentItemRef.current = currentItem;
  }, [currentItem]);

  useEffect(() => {
    const item = currentItem;
    if (!item) return;
    if (item.mediaType !== "video") return;

    const key = String(item.contentId ?? item.id);
    if (lastVideoContentKeyRef.current === key) return;
    lastVideoContentKeyRef.current = key;

    // Ensure a new video never inherits the previous video's position.
    setState((s) => ({
      ...s,
      positionMs: 0,
    }));

    // Video ref may not be mounted/loaded yet; best-effort seek after a tick.
    const t = setTimeout(() => {
      videoPlayer?.seekBy(-videoPlayer.currentTime);
    }, 0);

    return () => {
      clearTimeout(t);
    };
  }, [currentItem, videoPlayer]);

  const applyPlaybackConfigToCurrent = useCallback(async () => {
    const s = stateRef.current;
    const item = currentItemRef.current;
    if (!item) return;

    if (item.mediaType === "audio" && TrackPlayerAvailable) {
      try {
        await TrackPlayer.setRate(s.playbackRate);
      } catch {
        // ignore
      }
      try {
        await TrackPlayer.setVolume(s.volume);
      } catch {
        // ignore
      }
      return;
    }

    if (!videoPlayer) return;
    try {
      videoPlayer.playbackRate = s.playbackRate;
    } catch {
      // ignore
    }
    try {
      videoPlayer.volume = s.volume;
    } catch {
      // ignore
    }
  }, [videoPlayer]);

  const shuffleQueueKeepCurrent = useCallback(
    (queue: MediaItem[], currentIndex: number) => {
      if (queue.length <= 1) return { queue, currentIndex };
      const current = queue[currentIndex];
      const rest = queue.filter((_, idx) => idx !== currentIndex);
      for (let i = rest.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = rest[i];
        rest[i] = rest[j];
        rest[j] = tmp;
      }
      return { queue: [current, ...rest], currentIndex: 0 };
    },
    []
  );

  const handleDidJustFinish = useCallback(async () => {
    const s = stateRef.current;
    const item = currentItemRef.current;
    if (!item) return;

    if (s.repeatMode === "one") {
      if (item.mediaType === "audio") {
        const generation = beginPendingSeek(0);
        try {
          if (TrackPlayerAvailable) {
            await TrackPlayer.seekTo(0);
            await TrackPlayer.play();
          } else if (webAudioRef.current) {
            // Web completion is confirmed by the HTMLMediaElement 'seeked' event.
            webAudioRef.current.currentTime = 0;
            await webAudioRef.current.play();
          } else {
            clearPendingSeek(generation);
          }
        } catch {
          clearPendingSeek(generation);
        }
        return;
      }

      try {
        if (videoPlayer) {
          videoPlayer.seekBy(-videoPlayer.currentTime);
          videoPlayer.play();
        }
      } catch {
        // ignore
      }
      return;
    }

    const isLast = s.currentIndex >= Math.max(0, s.queue.length - 1);
    if (isLast && s.repeatMode === "off") {
      if (item.mediaType === "audio") {
        audioPlayIntentRef.current = false;
      }
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        positionMs: prev.durationMs,
      }));
      return;
    }

    const nextIndex = s.queue.length
      ? (s.currentIndex + 1) % s.queue.length
      : 0;
    // Use the latest skip implementation without capturing the first render's
    // load callbacks in this finish handler.
    await skipToIndexRef.current(nextIndex);
  }, [beginPendingSeek, clearPendingSeek, videoPlayer]);

  const onVideoPlaybackStatusUpdate = useCallback((status: any) => {
    void status;
  }, []);

  const unloadAudio = useCallback(async () => {
    resetSeekCoordinator();
    audioSourceRef.current = null;
    // Tear down web audio element
    if (!TrackPlayerAvailable && webAudioRef.current) {
      try {
        const wa = webAudioRef.current;
        wa.pause();
        wa.src = '';
        wa.load();
      } catch {
        // ignore
      }
      webAudioRef.current = null;
    }
    if (TrackPlayerAvailable) {
      try {
        await TrackPlayer.reset();
      } catch {
        // ignore
      }
    }
  }, [resetSeekCoordinator]);

  const stopVideo = useCallback(async () => {
    videoPlayer?.pause();
  }, [videoPlayer]);

  const blockLockedPlayback = useCallback(async (item: MediaItem) => {
    if (item.isLocked) {
      Alert.alert(
        "Subscription Required",
        `Full access to "${item.title}" requires a subscription to ${
          item.artistName || "this artist"
        }.`,
        [{ text: "Dismiss", style: "cancel" }]
      );
      return true;
    }
    return false;
  }, []);

  const loadAndPlayAudio = useCallback(
    async (item: MediaItem, options: AudioLoadOptions = {}) => {
      if (await blockLockedPlayback(item)) return;
      const resumePositionMs = Math.max(
        0,
        Math.round(options.resumePositionMs ?? 0)
      );
      const shouldPlay = options.shouldPlay ?? true;
      if (!options.recovery) {
        // A direct user selection/retry supersedes any older automatic
        // recovery. The load generation below will make that older work stale.
        foregroundRecoveryInFlightRef.current = false;
        lastRecoveredAudioSourceRef.current = null;
        audioPlayIntentRef.current = shouldPlay;
      }

      const loadToken = (audioLoadTokenRef.current += 1);
      const isCurrentLoad = () => loadToken === audioLoadTokenRef.current;
      const failCurrentInitialLoad = () => {
        if (!isCurrentLoad() || options.recovery) return;
        audioPlayIntentRef.current = false;
        setState((s) => ({ ...s, isPlaying: false }));
      };

      await stopVideo();

      // stopVideo() can yield long enough for a newer user selection to win.
      // Never let that older request destructively reset the newer source.
      if (!isCurrentLoad()) return;

      await unloadAudio();

      // If another load started while unload/reset was in flight, abort before
      // resolving access or mutating the newly selected source.
      if (!isCurrentLoad()) return;

      let playbackUrl = item.mediaUrl
        ? normalizePlaybackUrl(item.mediaUrl)
        : null;
      let playbackSessionId: number | null = null;

      // Always fetch a fresh playback descriptor if stream access is required.
      // Do not reuse the `mediaUrl` populated by the initial list fetch because the JWT token might have expired.
      if (item.useStreamAccess) {
        try {
          const descriptor = await (
            options.recovery
              ? getPlaybackDescriptorForRecovery
              : getPlaybackDescriptor
          )(
            item.contentId ?? item.id,
            "audio",
            preferredQuality
          );
          playbackUrl = descriptor.playbackUrl;
          playbackSessionId = descriptor.sessionId;
        } catch (e) {
          const presentation = getPlaybackErrorPresentation(e);
          logger.warn("[MediaPlayer] getPlaybackUrl failed", e);
          if (!options.recovery && isCurrentLoad()) {
            failCurrentInitialLoad();
            Alert.alert(presentation.title, presentation.message);
          }
          return;
        }
      }

      // Fallback: if still no URL but we have an item ID, try canonical stream resolution anyway.
      if (!playbackUrl && (item.contentId || item.id)) {
        try {
          const descriptor = await getPlaybackDescriptor(
            item.contentId ?? item.id,
            "audio",
            preferredQuality
          );
          if (descriptor.playbackUrl) {
            playbackUrl = normalizePlaybackUrl(descriptor.playbackUrl);
            playbackSessionId = descriptor.sessionId;
            logger.log(
              "[MediaPlayer] Used fallback stream URL for",
              item.title
            );
          }
        } catch (e) {
          const presentation = getPlaybackErrorPresentation(e);
          logger.warn("[MediaPlayer] fallback stream resolution failed", e);
          if (!options.recovery && isCurrentLoad()) {
            failCurrentInitialLoad();
            Alert.alert(presentation.title, presentation.message);
          }
          return;
        }
      }

      if (!playbackUrl) {
        if (!options.recovery && isCurrentLoad()) {
          failCurrentInitialLoad();
          Alert.alert(
            "Playback Error",
            "No playback URL available for this track."
          );
        }
        return;
      }
      if (!validatePlaybackUrl(playbackUrl, "audio")) {
        if (!options.recovery && isCurrentLoad()) {
          failCurrentInitialLoad();
          Alert.alert("Playback Error", "Received an invalid audio source URL.");
        }
        return;
      }

      // A newer selection may have won while access/source resolution was in
      // flight. The older request must never replace that newer source.
      if (!isCurrentLoad()) return;

      // track-player automatically handles background audio settings when configured with capabilities

      // Check if TrackPlayer is available (Expo Go / Web compatibility)
      if (!TrackPlayerAvailable) {
        try {
          logger.log("[MediaPlayer] TrackPlayer not available, using HTMLAudioElement for audio on web");

          // Tear down any previous web audio element
          if (webAudioRef.current) {
            try {
              webAudioRef.current.pause();
              webAudioRef.current.src = '';
              webAudioRef.current.load();
            } catch { /* ignore */ }
          }

          // Configure the element before assigning src. Creating Audio(url)
          // can start a request immediately and race crossOrigin/metadata
          // listeners on fast or cached responses.
          const wa = typeof Audio !== 'undefined' ? new (Audio as any)() : null;
          if (!wa) {
            if (audioSourceRef.current === playbackUrl) {
              audioSourceRef.current = null;
            }
            failCurrentInitialLoad();
            logger.warn("[MediaPlayer] HTMLAudioElement not available, cannot play audio on this platform");
            return;
          }

          if (!isCurrentLoad()) {
            try {
              wa.pause();
              wa.src = "";
            } catch {
              // ignore stale element cleanup failures
            }
            return;
          }

          webAudioRef.current = wa;
          audioSourceRef.current = playbackUrl;
          // Plain <audio> playback does not need CORS-enabled pixel/audio
          // extraction. Avoid forcing anonymous CORS on signed provider URLs.
          wa.preload = 'auto';

          // Wire DOM events → context state (real source of truth, no fake timers)
          const syncDuration = () => {
            const dur = isFinite(wa.duration) && wa.duration > 0 ? Math.round(wa.duration * 1000) : 0;
            if (dur > 0) {
              setState((s) => ({ ...s, durationMs: dur }));
            }
          };

          const isCurrentWebAudio = () =>
            webAudioRef.current === wa &&
            loadToken === audioLoadTokenRef.current;

          wa.addEventListener('loadedmetadata', () => {
            if (isCurrentWebAudio()) syncDuration();
          });
          wa.addEventListener('durationchange', () => {
            if (isCurrentWebAudio()) syncDuration();
          });
          wa.addEventListener('canplay', () => {
            if (isCurrentWebAudio()) syncDuration();
          });

          wa.addEventListener('timeupdate', () => {
            if (!isCurrentWebAudio()) return;
            const pos = Math.round((wa.currentTime || 0) * 1000);
            const dur =
              Number.isFinite(wa.duration) && wa.duration > 0
                ? Math.round(wa.duration * 1000)
                : 0;
            applyAudioProgress(pos, dur);
          });
          wa.addEventListener('seeked', () => {
            if (!isCurrentWebAudio()) return;
            const pos = Math.round((wa.currentTime || 0) * 1000);
            const dur =
              Number.isFinite(wa.duration) && wa.duration > 0
                ? Math.round(wa.duration * 1000)
                : 0;
            applyAudioProgress(pos, dur, seekGenerationRef.current);
          });
          wa.addEventListener('play', () => {
            if (!isCurrentWebAudio()) return;
            setState((s) => ({ ...s, isPlaying: true }));
          });
          wa.addEventListener('pause', () => {
            if (!isCurrentWebAudio()) return;
            setState((s) => ({ ...s, isPlaying: false }));
          });
          wa.addEventListener('ended', () => {
            if (!isCurrentWebAudio()) return;
            setState((s) => ({ ...s, isPlaying: false, positionMs: s.durationMs }));
            handleDidJustFinish();
          });
          wa.addEventListener('error', (e: any) => {
            if (!isCurrentWebAudio()) return;
            logger.warn('[MediaPlayer] HTMLAudioElement error', e);

            const recovery = recoverAudioPlaybackRef.current;
            if (foregroundRecoveryInFlightRef.current) return;

            const pendingTargetMs = pendingSeekRef.current?.targetMs;
            const resumeMs =
              pendingTargetMs !== undefined
                ? pendingTargetMs
                : Math.max(
                    stateRef.current.positionMs,
                    Math.max(0, Math.round((wa.currentTime || 0) * 1000))
                  );
            const shouldResume = audioPlayIntentRef.current;
            if (!recovery) {
              setState((s) => ({ ...s, isPlaying: false }));
              return;
            }

            foregroundRecoveryInFlightRef.current = true;
            void recovery({
              failedUrl: playbackUrl,
              resumePositionMs: resumeMs,
              shouldPlay: shouldResume,
              reason: e,
            })
              .then((recovered) => {
                if (!recovered) {
                  audioPlayIntentRef.current = false;
                  setState((s) => ({ ...s, isPlaying: false }));
                  if (AppState.currentState === "active") {
                    Alert.alert(
                      "Playback interrupted",
                      "The audio stream could not be restored. Please try playing it again."
                    );
                  }
                }
              })
              .finally(() => {
                foregroundRecoveryInFlightRef.current = false;
              });
          });

          // Start network loading only after all source lifecycle listeners are
          // installed so loadedmetadata/durationchange cannot be missed.
          wa.src = playbackUrl;
          wa.load();

          const seededDuration = toFiniteDurationMs(item.duration);
          setState((s) => ({
            ...s,
            positionMs: resumePositionMs,
            durationMs: seededDuration > 0 ? seededDuration : s.durationMs,
            isPlaying: false,
          }));

          const restoreAndMaybePlay = async () => {
            if (!isCurrentWebAudio()) return;

            if (resumePositionMs > 0) {
              const generation = beginPendingSeek(resumePositionMs);
              try {
                wa.currentTime = resumePositionMs / 1000;
              } catch (error) {
                clearPendingSeek(generation);
                throw error;
              }
            }

            const shouldPlayAtCommit = options.recovery
              ? audioPlayIntentRef.current
              : shouldPlay;
            if (!shouldPlayAtCommit) return;
            try {
              await wa.play();
            } catch (err: any) {
              if (err?.name !== 'AbortError') {
                logger.warn('[MediaPlayer] HTMLAudioElement play() failed', err);
                setState((s) => ({ ...s, isPlaying: false }));
              }
            }
          };

          if (wa.readyState >= 1) {
            syncDuration();
            void restoreAndMaybePlay();
          } else {
            wa.addEventListener('loadedmetadata', () => {
              void restoreAndMaybePlay();
            }, { once: true });
          }
        } catch (err) {
          if (audioSourceRef.current === playbackUrl) {
            audioSourceRef.current = null;
          }
          failCurrentInitialLoad();
          logger.warn("[MediaPlayer] HTMLAudioElement fallback for audio failed", err);
        }
        return;
      }

      try {
        logger.log("[MediaPlayer] Loading audio", { playbackUrl });

        // Build track metadata for notification/lock screen display
        // Use artworkUrl from MediaItem type - this is the correct field for artwork
        const artworkUrl = item.artworkUrl || undefined;

        const track: Track = {
          id: item.id.toString(),
          url: playbackUrl,
          title: item.title || "Unknown Title",
          artist: item.artistName || "Unknown Artist",
          artwork: artworkUrl,
          // Additional metadata for better lock screen display
          album: (item as any).albumName || undefined,
          duration: item.duration ? item.duration / 1000 : undefined, // Convert ms to seconds
          // Preserve protected-playback identity inside RNTP so the background
          // service can recover an expired source without React state.
          contentId: String(item.contentId ?? item.id),
          playbackSessionId: playbackSessionId ?? undefined,
          useStreamAccess: Boolean(item.useStreamAccess),
          preferredQuality,
          // For proper notification styling
          isLiveStream: false,
        };

        logger.log("[MediaPlayer] Adding track to TrackPlayer:", {
          id: track.id,
          title: track.title,
          artist: track.artist,
          hasArtwork: !!track.artwork,
        });

        await TrackPlayer.reset();
        if (!isCurrentLoad()) return;

        await TrackPlayer.add([track]);
        if (!isCurrentLoad()) return;

        audioSourceRef.current = playbackUrl;

        const seededDuration = toFiniteDurationMs(item.duration);
        setState((s) => ({
          ...s,
          positionMs: resumePositionMs,
          durationMs: seededDuration > 0 ? seededDuration : s.durationMs,
          isPlaying: false,
        }));

        let restoreSeekGeneration: number | null = null;
        if (resumePositionMs > 0) {
          restoreSeekGeneration = beginPendingSeek(resumePositionMs);
          try {
            await TrackPlayer.seekTo(resumePositionMs / 1000);
          } catch (error) {
            clearPendingSeek(restoreSeekGeneration);
            throw error;
          }
          if (!isCurrentLoad()) return;
        }

        const shouldPlayAtCommit = options.recovery
          ? audioPlayIntentRef.current
          : shouldPlay;
        if (shouldPlayAtCommit) {
          await TrackPlayer.play();
          if (isCurrentLoad()) {
            setState((s) => ({ ...s, isPlaying: true }));
          }
        }

        logger.log("[MediaPlayer] Audio source loaded successfully", {
          recovered: Boolean(options.recovery),
          resumePositionMs,
          shouldPlay: shouldPlayAtCommit,
        });
      } catch (err) {
        if (audioSourceRef.current === playbackUrl) {
          audioSourceRef.current = null;
        }
        failCurrentInitialLoad();
        logger.warn("[MediaPlayer] Failed to create or play audio", err);
        if (!options.recovery && isCurrentLoad()) {
          Alert.alert(
            "Playback Error",
            "Could not start audio playback. Please check the media URL and try again."
          );
        }
      }
    },
    [
      stopVideo,
      audioPlayer,
      applyAudioProgress,
      beginPendingSeek,
      clearPendingSeek,
      handleDidJustFinish,
      preferredQuality,
      unloadAudio,
      blockLockedPlayback,
    ]
  );

  const recoverAudioPlayback = useCallback(
    async (input: {
      failedUrl: string;
      resumePositionMs: number;
      shouldPlay: boolean;
      reason?: unknown;
    }): Promise<boolean> => {
      const item = currentItemRef.current;
      if (!item || item.mediaType !== "audio" || !item.useStreamAccess) {
        return false;
      }

      // Ignore a late error emitted by a source that is no longer active.
      if (!input.failedUrl || audioSourceRef.current !== input.failedUrl) {
        return true;
      }

      // One recovery attempt per concrete failed URL. A successfully refreshed
      // source gets a new URL and can independently recover if it expires later.
      if (lastRecoveredAudioSourceRef.current === input.failedUrl) {
        return false;
      }
      lastRecoveredAudioSourceRef.current = input.failedUrl;

      logger.warn("[MediaPlayer] Recovering failed protected audio source", {
        contentId: item.contentId ?? item.id,
        resumePositionMs: input.resumePositionMs,
        reason:
          input.reason instanceof Error
            ? input.reason.message
            : String(input.reason || "media-source-error"),
      });

      try {
        await loadAndPlayAudio(item, {
          resumePositionMs: input.resumePositionMs,
          shouldPlay: input.shouldPlay,
          recovery: true,
        });

        return Boolean(
          audioSourceRef.current &&
          audioSourceRef.current !== input.failedUrl
        );
      } catch (error) {
        logger.warn("[MediaPlayer] Protected audio recovery failed", error);
        return false;
      }
    },
    [loadAndPlayAudio]
  );

  useEffect(() => {
    recoverAudioPlaybackRef.current = recoverAudioPlayback;
    return () => {
      if (recoverAudioPlaybackRef.current === recoverAudioPlayback) {
        recoverAudioPlaybackRef.current = null;
      }
    };
  }, [recoverAudioPlayback]);

  const prepareVideo = useCallback(async () => {
    cancelPendingAudioLoad();
    audioPlayIntentRef.current = false;
    await unloadAudio();
  }, [cancelPendingAudioLoad, unloadAudio]);

  const playQueue = useCallback(
    async (queue: MediaItem[], index: number) => {
      const safeIndex = Math.min(
        Math.max(0, index),
        Math.max(0, queue.length - 1)
      );
      const nextState = stateRef.current.isShuffle
        ? shuffleQueueKeepCurrent(queue, safeIndex)
        : { queue, currentIndex: safeIndex };

      let item = nextState.queue[nextState.currentIndex];
      if (!item) return;

      // A denied selection must not replace the visible/current item while the
      // previously authorized source is still playing.
      if (await blockLockedPlayback(item)) return;

      const selectionToken = mediaSelectionTokenRef.current + 1;
      mediaSelectionTokenRef.current = selectionToken;
      const isCurrentSelection = () =>
        selectionToken === mediaSelectionTokenRef.current;

      if (item.mediaType === "video" && item.useStreamAccess) {
        try {
          const url = await getPlaybackUrl(
            item.contentId ?? item.id,
            "video",
            preferredQuality
          );
          if (!isCurrentSelection()) return;
          if (!validatePlaybackUrl(url, "video")) {
            Alert.alert(
              "Playback Error",
              "Received an invalid video source URL."
            );
            return;
          }
          item = { ...item, mediaUrl: url };
          nextState.queue[nextState.currentIndex] = item;
          currentItemRef.current = item;
        } catch (e) {
          if (!isCurrentSelection()) return;
          const presentation = getPlaybackErrorPresentation(e);
          logger.warn("[MediaPlayer] getPlaybackUrl for video failed", e);
          Alert.alert(presentation.title, presentation.message);
          return;
        }
      }

      if (!isCurrentSelection()) return;

      // Commit internal identity only after all authorization/source
      // resolution for the selected item has succeeded.
      currentItemRef.current = item;
      setState((s) => ({
        ...s,
        queue: nextState.queue,
        currentIndex: nextState.currentIndex,
        positionMs: 0,
        durationMs: toFiniteDurationMs(item.duration),
        isExpanded: false,
        // A newly selected audio track is not "playing" until its source has
        // actually loaded and the engine accepts play().
        isPlaying: item.mediaType === "video",
      }));

      if (item.mediaType === "audio") {
        await loadAndPlayAudio(item);
        return;
      }

      await prepareVideo();
      if (!isCurrentSelection()) return;
      setState((s) => ({ ...s, isPlaying: true }));
      // actual play is handled by Video component when it renders with shouldPlay
    },
    [
      blockLockedPlayback,
      loadAndPlayAudio,
      prepareVideo,
      preferredQuality,
      shuffleQueueKeepCurrent,
    ]
  );

  const togglePlayPause = useCallback(async () => {
    const item = currentItemRef.current;
    if (!item || stateRef.current.queue.length === 0) return;

    if (item.mediaType === "audio") {
      if (!TrackPlayerAvailable) {
        // Web fallback: use HTMLAudioElement. If a failed recovery tore the
        // element down, Play is an explicit retry of the current track.
        const wa = webAudioRef.current;
        if (!wa || !audioSourceRef.current) {
          audioPlayIntentRef.current = true;
          await loadAndPlayAudio(item, {
            resumePositionMs: stateRef.current.positionMs,
            shouldPlay: true,
          });
          return;
        }

        if (stateRef.current.isPlaying) {
          audioPlayIntentRef.current = false;
          wa.pause();
          // state updated by 'pause' DOM event
        } else {
          audioPlayIntentRef.current = true;
          const p = wa.play();
          if (p && typeof p.catch === 'function') {
            p.catch((err: any) => {
              if (err?.name !== 'AbortError') logger.warn('[MediaPlayer] togglePlayPause play() failed', err);
            });
          }
          // state updated by 'play' DOM event
        }
        return;
      }
      try {
        const isCurrentlyPlaying = stateRef.current.isPlaying;
        if (isCurrentlyPlaying) {
          audioPlayIntentRef.current = false;
          await TrackPlayer.pause();
          setState((s) => ({ ...s, isPlaying: false }));
        } else if (!audioSourceRef.current) {
          audioPlayIntentRef.current = true;
          await loadAndPlayAudio(item, {
            resumePositionMs: stateRef.current.positionMs,
            shouldPlay: true,
          });
        } else {
          audioPlayIntentRef.current = true;
          await TrackPlayer.play();
          setState((s) => ({ ...s, isPlaying: true }));
        }
      } catch (err) {
        audioPlayIntentRef.current = false;
        setState((s) => ({ ...s, isPlaying: false }));
        logger.warn("[MediaPlayer] togglePlayPause audio failed", err);
      }
      return;
    }

    if (!videoPlayer) return;
    try {
      const isCurrentlyPlaying = stateRef.current.isPlaying;
      if (isCurrentlyPlaying) {
        videoPlayer.pause();
        setState((s) => ({ ...s, isPlaying: false }));
      } else {

        videoPlayer.play();
        setState((s) => ({ ...s, isPlaying: true }));
      }
    } catch (err) {
      logger.warn("[MediaPlayer] togglePlayPause video failed", err);
    }
  }, [audioPlayer, videoPlayer, loadAndPlayAudio]);

  const seekTo = useCallback(
    async (positionMs: number) => {
      const item = currentItemRef.current;
      if (!item) return;

      const durationMs = stateRef.current.durationMs;
      const safe = Math.max(
        0,
        Math.min(
          Math.round(positionMs),
          Number.isFinite(durationMs) && durationMs > 0
            ? durationMs
            : Number.MAX_SAFE_INTEGER
        )
      );

      if (item.mediaType === "audio") {
        const generation = beginPendingSeek(safe);

        if (!TrackPlayerAvailable) {
          const wa = webAudioRef.current;
          if (!wa || !Number.isFinite(safe / 1000)) {
            clearPendingSeek(generation);
            return;
          }
          try {
            // Completion is acknowledged by the native HTMLMediaElement
            // 'seeked' event, never by a fixed timeout.
            wa.currentTime = safe / 1000;
          } catch (err) {
            clearPendingSeek(generation);
            logger.warn("[MediaPlayer] web audio seekTo failed", err);
          }
          return;
        }

        try {
          // RNTP v4 resolves this promise when the seek command is accepted.
          // The sequential progress reader below confirms actual convergence.
          await TrackPlayer.seekTo(safe / 1000);
        } catch (err) {
          clearPendingSeek(generation);
          logger.warn("[MediaPlayer] audio seekTo failed", err);
        }
        return;
      }

      // Video has its own event-backed progress path.
      setState((s) => ({ ...s, positionMs: safe }));
      if (!videoPlayer) return;
      try {
        videoPlayer.currentTime = safe / 1000;
      } catch (err) {
        logger.warn("[MediaPlayer] video seekTo failed", err);
      }
    },
    [beginPendingSeek, clearPendingSeek, videoPlayer]
  );

  const skipToIndex = useCallback(
    async (nextIndex: number) => {
      const s = stateRef.current;
      const safeIndex = Math.min(
        Math.max(0, nextIndex),
        Math.max(0, s.queue.length - 1)
      );

      const item = s.queue[safeIndex];
      if (!item) return;
      if (await blockLockedPlayback(item)) return;

      const selectionToken = mediaSelectionTokenRef.current + 1;
      mediaSelectionTokenRef.current = selectionToken;
      currentItemRef.current = item;

      setState((prev) => ({
        ...prev,
        currentIndex: safeIndex,
        positionMs: 0,
        durationMs: toFiniteDurationMs(item.duration),
        isExpanded: false,
        isPlaying: item.mediaType === "video",
      }));

      if (item.mediaType === "audio") {
        await loadAndPlayAudio(item);
      } else {
        await prepareVideo();
        await applyPlaybackConfigToCurrent();
      }
    },
    [
      applyPlaybackConfigToCurrent,
      blockLockedPlayback,
      loadAndPlayAudio,
      prepareVideo,
    ]
  );

  useEffect(() => {
    skipToIndexRef.current = skipToIndex;
  }, [skipToIndex]);

  const skipNext = useCallback(async () => {
    const s = stateRef.current;
    if (!s.queue.length) return;
    const isLast = s.currentIndex >= Math.max(0, s.queue.length - 1);
    if (isLast && s.repeatMode === "off") {
      return;
    }
    const next = (s.currentIndex + 1) % s.queue.length;
    await skipToIndex(next);
  }, [skipToIndex]);

  const skipPrev = useCallback(async () => {
    const s = stateRef.current;
    if (!s.queue.length) return;
    const prev = (s.currentIndex - 1 + s.queue.length) % s.queue.length;
    await skipToIndex(prev);
  }, [skipToIndex]);

  const setShuffle = useCallback(
    (enabled: boolean) => {
      setState((s) => {
        if (s.isShuffle === enabled) return s;
        if (!enabled) return { ...s, isShuffle: false };
        const shuffled = shuffleQueueKeepCurrent(s.queue, s.currentIndex);
        return {
          ...s,
          isShuffle: true,
          queue: shuffled.queue,
          currentIndex: shuffled.currentIndex,
        };
      });
    },
    [shuffleQueueKeepCurrent]
  );

  const toggleShuffle = useCallback(() => {
    setShuffle(!stateRef.current.isShuffle);
  }, [setShuffle]);

  const setRepeatMode = useCallback((mode: PlayerState["repeatMode"]) => {
    setState((s) => ({ ...s, repeatMode: mode }));
  }, []);

  const cycleRepeatMode = useCallback(() => {
    const current = stateRef.current.repeatMode;
    const next = current === "off" ? "all" : current === "all" ? "one" : "off";
    setRepeatMode(next);
  }, [setRepeatMode]);

  const setPlaybackRate = useCallback(
    async (rate: number) => {
      const safe = Math.max(0.5, Math.min(2, rate));
      setState((s) => ({ ...s, playbackRate: safe }));

      const item = currentItemRef.current;
      if (!item) return;
      try {
        if (item.mediaType === "audio") {
          if (TrackPlayerAvailable) {
            await TrackPlayer.setRate(safe);
          }
        } else if (videoPlayer) {
          videoPlayer.playbackRate = safe;
        }
      } catch {
        // ignore
      }
    },
    [audioPlayer, videoPlayer]
  );

  const setVolume = useCallback(
    async (volume: number) => {
      const safe = Math.max(0, Math.min(1, volume));
      setState((s) => ({ ...s, volume: safe }));

      const item = currentItemRef.current;
      if (!item) return;
      try {
        if (item.mediaType === "audio") {
          if (TrackPlayerAvailable) {
            await TrackPlayer.setVolume(safe);
          }
        } else if (videoPlayer) {
          videoPlayer.volume = safe;
        }
      } catch {
        // ignore
      }
    },
    [audioPlayer, videoPlayer]
  );

  const close = useCallback(async () => {
    cancelPendingMediaSelection();
    cancelPendingAudioLoad();
    audioPlayIntentRef.current = false;
    currentItemRef.current = null;
    await stopVideo();
    await unloadAudio();
    setState(EMPTY_STATE);
  }, [
    cancelPendingMediaSelection,
    cancelPendingAudioLoad,
    stopVideo,
    unloadAudio,
  ]);

  const setExpanded = useCallback((expanded: boolean) => {
    setState((s) => ({ ...s, isExpanded: expanded }));
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingMediaSelection();
      cancelPendingAudioLoad();
      stopVideo().catch(() => undefined);
      unloadAudio().catch(() => undefined);
    };
  }, [
    cancelPendingMediaSelection,
    cancelPendingAudioLoad,
    stopVideo,
    unloadAudio,
  ]);

  // TrackPlayer remote event listeners for background/lock screen control synchronization
  useEffect(() => {
    if (!TrackPlayerAvailable || !isPlayerReady) return;

    logger.log("[MediaPlayer] Setting up TrackPlayer event listeners");

    // Listen for remote play events from notification/lock screen
    const remotePlaySubscription = TrackPlayer.addEventListener(
      Event?.RemotePlay,
      () => {
        logger.log("[MediaPlayer] RemotePlay event received");
        if (currentItemRef.current?.mediaType !== "audio") return;
        lastRecoveredAudioSourceRef.current = null;
        audioPlayIntentRef.current = true;
        // PlaybackState.Playing is the authoritative confirmation.
      }
    );

    // Listen for remote pause events from notification/lock screen
    const remotePauseSubscription = TrackPlayer.addEventListener(
      Event?.RemotePause,
      () => {
        logger.log("[MediaPlayer] RemotePause event received");
        if (currentItemRef.current?.mediaType !== "audio") return;
        audioPlayIntentRef.current = false;
        setState((s) => ({ ...s, isPlaying: false }));
      }
    );

    const remoteStopSubscription = TrackPlayer.addEventListener(
      Event?.RemoteStop,
      () => {
        logger.log("[MediaPlayer] RemoteStop event received");
        if (currentItemRef.current?.mediaType !== "audio") return;
        audioPlayIntentRef.current = false;
        audioSourceRef.current = null;
        resetSeekCoordinator();
        setState((s) => ({ ...s, isPlaying: false, positionMs: 0 }));
      }
    );

    // Listen for remote next events from notification/lock screen
    const remoteNextSubscription = TrackPlayer.addEventListener(
      Event?.RemoteNext,
      () => {
        logger.log("[MediaPlayer] RemoteNext event received");
        const s = stateRef.current;
        if (!s.queue.length) return;
        const isLast = s.currentIndex >= Math.max(0, s.queue.length - 1);
        if (!isLast || s.repeatMode !== "off") {
          const next = (s.currentIndex + 1) % s.queue.length;
          skipToIndex(next).catch(() => undefined);
        }
      }
    );

    // Listen for remote previous events from notification/lock screen
    const remotePrevSubscription = TrackPlayer.addEventListener(
      Event?.RemotePrevious,
      () => {
        console.log("[MediaPlayer] RemotePrevious event received");
        const s = stateRef.current;
        if (!s.queue.length) return;
        const prev = (s.currentIndex - 1 + s.queue.length) % s.queue.length;
        skipToIndex(prev).catch(() => undefined);
      }
    );

    // Listen for remote seek events from notification progress bar
    const remoteSeekSubscription = TrackPlayer.addEventListener(
      Event?.RemoteSeek,
      (event: any) => {
        console.log("[MediaPlayer] RemoteSeek event received:", event.position);
        const pos = Math.max(0, Math.round(event.position * 1000));
        // The playback service performs the native seek. Foreground state waits
        // for the canonical progress reader to confirm the new position.
        beginPendingSeek(pos);
      }
    );

    const remoteJumpForwardSubscription = TrackPlayer.addEventListener(
      Event?.RemoteJumpForward,
      (event: any) => {
        if (currentItemRef.current?.mediaType !== "audio") return;
        const jumpMs = Math.max(0, Number(event?.interval || 10) * 1000);
        const durationMs = stateRef.current.durationMs;
        const requested = Math.max(0, stateRef.current.positionMs + jumpMs);
        const target =
          Number.isFinite(durationMs) && durationMs > 0
            ? Math.min(requested, durationMs)
            : requested;
        beginPendingSeek(target);
      }
    );

    const remoteJumpBackwardSubscription = TrackPlayer.addEventListener(
      Event?.RemoteJumpBackward,
      (event: any) => {
        if (currentItemRef.current?.mediaType !== "audio") return;
        const jumpMs = Math.max(0, Number(event?.interval || 10) * 1000);
        beginPendingSeek(
          Math.max(0, stateRef.current.positionMs - jumpMs)
        );
      }
    );

    // Handle audio ducking (interruptions like phone calls)
    const remoteDuckSubscription = TrackPlayer.addEventListener(
      Event?.RemoteDuck,
      async (event: any) => {
        logger.log("[MediaPlayer] RemoteDuck event:", event);
        if (event.permanent) {
          // Permanent interruption cancels the user's active play intent.
          audioPlayIntentRef.current = false;
          setState((s) => ({ ...s, isPlaying: false }));
          return;
        }

        if (event.paused) {
          // Temporary interruption pauses engine state but preserves intent.
          setState((s) => ({ ...s, isPlaying: false }));
          return;
        }

        // Resume only if the user has not paused while interrupted.
        if (audioPlayIntentRef.current) {
          try {
            await TrackPlayer.play();
            setState((s) => ({ ...s, isPlaying: true }));
          } catch (error) {
            logger.warn("[MediaPlayer] Failed to resume after interruption", error);
            setState((s) => ({ ...s, isPlaying: false }));
          }
        }
      }
    );

    const playbackQueueEndedSubscription = TrackPlayer.addEventListener(
      Event?.PlaybackQueueEnded,
      () => {
        if (
          currentItemRef.current?.mediaType !== "audio" ||
          !audioSourceRef.current ||
          foregroundRecoveryInFlightRef.current
        ) {
          return;
        }
        // The background service deliberately does not own the React queue.
        // While the UI runtime is active, apply the same repeat/advance policy
        // used by the web HTMLAudioElement ended event.
        if (AppState.currentState === "active") {
          handleDidJustFinish().catch(() => undefined);
        }
      }
    );

    // Position/duration are intentionally NOT written from PlaybackProgress.
    // One sequential getProgress loop below owns authoritative audio progress.

    // Playback state change tracking
    const playbackStateSubscription = TrackPlayer.addEventListener(
      Event?.PlaybackState,
      (playbackState: any) => {
        if (currentItemRef.current?.mediaType !== "audio") return;

        const nativeState = playbackState.state;
        logger.log("[MediaPlayer] PlaybackState changed:", nativeState);

        if (nativeState === TrackPlayerState?.Playing) {
          if (!stateRef.current.isPlaying) {
            setState((s) => ({ ...s, isPlaying: true }));
          }
          return;
        }

        // Ready/Loading/Buffering are transitional. In particular RNTP can
        // report Ready while a seek is settling, so treating every non-Playing
        // state as paused causes the UI and heartbeat to flap incorrectly.
        const explicitlyNotPlaying =
          nativeState === TrackPlayerState?.Paused ||
          nativeState === TrackPlayerState?.Stopped ||
          nativeState === TrackPlayerState?.Ended ||
          nativeState === TrackPlayerState?.Error ||
          nativeState === TrackPlayerState?.None;

        if (!explicitlyNotPlaying) return;

        // Engine state describes what RNTP is doing right now. It must not
        // overwrite user intent: Error/None/Stopped can be emitted while a
        // protected source is being recovered. Explicit controls and final
        // recovery failure own audioPlayIntentRef instead.
        if (stateRef.current.isPlaying) {
          setState((s) => ({ ...s, isPlaying: false }));
        }
      }
    );

    // Track changed event
    const trackChangedSubscription = TrackPlayer.addEventListener(
      Event?.PlaybackTrackChanged,
      (event: any) => {
        console.log("[MediaPlayer] PlaybackTrackChanged:", event);
      }
    );

    // Playback error handling
    const playbackErrorSubscription = TrackPlayer.addEventListener(
      Event?.PlaybackError,
      (error: any) => {
        logger.warn("[MediaPlayer] TrackPlayer playback error", error);

        if (AppState.currentState !== "active") {
          return;
        }

        if (foregroundRecoveryInFlightRef.current) return;

        const failedUrl = audioSourceRef.current;
        const item = currentItemRef.current;
        if (item?.mediaType !== "audio") return;

        // A null source means the error belongs to a deliberate reset/unload
        // or an already-abandoned load. Never let that stale event cancel the
        // next track's play intent.
        if (!failedUrl) return;

        const recovery = recoverAudioPlaybackRef.current;
        if (
          !item.useStreamAccess ||
          !recovery
        ) {
          audioPlayIntentRef.current = false;
          setState((s) => ({ ...s, isPlaying: false }));
          return;
        }

        const pendingTargetMs = pendingSeekRef.current?.targetMs;
        const resumePositionMs =
          pendingTargetMs !== undefined
            ? pendingTargetMs
            : Math.max(0, stateRef.current.positionMs);
        const shouldPlay = audioPlayIntentRef.current;

        foregroundRecoveryInFlightRef.current = true;
        void recovery({
          failedUrl,
          resumePositionMs,
          shouldPlay,
          reason: error,
        })
          .then((recovered) => {
            if (recovered) return;
            audioPlayIntentRef.current = false;
            setState((s) => ({ ...s, isPlaying: false }));
            if (AppState.currentState === "active") {
              Alert.alert(
                "Playback interrupted",
                "The audio stream could not be restored. Please try playing it again."
              );
            }
          })
          .finally(() => {
            foregroundRecoveryInFlightRef.current = false;
          });
      }
    );

    console.log("[MediaPlayer] TrackPlayer event listeners registered");

    return () => {
      console.log("[MediaPlayer] Cleaning up TrackPlayer event listeners");
      remotePlaySubscription.remove();
      remotePauseSubscription.remove();
      remoteStopSubscription.remove();
      remoteNextSubscription.remove();
      remotePrevSubscription.remove();
      remoteSeekSubscription.remove();
      remoteJumpForwardSubscription.remove();
      remoteJumpBackwardSubscription.remove();
      remoteDuckSubscription.remove();
      playbackQueueEndedSubscription.remove();
      playbackStateSubscription.remove();
      trackChangedSubscription.remove();
      playbackErrorSubscription.remove();
    };
  }, [
    isPlayerReady,
    skipToIndex,
    beginPendingSeek,
    resetSeekCoordinator,
    handleDidJustFinish,
  ]);

  // Canonical native audio progress synchronization.
  // Sequential polling mirrors RNTP's own useProgress design: one read
  // completes before the next begins, so reads never overlap.
  useEffect(() => {
    if (!TrackPlayerAvailable || !isPlayerReady) return;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      if (!active) return;

      const item = currentItemRef.current;
      if (item?.mediaType === "audio" && audioSourceRef.current) {
        const generationAtRead = seekGenerationRef.current;
        try {
          const progress = await TrackPlayer.getProgress();
          if (!active) return;

          const pos = Math.max(0, Math.round(progress.position * 1000));
          const dur =
            Number.isFinite(progress.duration) && progress.duration > 0
              ? Math.round(progress.duration * 1000)
              : 0;

          applyAudioProgress(pos, dur, generationAtRead);
        } catch (e) {
          logger.warn("[MediaPlayer] Progress read failed", e);
        }
      }

      if (active) {
        timer = setTimeout(() => {
          void poll();
        }, 250);
      }
    };

    void poll();

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [isPlayerReady, applyAudioProgress]);

  const value = useMemo<MediaPlayerContextValue>(
    () => ({
      state,
      currentItem,
      playQueue,
      togglePlayPause,
      seekTo,
      pendingSeekPositionMs,
      skipNext,
      skipPrev,
      setShuffle,
      toggleShuffle,
      setRepeatMode,
      cycleRepeatMode,
      setPlaybackRate,
      setVolume,
      close,
      setExpanded,

      videoAudioOnlyMode,
      videoRestoreNonce,
      videoRestorePositionMs: videoRestorePositionMsRef.current,

      inlineVideoHostActive,
      setInlineVideoHostActive,

      inlineAudioHostActive,
      setInlineAudioHostActive,
      onVideoPlaybackStatusUpdate,
      videoPlayer,
      audioPlayer,
      isPlayerReady,
      preferredQuality,
      setPreferredQuality,
    }),
    [
      close,
      currentItem,
      cycleRepeatMode,
      inlineAudioHostActive,
      inlineVideoHostActive,
      onVideoPlaybackStatusUpdate,
      playQueue,
      seekTo,
      pendingSeekPositionMs,
      setPlaybackRate,
      setRepeatMode,
      setExpanded,
      setShuffle,
      setInlineAudioHostActive,
      skipNext,
      skipPrev,
      state,
      setVolume,
      setInlineVideoHostActive,
      toggleShuffle,
      togglePlayPause,
      videoAudioOnlyMode,
      videoRestoreNonce,
      videoPlayer,
      audioPlayer,
      isPlayerReady,
      preferredQuality,
      setPreferredQuality,
    ]
  );

  return (
    <MediaPlayerContext.Provider value={value}>
      {children}
    </MediaPlayerContext.Provider>
  );
}
