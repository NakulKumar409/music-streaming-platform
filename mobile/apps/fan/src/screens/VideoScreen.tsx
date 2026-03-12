import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ArrowLeft, BadgeCheck, HelpCircle, Library, Maximize, Pause, Play, Search, Settings, X } from 'lucide-react-native';
import { ResizeMode, Video, type AVPlaybackStatus } from 'expo-av';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';

import { apiV1 } from '../services/api';
import * as streamService from '../services/streamService';
import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';

type ApiContentItem = {
  id: string | number;
  title?: string | null;
  type?: string | null;
  mediaType?: string | null;
  thumbnailUrl?: string | null;
  artwork?: string | null;
  mediaUrl?: string | null;
  fileUrl?: string | null;
  artistName?: string | null;
  artistId?: string | number | null;
  createdAt?: string | null;
  useStreamAccess?: boolean;
  isLocked?: boolean;
  locked?: boolean;
  genre?: string | null;
  viewCount?: number | null;
  views?: number | null;
  storageKey?: string | null;
};

type VideoCard = {
  id: string;
  title: string;
  artistName: string;
  artistId?: string;
  artworkUrl: string;
  mediaUrl: string;
  useStreamAccess?: boolean;
  storageKey?: string | null;
  category: string;
  createdAt?: string | null;
  viewCount?: number | null;
};

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1400&q=80';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HEADER_ASPECT = 16 / 9;
const HEADER_HEIGHT = Math.round(SCREEN_WIDTH / HEADER_ASPECT);
const MINI_PLAYER_W = 180;
const MINI_PLAYER_H = Math.round(MINI_PLAYER_W / HEADER_ASPECT);
const DOUBLE_TAP_MS = 250;
const SEEK_DELTA_MS = 10_000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function hashColor(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  const r = (h & 0xff0000) >> 16;
  const g = (h & 0x00ff00) >> 8;
  const b = h & 0x0000ff;
  const rr = (r + 256) % 256;
  const gg = (g + 256) % 256;
  const bb = (b + 256) % 256;
  return `rgb(${rr},${gg},${bb})`;
}

function formatCompactViews(v: number | null | undefined): string {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
  if (n === null) return '— views';
  if (n < 1000) return `${n} views`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K views`;
  if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B views`;
}

function formatDateLabel(raw?: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return '';
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week ago';
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years <= 1 ? '1 year ago' : `${years} years ago`;
}

function normalizeCategory(raw: unknown): string {
  const c = (raw ?? '').toString().trim();
  return c || 'Trending';
}

