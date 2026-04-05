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

import { useAudioPlayer, useAudioPlayerStatus, AudioPlayer, setAudioModeAsync } from 'expo-audio';
import { useVideoPlayer, VideoView, VideoPlayer } from 'expo-video';

import { navigationRef } from '../navigation/rootNavigation';

import MediaPlayerOverlay from '../ui/MediaPlayerOverlay';
import { recordPlayback } from '../services/libraryService';
import { getPlaybackUrl, normalizePlaybackUrl, validatePlaybackUrl } from '../services/streamService';
import { isStreamingUrlExpiringSoon, decodeJwtExpMsFromUrl } from '../utils/streaming';

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
  setExpanded: (expanded: boolean) => void;

  videoAudioOnlyMode: boolean;
  videoRestoreNonce: number;
  videoRestorePositionMs: number;

  inlineVideoHostActive: boolean;
  setInlineVideoHostActive: (active: boolean) => void;

  inlineAudioHostActive: boolean;
  setInlineAudioHostActive: (active: boolean) => void;

  onVideoPlaybackStatusUpdate: (status: any) => void;

  videoPlayer: VideoPlayer | null;
  audioPlayer: AudioPlayer | null;
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

  const [audioSource, setAudioSource] = useState<string | null>(null);
  const audioPlayer = useAudioPlayer(audioSource);
  const audioStatus = useAudioPlayerStatus(audioPlayer);

  const [videoSource, setVideoSource] = useState<string | null>(null);
  const videoPlayer = useVideoPlayer(videoSource);

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
    // Ensure audio can continue in background (iOS playback category + silent mode + background).
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => undefined);
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
          setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: 'doNotMix',
          }).catch(() => undefined);

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
    if (!state.isPlaying) return;

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
        audioPlayer.playbackRate = s.playbackRate;
      } catch {
        // ignore
      }
      try {
        audioPlayer.volume = s.volume;
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
          audioPlayer.seekTo(0);
          audioPlayer.play();
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

  const unloadAudio = useCallback(async () => {
    setAudioSource(null);
  }, []);

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
            const nextUrl = await getPlaybackUrl(item.contentId ?? item.id, type);
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
      const url = await getPlaybackUrl(item.contentId ?? item.id, item.mediaType);
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
          playbackUrl = await getPlaybackUrl(item.contentId ?? item.id, 'audio');
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
          const fallbackUrl = await getPlaybackUrl(item.contentId ?? item.id, 'audio');
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

      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      try {
        console.log('[MediaPlayer] Loading audio', { playbackUrl });
        setAudioSource(playbackUrl);
        scheduleTokenRefresh(playbackUrl, 'audio');

        hasStartedPlayingRef.current = false;

        // Update state to playing immediately
        setState((s) => ({
          ...s,
          isPlaying: true,
        }));

        // Directly call play() — expo-audio queues this until the source is buffered.
        // Using setTimeout(0) to let React flush the setAudioSource state update first.
        setTimeout(() => {
          try {
            audioPlayer.play();
            console.log('[MediaPlayer] play() called directly after source set');
          } catch (playErr) {
            console.warn('[MediaPlayer] Direct play() failed, effect-based retry will handle it', playErr);
          }
        }, 0);
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
          const url = await getPlaybackUrl(item.contentId ?? item.id, 'video');
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
        if (!audioPlayer) return;
        const isCurrentlyPlaying = stateRef.current.isPlaying;
        if (isCurrentlyPlaying) {
          audioPlayer.pause();
          setState((s) => ({ ...s, isPlaying: false }));
        } else {
          hasStartedPlayingRef.current = false;
          audioPlayer.play();
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
          audioPlayer.seekTo(safe / 1000);
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
      audioPlayer.playbackRate = safe;
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
        audioPlayer.volume = safe;
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
    if (!audioStatus) return;

    setState((s) => {
      let nextIsPlaying = Boolean(audioStatus.playing);
      const pos = Math.max(0, Math.round((audioPlayer.currentTime || 0) * 1000));
      const dur = Math.max(0, Math.round((audioPlayer.duration || 0) * 1000));
      
      if (nextIsPlaying) {
        hasStartedPlayingRef.current = true;
      }

      // If we INTEND to play (s.isPlaying is true) but native is paused natively, 
      // we must not prematurely set it back to false during the initial load phase
      // where the auto-play effect is waiting to trigger `audioPlayer.play()`.
      if (s.isPlaying && !nextIsPlaying) {
        // If we haven't successfully started playing yet, ignore the native pause state.
        if (!hasStartedPlayingRef.current || !audioStatus.isLoaded || pos < 500) {
          nextIsPlaying = true;
        }
      }

      // Throttle updates: only update if playing state changed, or position changed by > 500ms, or duration changed
      const posDiff = Math.abs(s.positionMs - pos);
      const shouldUpdate = s.isPlaying !== nextIsPlaying || posDiff > 800 || s.durationMs !== dur;
      
      if (!shouldUpdate) return s;

      // Trigger preload when ~1 min remaining or 75% through
      if (nextIsPlaying && dur > 30000 && pos > dur * 0.75 && !preloadedUrlRef.current) {
        preloadNextItem().catch(() => undefined);
      }
      
      return {
        ...s,
        isPlaying: nextIsPlaying,
        positionMs: pos,
        durationMs: dur,
      };
    });

    // Auto-next / repeat handling
    try {
      const isFinished = (audioPlayer.duration || 0) > 0 && (audioPlayer.currentTime || 0) >= (audioPlayer.duration || 0) - 0.1;
      if (isFinished && !audioStatus.playing && stateRef.current.isPlaying) {
         handleDidJustFinish().catch(() => undefined);
      }
    } catch {
      // ignore native errors in status effect
    }
  }, [audioStatus, audioPlayer, handleDidJustFinish]);

  // Retry effect: if state says we should be playing but native isn't playing yet,
  // retry calling play(). This handles cases where the direct play() call in
  // loadAndPlayAudio fired before the native player finished initializing.
  useEffect(() => {
    if (!state.isPlaying || !audioSource || !audioPlayer) return;
    if (audioStatus?.playing) return; // already playing — nothing to do

    // Silent retry on 403 or loading error
    const statusAny = audioStatus as any;
    if (statusAny.error && (statusAny.error.includes('403') || isStreamingUrlExpiringSoon(audioSource))) {
      console.log('[MediaPlayer] URL expired or 403 detected, refreshing...');
      (async () => {
        const item = currentItemRef.current;
        if (!item?.id) return;
        try {
          const nextUrl = await getPlaybackUrl(item.contentId ?? item.id, 'audio');
          setAudioSource(nextUrl);
          scheduleTokenRefresh(nextUrl, 'audio');
        } catch {
          // ignore
        }
      })().catch(() => undefined);
      return;
    }

    // Retry play() if audio is loaded but not yet playing
    if (audioStatus?.isLoaded && !audioStatus?.playing) {
      try {
        audioPlayer.play();
        console.log('[MediaPlayer] Retry play() from effect — was loaded but not playing');
      } catch (err) {
        console.log('[MediaPlayer] Retry play() failed', err);
      }
    }
  }, [audioSource, state.isPlaying, audioPlayer, audioStatus, scheduleTokenRefresh]);

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
    ]
  );

  return (
    <MediaPlayerContext.Provider value={value}>
      {children}
    </MediaPlayerContext.Provider>
  );
}
