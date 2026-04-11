import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Alert, AppState, Platform } from 'react-native';

import TrackPlayer, { State as TrackPlayerState, Event, Capability, AppKilledPlaybackBehavior, Track, RepeatMode, PitchAlgorithm } from 'react-native-track-player';
import { useVideoPlayer, VideoView, VideoPlayer } from 'expo-video';

import { navigationRef } from '../navigation/rootNavigation';

import MediaPlayerOverlay from '../ui/MediaPlayerOverlay';
import { recordPlayback } from '../services/libraryService';
import { getPlaybackUrl, normalizePlaybackUrl, validatePlaybackUrl } from '../services/streamService';
import { isStreamingUrlExpiringSoon, decodeJwtExpMsFromUrl } from '../utils/streaming';
import { startHeartbeat, stopHeartbeat } from '../services/heartbeatService';

import type { MediaItem, MediaType, PlayerState } from '../media.types';

// Removed SoundLike type as it is no longer needed with expo-audio

type MediaPlayerContextValue = {
  state: PlayerState;
  currentItem: MediaItem | null;
  playQueue: (queue: MediaItem[], index: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  setShuffle: (enabled: boolean) => void;
  toggleShuffle: () => void;
  setRepeatMode: (mode: PlayerState['repeatMode']) => void;
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
  audioPlayer: null; isPlayerReady: boolean;
  onVideoPlaybackStatusUpdate: (status: any) => void;
  
  preferredQuality: 'SD' | 'HD';
  setPreferredQuality: (q: 'SD' | 'HD') => void;
  setExpanded: (expanded: boolean) => void;
};

const MediaPlayerContext = createContext<MediaPlayerContextValue | undefined>(undefined);

const EMPTY_STATE: PlayerState = {
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  positionMs: 0,
  durationMs: 0,
  isExpanded: false,
  isShuffle: false,
  repeatMode: 'off',
  playbackRate: 1,
  volume: 1,
};

export function useMediaPlayer() {
  const ctx = useContext(MediaPlayerContext);
  if (!ctx) throw new Error('useMediaPlayer must be used within a MediaPlayerProvider');
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

  const [isPlayerReady, setIsPlayerReady] = useState(false); const audioPlayer = null; const [audioSource, setAudioSource] = useState<string | null>(null);

  const [videoSource, setVideoSource] = useState<string | null>(null);
  const videoPlayer = useVideoPlayer(videoSource);

  const [preferredQuality, setPreferredQuality] = useState<'SD' | 'HD'>('HD');

  const audioLoadTokenRef = useRef(0);
  const hasStartedPlayingRef = useRef(false);

  const currentItem = state.queue.length ? state.queue[state.currentIndex] ?? null : null;

  const lastVideoContentKeyRef = useRef<string | null>(null);

  const playbackRecordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRecordedRef = useRef<string | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preloadedUrlRef = useRef<{ id: string; url: string } | null>(null);

  const stateRef = useRef<PlayerState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
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
            appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            alwaysPauseOnInterruption: false,
            // Keep notification visible when paused
            stopForegroundGracePeriod: 0,
          },
          // Main capabilities shown in notification/lock screen
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            Capability.JumpForward,
            Capability.JumpBackward,
          ],
          // Compact capabilities (small notification view)
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
          ],
          // Notification icon customization
          notificationCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
          ],
          // Progress bar on notification
          progressUpdateEventInterval: 1,
        });
        if (!unmounted) setIsPlayerReady(true);
        console.log('[MediaPlayer] TrackPlayer setup complete with background capabilities');
      }
    };
    setup();
    return () => { unmounted = true; };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      console.log('App state changed to:', next);
      const item = currentItemRef.current;
      const s = stateRef.current;

      if (next !== 'active') {
        if (item?.mediaType === 'video' && s.isPlaying) {
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
  }, [videoAudioOnlyMode]);

  useEffect(() => {
    if (!currentItem?.id) return;
    if (!state.isPlaying) {
      stopHeartbeat();
      return;
    }

    const key = `${currentItem.contentId ?? currentItem.id}`;

    // avoid multiple immediate calls when state updates rapidly
    if (lastRecordedRef.current === key) return;

    if (playbackRecordTimerRef.current) {
      clearTimeout(playbackRecordTimerRef.current);
      playbackRecordTimerRef.current = null;
    }

    playbackRecordTimerRef.current = setTimeout(() => {
      lastRecordedRef.current = key;
      recordPlayback(key).catch(() => undefined);
    }, 500);

    // Start heartbeat for listening time tracking
    startHeartbeat(key);

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
    if (item.mediaType !== 'video') return;

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
  }, [currentItem]);

  const applyPlaybackConfigToCurrent = useCallback(async () => {
    const s = stateRef.current;
    const item = currentItemRef.current;
    if (!item) return;

    if (item.mediaType === 'audio') {
      try {
        TrackPlayer.setRate(s.playbackRate);
      } catch {
        // ignore
      }
      try {
        TrackPlayer.setVolume(s.volume);
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
  }, []);

  const shuffleQueueKeepCurrent = useCallback((queue: MediaItem[], currentIndex: number) => {
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
  }, []);

  const handleDidJustFinish = useCallback(async () => {
    const s = stateRef.current;
    const item = currentItemRef.current;
    if (!item) return;

    if (s.repeatMode === 'one') {
      try {
        if (item.mediaType === 'audio') {
          TrackPlayer.seekTo(0);
          TrackPlayer.play();
        } else if (videoPlayer) {
          videoPlayer.seekBy(-videoPlayer.currentTime);
          videoPlayer.play();
        }
      } catch {
        // ignore
      }
      return;
    }

    const isLast = s.currentIndex >= Math.max(0, s.queue.length - 1);
    if (isLast && s.repeatMode === 'off') {
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
    // Use the same skip logic, but avoid capturing stale state by delegating.
    await skipToIndex(nextIndex);
  }, []);

  const onVideoPlaybackStatusUpdate = useCallback(
    (status: any) => {
      void status;
    },
    []
  );

  const unloadAudio = useCallback(async () => { setAudioSource(null); await TrackPlayer.reset(); }, []);

  const stopVideo = useCallback(async () => {
    videoPlayer?.pause();
  }, [videoPlayer]);

  const scheduleTokenRefresh = useCallback(
    (url: string | null, type: 'audio' | 'video') => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }

      const expMs = decodeJwtExpMsFromUrl(url);
      if (!expMs) return;

      const now = Date.now();
      const delay = Math.max(10_000, expMs - now - 35_000); // 35s buffer
      console.log(`[MediaPlayer] Scheduling ${type} refresh in ${Math.round(delay / 1000)}s`);

      tokenRefreshTimerRef.current = setTimeout(() => {
        (async () => {
          const item = currentItemRef.current;
          if (!item?.id) return;
          console.log(`[MediaPlayer] Background refreshing ${type} URL...`);
          try {
            const nextUrl = await getPlaybackUrl(item.contentId ?? item.id, type, preferredQuality);
            if (type === 'audio') {
              setAudioSource(nextUrl);
              scheduleTokenRefresh(nextUrl, 'audio');
            } else {
              setVideoSource(nextUrl);
              scheduleTokenRefresh(nextUrl, 'video');
            }
          } catch (e) {
            console.warn(`[MediaPlayer] Failed to background refresh ${type} token`, e);
          }
        })().catch(() => undefined);
      }, delay);
    },
    []
  );

  const preloadNextItem = useCallback(async () => {
    const s = stateRef.current;
    if (!s.queue.length) return;
    const nextIdx = s.currentIndex + 1;
    if (nextIdx >= s.queue.length) return;
    const item = s.queue[nextIdx];
    if (!item?.id || preloadedUrlRef.current?.id === item.id) return;

    try {
      console.log('[MediaPlayer] Preloading next item', { id: item.id });
      const url = await getPlaybackUrl(item.contentId ?? item.id, item.mediaType, preferredQuality);
      preloadedUrlRef.current = { id: item.id, url };
    } catch {
      // ignore
    }
  }, []);

  const loadAndPlayAudio = useCallback(
    async (item: MediaItem) => {
      const loadToken = (audioLoadTokenRef.current += 1);
      await stopVideo();
      await unloadAudio();

      // If another load started while we were stopping/unloading, abort.
      if (loadToken !== audioLoadTokenRef.current) return;

      const isSignedStreamUrl = (url: string) => {
        const u = (url ?? '').toString();
        if (!u) return false;
        // Signed local stream URLs look like /media/stream/:id?token=...&kind=audio
        if (/\/media\/stream\//i.test(u)) return true;
        if (/\btoken=/i.test(u) && /\bkind=audio\b/i.test(u)) return true;
        return false;
      };

      let playbackUrl = item.mediaUrl ? normalizePlaybackUrl(item.mediaUrl) : null;

      // Always fetch a fresh playback URL if stream access is required.
      // Do not reuse the `mediaUrl` populated by the initial list fetch because the JWT token might have expired.
      if (item.useStreamAccess) {
        try {
          playbackUrl = await getPlaybackUrl(item.contentId ?? item.id, 'audio', preferredQuality);
        } catch (e) {
          console.warn('[MediaPlayer] getPlaybackUrl failed', e);
          Alert.alert('Playback Error', 'Could not get playback URL. Try again.');
          return;
        }
      }

      // Fallback: if still no URL but we have an item ID, try stream resolution anyway.
      // This handles items (e.g. "Pizza Making") where useStreamAccess=false but mediaUrl is empty.
      if (!playbackUrl && (item.contentId || item.id)) {
        try {
          const fallbackUrl = await getPlaybackUrl(item.contentId ?? item.id, 'audio', preferredQuality);
          if (fallbackUrl) {
            playbackUrl = normalizePlaybackUrl(fallbackUrl);
            console.log('[MediaPlayer] Used fallback stream URL for', item.title);
          }
        } catch {
          // ignore – we'll surface the error below
        }
      }

      if (!playbackUrl) {
        Alert.alert('Playback Error', 'No playback URL available for this track.');
        return;
      }
      if (!validatePlaybackUrl(playbackUrl, 'audio')) {
        Alert.alert('Playback Error', 'Received an invalid audio source URL.');
        return;
      }

      // track-player automatically handles background audio settings when configured with capabilities

      try {
        console.log('[MediaPlayer] Loading audio', { playbackUrl });
        setAudioSource(playbackUrl);
        scheduleTokenRefresh(playbackUrl, 'audio');

        hasStartedPlayingRef.current = false;

        // Build track metadata for notification/lock screen display
        const track: Track = {
          id: item.id.toString(),
          url: playbackUrl,
          title: item.title || 'Unknown Title',
          artist: item.artistName || 'Unknown Artist',
          artwork: (item as any).thumbnailUrl || (item as any).avatarUrl || (item as any).coverUrl || undefined,
          // Additional metadata for better lock screen display
          album: (item as any).albumName || undefined,
          duration: item.duration ? item.duration / 1000 : undefined, // Convert ms to seconds
          // For proper notification styling
          isLiveStream: false,
        };

        console.log('[MediaPlayer] Adding track to TrackPlayer:', {
          id: track.id,
          title: track.title,
          artist: track.artist,
          hasArtwork: !!track.artwork,
        });

        await TrackPlayer.reset();
        await TrackPlayer.add([track]);
        await TrackPlayer.play();
        
        // Update state to playing immediately
        setState((s) => ({
          ...s,
          isPlaying: true,
        }));
        
        console.log('[MediaPlayer] Audio playback started successfully');
      } catch (err) {
        console.warn('[MediaPlayer] Failed to create or play audio', err);
        Alert.alert(
          'Playback Error',
          'Could not start audio playback. Please check the media URL and try again.'
        );
      }
    },
    [stopVideo, audioPlayer]
  );

  const prepareVideo = useCallback(async () => {
    await unloadAudio();
  }, [unloadAudio]);

  const blockLockedPlayback = useCallback(
    async (item: MediaItem) => {
      void item;
      return;
    },
    [unloadAudio, stopVideo]
  );

  const playQueue = useCallback(
    async (queue: MediaItem[], index: number) => {
      const safeIndex = Math.min(Math.max(0, index), Math.max(0, queue.length - 1));
      const nextState = stateRef.current.isShuffle
        ? shuffleQueueKeepCurrent(queue, safeIndex)
        : { queue, currentIndex: safeIndex };

      let item = nextState.queue[nextState.currentIndex];
      if (!item) return;

      if (item.mediaType === 'video' && item.useStreamAccess) {
        try {
          const url = await getPlaybackUrl(item.contentId ?? item.id, 'video', preferredQuality);
          if (!validatePlaybackUrl(url, 'video')) {
            Alert.alert('Playback Error', 'Received an invalid video source URL.');
            return;
          }
          item = { ...item, mediaUrl: url };
          nextState.queue[nextState.currentIndex] = item;
        } catch (e) {
          console.warn('[MediaPlayer] getPlaybackUrl for video failed', e);
          Alert.alert('Playback Error', 'Could not get playback URL. Try again.');
          return;
        }
      }

      setState((s) => ({
        ...s,
        queue: nextState.queue,
        currentIndex: nextState.currentIndex,
        positionMs: 0,
        durationMs: 0,
        isExpanded: false,
      }));

      if (item.mediaType === 'audio') {
        await loadAndPlayAudio(item);
        return;
      }

      await prepareVideo();
      setState((s) => ({ ...s, isPlaying: true }));
      // actual play is handled by Video component when it renders with shouldPlay
    },
    [blockLockedPlayback, loadAndPlayAudio, prepareVideo, shuffleQueueKeepCurrent]
  );

  const togglePlayPause = useCallback(async () => {
    const item = currentItemRef.current;
    if (stateRef.current.queue.length === 0) return;

    if (item.mediaType === 'audio') {
      try {
        const isCurrentlyPlaying = stateRef.current.isPlaying;
        if (isCurrentlyPlaying) {
          TrackPlayer.pause();
          setState((s) => ({ ...s, isPlaying: false }));
        } else {
          hasStartedPlayingRef.current = false;
          TrackPlayer.play();
          setState((s) => ({ ...s, isPlaying: true }));
        }
      } catch (err) {
        console.warn('[MediaPlayer] togglePlayPause audio failed', err);
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
        hasStartedPlayingRef.current = false;
        videoPlayer.play();
        setState((s) => ({ ...s, isPlaying: true }));
      }
    } catch (err) {
      console.warn('[MediaPlayer] togglePlayPause video failed', err);
    }
  }, [currentItem, audioPlayer, videoPlayer]);

  const seekTo = useCallback(
    async (positionMs: number) => {
      const item = currentItem;
      if (!item) return;

      const safe = Math.max(0, Math.round(positionMs));

      if (item.mediaType === 'audio') {
        try {
          TrackPlayer.seekTo(safe / 1000);
        } catch (err) {
          console.warn('[MediaPlayer] audio seekTo failed', err);
        }
        return;
      }

      if (!videoPlayer) return;
      try {
        videoPlayer.seekBy((safe - videoPlayer.currentTime * 1000) / 1000);
      } catch (err) {
        console.warn('[MediaPlayer] video seekTo failed', err);
      }
    },
    [currentItem, audioPlayer, videoPlayer]
  );

  const skipToIndex = useCallback(
    async (nextIndex: number) => {
      const s = stateRef.current;
      const safeIndex = Math.min(Math.max(0, nextIndex), Math.max(0, s.queue.length - 1));

      setState((prev) => ({
        ...prev,
        currentIndex: safeIndex,
        positionMs: 0,
        durationMs: 0,
        isExpanded: false,
        isPlaying: true,
      }));

      const item = s.queue[safeIndex];
      if (!item) return;

      // Use preloaded URL if available
      let playbackUrl = item.mediaUrl;
      if (preloadedUrlRef.current?.id === item.id) {
        playbackUrl = preloadedUrlRef.current.url;
        preloadedUrlRef.current = null; // consume it
      }

      if (item.mediaType === 'audio') {
        await loadAndPlayAudio(item);
      } else {
        await prepareVideo();
        await applyPlaybackConfigToCurrent();
      }
    },
    [applyPlaybackConfigToCurrent, loadAndPlayAudio, prepareVideo]
  );

  const skipNext = useCallback(async () => {
    const s = stateRef.current;
    if (!s.queue.length) return;
    const isLast = s.currentIndex >= Math.max(0, s.queue.length - 1);
    if (isLast && s.repeatMode === 'off') {
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

  const setRepeatMode = useCallback((mode: PlayerState['repeatMode']) => {
    setState((s) => ({ ...s, repeatMode: mode }));
  }, []);

  const cycleRepeatMode = useCallback(() => {
    const current = stateRef.current.repeatMode;
    const next = current === 'off' ? 'all' : current === 'all' ? 'one' : 'off';
    setRepeatMode(next);
  }, [setRepeatMode]);

  const setPlaybackRate = useCallback(async (rate: number) => {
    const safe = Math.max(0.5, Math.min(2, rate));
    setState((s) => ({ ...s, playbackRate: safe }));

    const item = currentItemRef.current;
    if (!item) return;
    try {
    if (item.mediaType === 'audio') {
      TrackPlayer.setRate(safe);
    } else if (videoPlayer) {
      videoPlayer.playbackRate = safe;
    }
    } catch {
      // ignore
    }
  }, [audioPlayer, videoPlayer]);

  const setVolume = useCallback(async (volume: number) => {
    const safe = Math.max(0, Math.min(1, volume));
    setState((s) => ({ ...s, volume: safe }));

    const item = currentItemRef.current;
    if (!item) return;
    try {
      if (item.mediaType === 'audio') {
        TrackPlayer.setVolume(safe);
      } else if (videoPlayer) {
        videoPlayer.volume = safe;
      }
    } catch {
      // ignore
    }
  }, [audioPlayer, videoPlayer]);

  const close = useCallback(async () => {
    await stopVideo();
    await unloadAudio();
    setState(EMPTY_STATE);
  }, [stopVideo, unloadAudio]);

  const setExpanded = useCallback((expanded: boolean) => {
    setState((s) => ({ ...s, isExpanded: expanded }));
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isPlayerReady) return;
      const progress = await TrackPlayer.getProgress();
      const pos = Math.max(0, Math.round(progress.position * 1000));
      const dur = Math.max(0, Math.round(progress.duration * 1000));
      const trackState = await TrackPlayer.getState();
      const isNativePlaying = trackState === TrackPlayerState.Playing;

      setState((s) => {
        let nextIsPlaying = isNativePlaying;
        if (nextIsPlaying) hasStartedPlayingRef.current = true;
        
        if (s.isPlaying && !nextIsPlaying) {
          if (!hasStartedPlayingRef.current || pos < 500) {
            nextIsPlaying = true;
          }
        }

        const posDiff = Math.abs(s.positionMs - pos);
        const shouldUpdate = s.isPlaying !== nextIsPlaying || posDiff > 800 || s.durationMs !== dur;
        if (!shouldUpdate) return s;

        if (nextIsPlaying && dur > 30000 && pos > dur * 0.75 && !preloadedUrlRef.current) {
          preloadNextItem().catch(() => undefined);
        }
        
        return { ...s, isPlaying: nextIsPlaying, positionMs: pos, durationMs: dur };
      });

      if (dur > 0 && progress.position >= progress.duration - 0.5 && preloadedUrlRef.current && isNativePlaying === false && stateRef.current.isPlaying) {
         handleDidJustFinish().catch(() => undefined);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlayerReady, handleDidJustFinish, preloadNextItem]);

  // Retry effect: if state says we should be playing but native isn't playing yet,
  // retry calling play(). This handles cases where the direct play() call in
  // loadAndPlayAudio fired before the native player finished initializing.
  useEffect(() => {
    if (!state.isPlaying || !audioSource || !isPlayerReady) return;
    
    // Polling retry
    const timer = setTimeout(async () => {
      const ts = await TrackPlayer.getState();
      if (ts !== TrackPlayerState.Playing && stateRef.current.isPlaying) {
        TrackPlayer.play();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [audioSource, state.isPlaying, isPlayerReady]);

  useEffect(() => {
    return () => {
      stopVideo().catch(() => undefined);
      unloadAudio().catch(() => undefined);
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
    };
  }, [stopVideo, unloadAudio]);

  // TrackPlayer remote event listeners for background/lock screen control synchronization
  useEffect(() => {
    if (!isPlayerReady) return;

    console.log('[MediaPlayer] Setting up TrackPlayer event listeners');

    // Listen for remote play events from notification/lock screen
    const remotePlaySubscription = TrackPlayer.addEventListener(Event.RemotePlay, () => {
      console.log('[MediaPlayer] RemotePlay event received');
      setState((s) => ({ ...s, isPlaying: true }));
    });

    // Listen for remote pause events from notification/lock screen
    const remotePauseSubscription = TrackPlayer.addEventListener(Event.RemotePause, () => {
      console.log('[MediaPlayer] RemotePause event received');
      setState((s) => ({ ...s, isPlaying: false }));
    });

    // Listen for remote next events from notification/lock screen
    const remoteNextSubscription = TrackPlayer.addEventListener(Event.RemoteNext, () => {
      console.log('[MediaPlayer] RemoteNext event received');
      const s = stateRef.current;
      if (!s.queue.length) return;
      const isLast = s.currentIndex >= Math.max(0, s.queue.length - 1);
      if (!isLast || s.repeatMode !== 'off') {
        const next = (s.currentIndex + 1) % s.queue.length;
        skipToIndex(next).catch(() => undefined);
      }
    });

    // Listen for remote previous events from notification/lock screen
    const remotePrevSubscription = TrackPlayer.addEventListener(Event.RemotePrevious, () => {
      console.log('[MediaPlayer] RemotePrevious event received');
      const s = stateRef.current;
      if (!s.queue.length) return;
      const prev = (s.currentIndex - 1 + s.queue.length) % s.queue.length;
      skipToIndex(prev).catch(() => undefined);
    });

    // Listen for remote seek events from notification progress bar
    const remoteSeekSubscription = TrackPlayer.addEventListener(Event.RemoteSeek, (event) => {
      console.log('[MediaPlayer] RemoteSeek event received:', event.position);
      const pos = Math.round(event.position * 1000);
      setState((s) => ({ ...s, positionMs: pos }));
    });

    // Handle audio ducking (interruptions like phone calls)
    const remoteDuckSubscription = TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
      console.log('[MediaPlayer] RemoteDuck event:', event);
      if (event.permanent) {
        // Permanent interruption (phone call) - pause and update state
        setState((s) => ({ ...s, isPlaying: false }));
      } else if (event.paused) {
        // Temporary interruption started
        setState((s) => ({ ...s, isPlaying: false }));
      } else {
        // Temporary interruption ended - resume if we were playing
        const wasPlaying = stateRef.current.isPlaying;
        if (wasPlaying) {
          setState((s) => ({ ...s, isPlaying: true }));
        }
      }
    });

    // Playback state change tracking
    const playbackStateSubscription = TrackPlayer.addEventListener(Event.PlaybackState, (playbackState) => {
      const isPlaying = playbackState.state === TrackPlayerState.Playing;
      console.log('[MediaPlayer] PlaybackState changed:', playbackState.state, 'isPlaying:', isPlaying);
      
      // Sync state if different from current
      if (stateRef.current.isPlaying !== isPlaying) {
        setState((s) => ({ ...s, isPlaying }));
      }
    });

    // Track changed event
    const trackChangedSubscription = TrackPlayer.addEventListener(Event.PlaybackTrackChanged, (event) => {
      console.log('[MediaPlayer] PlaybackTrackChanged:', event);
    });

    // Playback error handling
    const playbackErrorSubscription = TrackPlayer.addEventListener(Event.PlaybackError, (error) => {
      console.error('[MediaPlayer] PlaybackError:', error);
      // Pause on error
      setState((s) => ({ ...s, isPlaying: false }));
    });

    console.log('[MediaPlayer] TrackPlayer event listeners registered');

    return () => {
      console.log('[MediaPlayer] Cleaning up TrackPlayer event listeners');
      remotePlaySubscription.remove();
      remotePauseSubscription.remove();
      remoteNextSubscription.remove();
      remotePrevSubscription.remove();
      remoteSeekSubscription.remove();
      remoteDuckSubscription.remove();
      playbackStateSubscription.remove();
      trackChangedSubscription.remove();
      playbackErrorSubscription.remove();
    };
  }, [isPlayerReady, skipToIndex]);

  const value = useMemo<MediaPlayerContextValue>(
    () => ({
      state,
      currentItem,
      playQueue,
      togglePlayPause,
      seekTo,
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
      setPreferredQuality
    ]
  );

  return (
    <MediaPlayerContext.Provider value={value}>
      {children}
    </MediaPlayerContext.Provider>
  );
}