export default function VideoScreen() {
  const navigation = useNavigation<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentItem, state: playerState, togglePlayPause } = useMediaPlayer();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<VideoCard[]>([]);

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVideoMeta, setActiveVideoMeta] = useState<VideoCard | null>(null);
  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(null);
  const [loadingPlaybackUrl, setLoadingPlaybackUrl] = useState(false);

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [showUpNext, setShowUpNext] = useState(false);
  const [upNextSeconds, setUpNextSeconds] = useState(5);
  const upNextTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showControls, setShowControls] = useState(true);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playedOnceRef = useRef(false);

  const [isSeeking, setIsSeeking] = useState(false);
  const seekValueRef = useRef(0);

  const lastStatusPositionRef = useRef(0);
  const lastStatusDurationRef = useRef(0);
  const durationSetForUrlRef = useRef<string | null>(null);

  const [showQualitySheet, setShowQualitySheet] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>('Auto');

  const [showMini, setShowMini] = useState(false);
  const scrollYRef = useRef(0);
  const deepScrollRef = useRef(false);

  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(HEADER_HEIGHT + 92);
  const headerHeightRef = useRef<number>(HEADER_HEIGHT + 92);
  const hasMeasuredHeaderRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VideoCard[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

  const listRef = useRef<FlatList<VideoCard> | null>(null);

  const videoRef = useRef<Video>(null);
  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const playbackSessionRef = useRef(0);

  const shimmerX = useRef(new Animated.Value(0)).current;

  const miniAnim = useRef(new Animated.Value(0)).current;

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.max(0, Math.round(e.nativeEvent.layout.height));
    if (h <= 0) return;

    // FlatList uses measuredHeaderHeight for paddingTop.
    // Updating paddingTop can cause another layout pass of the header, which can feedback-loop.
    // We only need an initial measurement; keep it stable afterwards.
    if (hasMeasuredHeaderRef.current) return;

    const prev = headerHeightRef.current;
    // Avoid feedback loops: paddingTop changes can cause tiny layout jitter.
    // Only update when the height changes meaningfully.
    if (Math.abs(prev - h) < 8) return;

    headerHeightRef.current = h;
    hasMeasuredHeaderRef.current = true;
    setMeasuredHeaderHeight(h);
  }, []);

  useEffect(() => {
    // Reset throttling/duration once per playback source.
    lastStatusPositionRef.current = 0;
    lastStatusDurationRef.current = 0;
    durationSetForUrlRef.current = activePlaybackUrl ?? null;

    // Always reset UI to 0:00 when switching sources.
    setPositionMs(0);
    setDurationMs(0);
    seekValueRef.current = 0;
    playedOnceRef.current = false;
  }, [activePlaybackUrl]);

  const fetchAll = useCallback(async () => {
    const res = await apiV1.get('/content', { params: { mediaType: 'video' } });
    const raw: ApiContentItem[] = Array.isArray(res.data?.items) ? res.data.items : [];

    const mapped: VideoCard[] = raw
      .map((it) => {
        const mediaTypeRaw = (it.mediaType ?? it.type ?? '').toString().toLowerCase();
        const mediaType = mediaTypeRaw.includes('video') ? 'video' : 'audio';
        if (mediaType !== 'video') return null;

        const artworkUrl = (it.thumbnailUrl ?? it.artwork ?? '').toString() || FALLBACK_ARTWORK;
        const artistIdValue = it.artistId !== null && it.artistId !== undefined ? String(it.artistId) : undefined;

        return {
          id: String(it.id),
          title: (it.title ?? 'Untitled').toString(),
          artistName: (it.artistName ?? 'Artist').toString(),
          artistId: artistIdValue,
          artworkUrl,
          mediaUrl: (it.mediaUrl ?? it.fileUrl ?? '').toString(),
          useStreamAccess: true,
          storageKey: (it.storageKey ?? null) as any,
          category: normalizeCategory(it.genre),
          createdAt: (it.createdAt ?? null) as any,
          viewCount: (typeof it.viewCount === 'number' ? it.viewCount : typeof it.views === 'number' ? it.views : null) as any,
        };
      })
      .filter(Boolean) as VideoCard[];

    return mapped;
  }, []);

  const normalizedQuery = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const normalizeForSearch = useCallback((s: string) => {
    return (s ?? '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const matchesQuery = useCallback(
    (it: VideoCard, q: string) => {
      if (!q) return true;
      const hayRaw = `${it.title ?? ''} ${it.artistName ?? ''} ${it.category ?? ''}`;
      const hay = normalizeForSearch(hayRaw);
      const qq = normalizeForSearch(q);
      if (!qq) return true;

      const tokens = qq.split(' ').filter(Boolean);
      if (!tokens.length) return true;
      return tokens.every((t) => hay.includes(t));
    },
    [normalizeForSearch]
  );

  useEffect(() => {
    // Real-time (debounced) search that always hits the backend with mediaType=video.
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    const q = normalizedQuery;
    if (!q) {
      searchRequestIdRef.current += 1;
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }

    const requestId = (searchRequestIdRef.current += 1);

    searchTimerRef.current = setTimeout(() => {
      (async () => {
        setSearchLoading(true);
        try {
          const videos = await fetchAll();
          if (requestId !== searchRequestIdRef.current) return;
          const filtered = videos.filter((v) => matchesQuery(v, q));
          setSearchResults(filtered);
        } catch {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchResults([]);
        } finally {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchLoading(false);
        }
      })().catch(() => undefined);
    }, 350);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [fetchAll, matchesQuery, normalizedQuery]);

  const enterFullscreen = useCallback(async () => {
    try {
      const v: any = videoRef.current as any;
      if (!v) return;
      if (typeof v.presentFullscreenPlayer === 'function') {
        await v.presentFullscreenPlayer();
        return;
      }
      if (typeof v.presentFullscreen === 'function') {
        await v.presentFullscreen();
      }
    } catch {
      // ignore
    }
  }, []);

  const stopAndReset = useCallback(async () => {
    try {
      const v = videoRef.current;
      if (v) {
        try {
          await v.pauseAsync();
        } catch {
          // ignore
        }
        try {
          await v.setPositionAsync(0);
        } catch {
          // ignore
        }
        try {
          await v.unloadAsync();
        } catch {
          // ignore
        }
      }
    } finally {
      setActiveVideoId(null);
      setActiveVideoMeta(null);
      setActivePlaybackUrl(null);
      setIsVideoReady(false);
      setIsVideoPlaying(false);
      setPositionMs(0);
      setDurationMs(0);
      setShowUpNext(false);
      setUpNextSeconds(5);
      setShowControls(true);
      playedOnceRef.current = false;
      setShowQualitySheet(false);
    }
  }, []);

  const onSeekStart = useCallback(() => {
    setIsSeeking(true);
    seekValueRef.current = positionMs;
  }, [positionMs]);

  const onSeekChange = useCallback((value: number) => {
    seekValueRef.current = value;
    setPositionMs(Math.max(0, Math.round(value)));
  }, []);

  const onSeekComplete = useCallback(async (value: number) => {
    setIsSeeking(false);
    try {
      await videoRef.current?.setPositionAsync(Math.max(0, Math.round(value)));
    } catch {
      // ignore
    }
  }, []);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const isRefresh = Boolean(opts?.refresh);
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const next = await fetchAll();
        setItems(next);
      } catch {
        setItems([]);
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [fetchAll]
  );

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const trending = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
      const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
      return tb - ta;
    });
  }, [items]);

  const visibleItems = useMemo(() => {
    if (normalizedQuery) return searchResults ?? [];
    return trending;
  }, [normalizedQuery, searchResults, trending]);

  const pauseGlobalAudioIfNeeded = useCallback(async () => {
    if (currentItem?.mediaType !== 'audio') return;
    if (!playerState.isPlaying) return;
    try {
      await togglePlayPause();
    } catch {
      // ignore
    }
  }, [currentItem?.mediaType, playerState.isPlaying, togglePlayPause]);

  const pauseGlobalPlaybackIfNeeded = useCallback(async () => {
    if (!playerState.isPlaying) return;
    try {
      await togglePlayPause();
    } catch {
      // ignore
    }
  }, [playerState.isPlaying, togglePlayPause]);

  const pauseInlineVideoIfNeeded = useCallback(async () => {
    try {
      const v = videoRef.current;
      if (!v) return;
      const status = await v.getStatusAsync();
      const loaded = Boolean((status as any)?.isLoaded);
      const playing = Boolean((status as any)?.isPlaying);
      if (loaded && playing) {
        await v.pauseAsync();
      }
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        pauseInlineVideoIfNeeded().catch(() => undefined);
      };
    }, [pauseInlineVideoIfNeeded])
  );

  useEffect(() => {
    // Pause inline video if global audio starts playing.
    if (currentItem?.mediaType === 'audio' && playerState.isPlaying) {
      pauseInlineVideoIfNeeded().catch(() => undefined);
    }
  }, [currentItem?.mediaType, pauseInlineVideoIfNeeded, playerState.isPlaying]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') {
        pauseInlineVideoIfNeeded().catch(() => undefined);
      }
    });
    return () => {
      sub.remove();
    };
  }, [pauseInlineVideoIfNeeded]);

  const resolvePlaybackUrl = useCallback(async (video: VideoCard) => {
    try {
      return await streamService.getPlaybackUrl(video.id, 'video');
    } catch {
      return video.mediaUrl ? streamService.normalizePlaybackUrl(video.mediaUrl) : '';
    }
  }, []);

  const onPressVideo = useCallback(
    (video: VideoCard) => {
      (async () => {
        const sessionId = (playbackSessionRef.current += 1);

        setShowUpNext(false);
        setUpNextSeconds(5);
        if (upNextTimerRef.current) {
          clearInterval(upNextTimerRef.current);
          upNextTimerRef.current = null;
        }

        // Ensure a new selection always starts from 0:00 and does not inherit prior status updates.
        lastStatusPositionRef.current = 0;
        lastStatusDurationRef.current = 0;
        durationSetForUrlRef.current = null;
        setPositionMs(0);
        setDurationMs(0);
        seekValueRef.current = 0;
        setIsVideoReady(false);
        setIsBuffering(true);

        setActiveVideoId(video.id);
        setActiveVideoMeta(video);

        playedOnceRef.current = false;
        setShowControls(true);

        // Stop/unload any previous inline video so it can't block the next stream.
        // Do not await: cleanup can happen in parallel with fetching the next URL.
        videoRef.current?.unloadAsync().catch(() => undefined);
        setActivePlaybackUrl(null);

        await pauseGlobalPlaybackIfNeeded();

        setLoadingPlaybackUrl(true);
        try {
          const url = await resolvePlaybackUrl(video);
          if (sessionId !== playbackSessionRef.current) return;
          if (!url) return;
          setActivePlaybackUrl(url);
          setIsVideoReady(false);
          setIsBuffering(true);
          setIsVideoPlaying(true);

          // Best-effort immediate autoplay even before the first status tick.
          setTimeout(() => {
            if (sessionId !== playbackSessionRef.current) return;
            videoRef.current
              ?.setPositionAsync(0)
              .catch(() => undefined)
              .finally(() => {
                videoRef.current?.playAsync().catch(() => undefined);
              });
          }, 0);
        } catch {
          // keep placeholder
          setActivePlaybackUrl(null);
        } finally {
          setLoadingPlaybackUrl(false);
        }
      })().catch(() => undefined);
    },
    [pauseGlobalPlaybackIfNeeded, resolvePlaybackUrl]
  );

  const currentIndex = useMemo(() => {
    if (!activeVideoId) return -1;
    return visibleItems.findIndex((x) => x.id === activeVideoId);
  }, [activeVideoId, visibleItems]);

  const playNextPrev = useCallback(
    (dir: 'next' | 'prev') => {
      if (!visibleItems.length) return;
      const idx = currentIndex;
      if (idx < 0) return;
      const nextIdx = dir === 'next' ? idx + 1 : idx - 1;
      const next = visibleItems[clamp(nextIdx, 0, visibleItems.length - 1)];
      if (next && next.id !== activeVideoId) onPressVideo(next);
    },
    [activeVideoId, currentIndex, onPressVideo, visibleItems]
  );

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        const dx = Math.abs(gesture.dx);
        const dy = Math.abs(gesture.dy);
        return dx > 12 && dx > dy;
      },
      onPanResponderRelease: (_evt, gesture) => {
        const dx = gesture.dx;
        const vx = gesture.vx;
        if (dx < -60 || vx < -0.5) {
          playNextPrev('next');
          return;
        }
        if (dx > 60 || vx > 0.5) {
          playNextPrev('prev');
        }
      },
    });
  }, [playNextPrev]);

  useEffect(() => {
    if (!activePlaybackUrl) return;
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
    controlsHideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2200);
  }, [activePlaybackUrl]);

  useEffect(() => {
    return () => {
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
        controlsHideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerX]);

  useEffect(() => {
    const deep = scrollYRef.current > HEADER_HEIGHT * 2.4;
    const next = deep && Boolean(activePlaybackUrl) && isVideoPlaying;
    setShowMini((prev) => (prev === next ? prev : next));
  }, [activePlaybackUrl, isVideoPlaying]);

  const onListScroll = useCallback(
    (e: any) => {
      const y = Number(e?.nativeEvent?.contentOffset?.y ?? 0);
      scrollYRef.current = y;

      const deep = y > HEADER_HEIGHT * 2.4;
      if (deepScrollRef.current === deep) return;
      deepScrollRef.current = deep;

      const next = deep && Boolean(activePlaybackUrl) && isVideoPlaying;
      setShowMini((prev) => (prev === next ? prev : next));
    },
    [activePlaybackUrl, isVideoPlaying]
  );

  useEffect(() => {
    Animated.timing(miniAnim, {
      toValue: showMini ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [miniAnim, showMini]);

  const onVideoStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      const s: any = status as any;
      if (!s?.isLoaded) {
        if (isVideoReady) setIsVideoReady(false);
        return;
      }

      if (!isVideoReady && s.isLoaded) setIsVideoReady(true);

      const buffering = Boolean(s.isBuffering);
      setIsBuffering((prev) => (prev === buffering ? prev : buffering));

      const nextPlaying = Boolean(s.isPlaying);
      setIsVideoPlaying((prev) => (prev === nextPlaying ? prev : nextPlaying));

      const nextPos = Math.max(0, Math.round(Number(s.positionMillis ?? 0)));
      const nextDur = Math.max(0, Math.round(Number(s.durationMillis ?? 0)));

      // Only set duration once per playback URL (metadata load), not on every tick.
      if (activePlaybackUrl && durationSetForUrlRef.current !== activePlaybackUrl) {
        durationSetForUrlRef.current = activePlaybackUrl;
        lastStatusDurationRef.current = 0;
      }

      if (nextDur > 0 && lastStatusDurationRef.current === 0) {
        lastStatusDurationRef.current = nextDur;
        setDurationMs((prev) => (prev === nextDur ? prev : nextDur));
      }

      // Throttle position updates to avoid excessive render churn.
      if (!isSeeking) {
        const lastPos = lastStatusPositionRef.current;

        // When switching videos, some platforms can briefly report a non-zero position
        // before we get the chance to force seek to 0. Ignore that initial non-zero.
        if (!playedOnceRef.current && lastPos === 0 && nextPos > 0) {
          return;
        }

        const shouldUpdate = Math.abs(nextPos - lastPos) >= 500 || lastPos === 0;
        if (shouldUpdate) {
          lastStatusPositionRef.current = nextPos;
          setPositionMs((prev) => (prev === nextPos ? prev : nextPos));
        }
      }

      // Some devices/situations report loaded but do not auto-start.
      // Ensure playback starts once after load if user selected a video.
      // Always force position to 0 so switching videos never resumes.
      if (!playedOnceRef.current && activePlaybackUrl) {
        playedOnceRef.current = true;
        videoRef.current
          ?.setPositionAsync(0)
          .catch(() => undefined)
          .finally(() => {
            videoRef.current?.playAsync().catch(() => undefined);
          });
      }

      if (s.didJustFinish) {
        setIsVideoPlaying((prev) => (prev ? false : prev));
        setShowUpNext(true);
        setUpNextSeconds(5);
      }
    },
    [activePlaybackUrl, isSeeking, isVideoReady]
  );

  useEffect(() => {
    if (!showUpNext) return;
    if (!activeVideoId) return;
    if (!visibleItems.length) return;

    if (upNextTimerRef.current) {
      clearInterval(upNextTimerRef.current);
      upNextTimerRef.current = null;
    }

    upNextTimerRef.current = setInterval(() => {
      setUpNextSeconds((s) => {
        const next = s - 1;
        if (next <= 0) {
          if (upNextTimerRef.current) {
            clearInterval(upNextTimerRef.current);
            upNextTimerRef.current = null;
          }

          const idx = visibleItems.findIndex((x) => x.id === activeVideoId);
          const nextItem = visibleItems[clamp(idx + 1, 0, Math.max(0, visibleItems.length - 1))];
          if (nextItem && nextItem.id !== activeVideoId) {
            onPressVideo(nextItem);
          }
          return 5;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (upNextTimerRef.current) {
        clearInterval(upNextTimerRef.current);
        upNextTimerRef.current = null;
      }
    };
  }, [activeVideoId, onPressVideo, showUpNext, visibleItems]);

  const ambientColor = useMemo(() => {
    const key = `${activeVideoMeta?.id ?? ''}|${activeVideoMeta?.artworkUrl ?? ''}`;
    return hashColor(key);
  }, [activeVideoMeta?.artworkUrl, activeVideoMeta?.id]);

  const availableQualities = useMemo(() => {
    const key = (activeVideoMeta?.storageKey ?? '')?.toString() || '';
    const list: string[] = ['Auto'];
    if (/1080/i.test(key)) list.push('1080p');
    if (/720/i.test(key)) list.push('720p');
    if (/360/i.test(key)) list.push('360p');
    // If key doesn't contain quality hints, still offer the menu as requested.
    list.push('360p');
    list.push('720p');
    list.push('1080p');
    return Array.from(new Set(list));
  }, [activeVideoMeta?.storageKey]);

  const applyQualitySelection = useCallback(
    async (q: string) => {
      setSelectedQuality(q);
      setShowQualitySheet(false);
      if (!activeVideoMeta) return;

      // Backend currently issues a single secure playback URL; re-request on selection to satisfy
      // the "use streamService.getPlaybackUrl" requirement for all variants.
      const resumeAt = 0;
      try {
        setLoadingPlaybackUrl(true);
        const url = await streamService.getPlaybackUrl(activeVideoMeta.id, 'video');
        setActivePlaybackUrl(url);
        playedOnceRef.current = false;
        setIsVideoPlaying(true);

        setTimeout(() => {
          videoRef.current?.setPositionAsync(resumeAt).catch(() => undefined);
        }, 250);
      } catch {
        // ignore
      } finally {
        setLoadingPlaybackUrl(false);
      }
    },
    [activeVideoMeta]
  );

  const onDoubleTap = useCallback(
    async (dir: 'back' | 'forward') => {
      try {
        const v = videoRef.current;
        if (!v) return;
        const status = await v.getStatusAsync();
        const s: any = status as any;
        if (!s?.isLoaded) return;
        const current = Number(s.positionMillis ?? 0);
        const dur = Number(s.durationMillis ?? 0);
        const next = dir === 'back' ? current - SEEK_DELTA_MS : current + SEEK_DELTA_MS;
        const target = clamp(next, 0, dur || Number.MAX_SAFE_INTEGER);
        await v.setPositionAsync(target);
      } catch {
        // ignore
      }
    },
    []
  );

  const onPressPlayerSurface = useCallback(
    async (evt: any) => {
      const x = Number(evt?.nativeEvent?.locationX ?? 0);
      const now = Date.now();
      const delta = now - lastTapRef.current;
      const lastX = lastTapXRef.current;
      lastTapRef.current = now;
      lastTapXRef.current = x;

      if (delta < DOUBLE_TAP_MS && Math.abs(x - lastX) < 50) {
        const dir = x < SCREEN_WIDTH / 2 ? 'back' : 'forward';
        await onDoubleTap(dir);
        setShowControls(true);
        if (controlsHideTimerRef.current) {
          clearTimeout(controlsHideTimerRef.current);
          controlsHideTimerRef.current = null;
        }
        controlsHideTimerRef.current = setTimeout(() => setShowControls(false), 1800);
        return;
      }

      setShowControls((s) => {
        const next = !s;
        if (controlsHideTimerRef.current) {
          clearTimeout(controlsHideTimerRef.current);
          controlsHideTimerRef.current = null;
        }
        if (next) {
          controlsHideTimerRef.current = setTimeout(() => setShowControls(false), 2400);
        } else {
          setShowQualitySheet(false);
        }
        return next;
      });
    },
    [onDoubleTap]
  );

  const toggleInlinePlayPause = useCallback(async () => {
    try {
      const v = videoRef.current;
      if (!v) return;
      const status = await v.getStatusAsync();
      const s: any = status as any;
      if (!s?.isLoaded) return;
      if (s.isPlaying) {
        await v.pauseAsync();
        setIsVideoPlaying(false);
      } else {
        await v.playAsync();
        setIsVideoPlaying(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const onPressShare = useCallback(async () => {
    try {
      if (!activeVideoMeta) return;
      await Share.share({ message: `${activeVideoMeta.title} - ${activeVideoMeta.artistName}` });
    } catch {
      // ignore
    }
  }, [activeVideoMeta]);

  const onPressArtist = useCallback(() => {
    const artistId = activeVideoMeta?.artistId;
    if (!artistId) return;
    navigation.navigate('Artist', { artistId });
  }, [activeVideoMeta?.artistId, navigation]);

  const renderSkeletonRow = useCallback(
    (_: any, idx: number) => {
      const translateX = shimmerX.interpolate({ inputRange: [0, 1], outputRange: [-160, 260] });
      return (
        <View style={styles.skelRow} key={`sk-${idx}`}>
          <View style={styles.skelThumb}>
            <Animated.View style={[styles.skelShimmer, { transform: [{ translateX }] }]} />
          </View>
          <View style={styles.skelMeta}>
            <View style={styles.skelLineLg}>
              <Animated.View style={[styles.skelShimmer, { transform: [{ translateX }] }]} />
            </View>
            <View style={styles.skelLineSm}>
              <Animated.View style={[styles.skelShimmer, { transform: [{ translateX }] }]} />
            </View>
            <View style={styles.skelLineXs}>
              <Animated.View style={[styles.skelShimmer, { transform: [{ translateX }] }]} />
            </View>
          </View>
        </View>
      );
    },
    [shimmerX]
  );

  const renderVideoItem = useCallback(
    ({ item }: { item: VideoCard }) => {
      const isActive = item.id === activeVideoId;
      return (
        <Pressable style={styles.rowItem} onPress={() => onPressVideo(item)}>
          <View style={[styles.rowThumbWrap, isActive ? styles.rowThumbWrapActive : null]}>
            <Image source={{ uri: item.artworkUrl || FALLBACK_ARTWORK }} style={styles.rowThumb} />
            <View style={styles.rowThumbOverlay}>
              <View style={styles.rowPlayBadge}>
                <Play size={16} color="#000" />
              </View>
            </View>
          </View>

          <View style={styles.rowMeta}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.rowArtist} numberOfLines={1}>
              {item.artistName}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {`${formatCompactViews(item.viewCount)}${formatDateLabel(item.createdAt) ? `  ·  ${formatDateLabel(item.createdAt)}` : ''}`}
            </Text>
          </View>
        </Pressable>
      );
    },
    [activeVideoId, onPressVideo]
  );

  const related = useMemo(() => {
    if (!activeVideoMeta) return [] as VideoCard[];
    const sameArtist = trending.filter((x) => x.id !== activeVideoMeta.id && x.artistId && x.artistId === activeVideoMeta.artistId);
    const sameGenre = trending.filter((x) => x.id !== activeVideoMeta.id && normalizeCategory(x.category) === normalizeCategory(activeVideoMeta.category));
    const merged = [...sameArtist, ...sameGenre];
    const seen = new Set<string>();
    const out: VideoCard[] = [];
    for (const it of merged) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
      if (out.length >= 4) break;
    }
    return out;
  }, [activeVideoMeta, trending]);

  const listHeader = useMemo(() => {
    if (normalizedQuery) return null;
    if (!activeVideoMeta) return null;
    if (!related.length) return null;

    return (
      <View style={styles.relatedWrap}>
        <Text style={styles.relatedTitle}>Related Videos</Text>
        {related.map((v) => (
          <Pressable key={v.id} style={styles.relatedRow} onPress={() => onPressVideo(v)}>
            <Image source={{ uri: v.artworkUrl || FALLBACK_ARTWORK }} style={styles.relatedThumb} />
            <View style={styles.relatedMeta}>
              <Text style={styles.relatedRowTitle} numberOfLines={2}>
                {v.title}
              </Text>
              <Text style={styles.relatedRowSub} numberOfLines={1}>
                {v.artistName}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    );
  }, [activeVideoMeta, normalizedQuery, onPressVideo, related]);

  const listEmpty = useMemo(() => {
    if (normalizedQuery && searchLoading) {
      return <Text style={styles.emptyText}>Searching…</Text>;
    }
    return <Text style={styles.emptyText}>No videos found.</Text>;
  }, [normalizedQuery, searchLoading]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={Colors.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[`${ambientColor.replace('rgb', 'rgba').replace(')', ',0.20)')}`, 'rgba(0,0,0,0)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {loading ? (
          <FlatList
            data={Array.from({ length: 6 })}
            keyExtractor={(_, idx) => `sk-${idx}`}
            renderItem={({ item, index }) => renderSkeletonRow(item, index)}
            showsVerticalScrollIndicator={false}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: measuredHeaderHeight, paddingBottom: tabBarHeight + 120 }}
            refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
          />
        ) : (
          <FlatList<VideoCard>
            ref={(r) => {
              listRef.current = r;
            }}
            data={visibleItems}
            keyExtractor={(it) => it.id}
            renderItem={renderVideoItem}
            showsVerticalScrollIndicator={false}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingTop: measuredHeaderHeight, paddingBottom: tabBarHeight + 120 }}
            refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
            ListEmptyComponent={listEmpty}
            ListHeaderComponent={listHeader}
            ListHeaderComponentStyle={listHeader ? { marginBottom: 14 } : undefined}
          />
        )}

        <View style={styles.stickyHeader} pointerEvents="box-none">
          <View onLayout={onHeaderLayout}>
            <View style={styles.headerTopRow}>
              <Text style={styles.title}>Video</Text>
            </View>

            <Animated.View
              style={[
                styles.playerFrame,
                showMini
                  ? [
                      styles.playerFrameMini,
                      {
                        position: 'absolute',
                        width: 180,
                        height: Math.round(180 / HEADER_ASPECT),
                        right: 14,
                        bottom: tabBarHeight + 16,
                      },
                    ]
                  : null,
                // Smooth transition between normal header and mini-player.
                showMini ? { transform: [{ scale: miniAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }) } as any] } : null,
              ]}
              pointerEvents="box-none"
            >
              <View style={styles.playerInner} pointerEvents="box-none" {...panResponder.panHandlers}>
              {activePlaybackUrl ? (
                <Pressable style={StyleSheet.absoluteFill} onPress={onPressPlayerSurface}>
                  <Video
                    key={activePlaybackUrl}
                    ref={videoRef}
                    style={styles.video}
                    source={{ uri: activePlaybackUrl }}
                    resizeMode={ResizeMode.COVER}
                    useNativeControls={false}
                    progressUpdateIntervalMillis={200}
                    onPlaybackStatusUpdate={onVideoStatusUpdate}
                  />
                </Pressable>
              ) : (
                <View style={StyleSheet.absoluteFill}>
                  <View style={styles.playerBlank} />
                  <View style={styles.heroOverlay}>
                    {loadingPlaybackUrl ? <ActivityIndicator color="#fff" /> : null}
                    <Text style={styles.selectText}>Select a video to play</Text>
                  </View>
                </View>
              )}

              {activePlaybackUrl && showControls ? (
                <View style={styles.playerTopLeft}>
                  <Pressable style={styles.iconBtn} onPress={() => stopAndReset().catch(() => undefined)}>
                    <ArrowLeft size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.playerTopRight}>
                {activePlaybackUrl && showControls ? (
                  <Pressable style={styles.iconBtn} onPress={() => setShowQualitySheet((s) => !s)}>
                    <Settings size={18} color="#fff" />
                  </Pressable>
                ) : null}
                {activePlaybackUrl && showControls ? (
                  <Pressable style={styles.iconBtn} onPress={() => enterFullscreen().catch(() => undefined)}>
                    <Maximize size={18} color="#fff" />
                  </Pressable>
                ) : null}
              </View>

              {showQualitySheet && activePlaybackUrl && showControls ? (
                <BlurView intensity={55} tint="dark" style={styles.qualitySheet}>
                  {availableQualities.map((q) => {
                    const active = q === selectedQuality;
                    return (
                      <Pressable
                        key={q}
                        style={[styles.qualityPill, active ? styles.qualityPillActive : null]}
                        onPress={() => {
                          applyQualitySelection(q).catch(() => undefined);
                        }}
                      >
                        <Text style={[styles.qualityText, active ? styles.qualityTextActive : null]}>{q}</Text>
                      </Pressable>
                    );
                  })}
                </BlurView>
              ) : null}

              {activePlaybackUrl && showControls ? (
                <View style={styles.controlsOverlay} pointerEvents="box-none">
                  <Pressable style={styles.playPauseBtn} onPress={toggleInlinePlayPause}>
                    {isVideoPlaying ? <Pause size={20} color="#000" /> : <Play size={20} color="#000" />}
                  </Pressable>
                </View>
              ) : null}

              {showUpNext ? (
                <View style={styles.upNextOverlay}>
                  <Text style={styles.upNextTitle}>Up Next</Text>
                  <Text style={styles.upNextSub}>Playing next in {upNextSeconds}s</Text>
                </View>
              ) : null}

              {activePlaybackUrl && showControls ? (
                <View style={styles.seekWrap} pointerEvents="box-none">
                  <View style={styles.seekTimesRow}>
                    <Text style={styles.seekTime}>{formatTime(positionMs)}</Text>
                    <Text style={styles.seekTime}>{formatTime(durationMs)}</Text>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={Math.max(1, durationMs || 1)}
                    value={Math.min(positionMs, durationMs || 1)}
                    minimumTrackTintColor="#FFFFFF"
                    maximumTrackTintColor="rgba(255,255,255,0.22)"
                    thumbTintColor="#FFFFFF"
                    onSlidingStart={onSeekStart}
                    onValueChange={onSeekChange}
                    onSlidingComplete={onSeekComplete}
                  />
                </View>
              ) : null}

              {!activePlaybackUrl ? (
                <View style={styles.heroHint}>
                  <Text style={styles.heroHintText}>Tap a video below to start playing</Text>
                </View>
              ) : null}
              </View>
            </Animated.View>

            <View style={styles.searchWrap}>
              <View style={styles.searchIconWrap}>
                <Search size={18} color="rgba(255,255,255,0.65)" />
              </View>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search videos"
                placeholderTextColor="rgba(255,255,255,0.45)"
                autoCorrect={false}
                autoCapitalize="none"
                style={styles.searchInput}
              />
              {searchQuery.trim().length ? (
                <Pressable
                  style={styles.searchClearBtn}
                  onPress={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                  hitSlop={10}
                >
                  <X size={18} color="rgba(255,255,255,0.70)" />
                </Pressable>
              ) : null}
              {searchLoading ? <ActivityIndicator color="#fff" size="small" /> : null}
            </View>

            <View style={styles.metaBlock}>
              <Text style={styles.nowTitle} numberOfLines={1}>
                {activeVideoMeta?.title ? activeVideoMeta.title : 'Trending Videos'}
              </Text>

              {activePlaybackUrl && activeVideoMeta?.artistName ? (
                <Pressable style={styles.artistRow} onPress={onPressArtist}>
                  <Image source={{ uri: activeVideoMeta.artworkUrl || FALLBACK_ARTWORK }} style={styles.artistAvatar} />
                  <Text style={styles.artistRowName} numberOfLines={1}>
                    {activeVideoMeta.artistName}
                  </Text>
                </Pressable>
              ) : (
                <Text style={styles.nowSub} numberOfLines={1}>
                  {activeVideoMeta?.artistName ? activeVideoMeta.artistName : 'For you'}
                </Text>
              )}

              <View style={styles.actionRow}>
                <Pressable style={styles.actionBtn} onPress={() => undefined}>
                  <BadgeCheck size={18} color="#fff" />
                  <Text style={styles.actionText}>Like</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={onPressShare}>
                  <HelpCircle size={18} color="#fff" />
                  <Text style={styles.actionText}>Share</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => undefined}>
                  <Library size={18} color="#fff" />
                  <Text style={styles.actionText}>Download</Text>
                </Pressable>
              </View>
            </View>

          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safe: { flex: 1 },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },

  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerTopRow: {
    paddingTop: 18,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },

  playerFrame: {
    width: '100%',
    height: HEADER_HEIGHT,
    backgroundColor: '#000',
  },
  playerFrameMini: {
    position: 'absolute',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  playerInner: {
    flex: 1,
  },
  playerBlank: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  selectText: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroHint: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  heroHintText: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },

  playerTopRight: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    gap: 10,
  },
  playerTopLeft: {
    position: 'absolute',
    left: 12,
    top: 12,
    flexDirection: 'row',
    gap: 10,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },

  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  playPauseBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.20)',
  },

  seekWrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  seekTimesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  seekTime: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
  },
  slider: { width: '100%', height: 20 },

  upNextOverlay: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.60)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  upNextTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  upNextSub: { marginTop: 2, color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '700' },

  metaBlock: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  nowTitle: { color: '#fff', fontSize: 15, fontWeight: '900' },
  nowSub: { marginTop: 4, color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '800' },

  artistRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  artistAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  artistRowName: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },

  actionRow: { marginTop: 12, flexDirection: 'row', gap: 18 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '900' },

  qualitySheet: {
    position: 'absolute',
    right: 12,
    top: 56,
    zIndex: 50,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'column',
    gap: 8,
  },
  qualityPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  qualityPillActive: {
    borderColor: 'rgba(255,106,0,0.60)',
    backgroundColor: 'rgba(255,106,0,0.16)',
  },
  qualityText: { color: 'rgba(255,255,255,0.86)', fontSize: 12, fontWeight: '900' },
  qualityTextActive: { color: Colors.accent },

  searchWrap: {
    marginTop: 12,
    marginBottom: 16,
    marginHorizontal: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  searchIconWrap: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    padding: 0,
  },
  searchClearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  rowItem: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  rowThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  rowThumbWrapActive: {
    borderColor: 'rgba(255,106,0,0.60)',
  },
  rowThumb: { width: '100%', height: '100%' },
  rowThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  rowPlayBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },
  rowMeta: { paddingTop: 10, paddingBottom: 2 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  rowArtist: { marginTop: 4, color: 'rgba(255,255,255,0.70)', fontSize: 12, fontWeight: '800' },
  rowSub: { marginTop: 4, color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '800' },

  relatedWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    marginTop: 18,
  },
  relatedTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 10,
  },
  relatedRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  relatedThumb: {
    width: 92,
    height: Math.round(92 * (9 / 16)),
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  relatedMeta: { flex: 1, justifyContent: 'center' },
  relatedRowTitle: { color: '#fff', fontSize: 13, fontWeight: '900' },
  relatedRowSub: { marginTop: 4, color: 'rgba(255,255,255,0.62)', fontSize: 11, fontWeight: '800' },

  skelRow: { paddingHorizontal: 16, paddingTop: 14 },
  skelThumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skelMeta: { paddingTop: 10 },
  skelLineLg: { height: 14, borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  skelLineSm: { marginTop: 8, height: 12, width: '70%', borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  skelLineXs: { marginTop: 8, height: 11, width: '52%', borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  skelShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.06)',
    transform: [{ skewX: '-20deg' } as any],
  },

  emptyText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
