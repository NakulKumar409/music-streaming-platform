import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { AlertTriangle, Play, Search as SearchIcon } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiV1 } from '../services/api';
import { contentApi } from '../services/api';
import { getPlaybackUrl, normalizePlaybackUrl } from '../services/streamService';
import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import type { MediaItem } from '../media.types';

const REPORTED_CONTENT_STORAGE_KEY = 'reportedContentIds';

type ApiContentItem = {
  id: string | number;
  title?: string | null;
  type?: string | null;
  mediaType?: string | null;
  thumbnailUrl?: string | null;
  artwork?: string | null;
  thumbnail_storage_key?: string | null;
  thumbnailStorageKey?: string | null;
  mediaUrl?: string | null;
  fileUrl?: string | null;
  audioUrl?: string | null;
  artistName?: string | null;
  artistId?: string | number | null;
  createdAt?: string | null;
  viewCount?: number | string | null;
  views?: number | string | null;
  likeCount?: number | string | null;
  dislikeCount?: number | string | null;
  useStreamAccess?: boolean;
  isLocked?: boolean;
  locked?: boolean;
  genre?: string | null;
};

type AudioCard = {
  id: string;
  contentId: string;
  title: string;
  artistName: string;
  artistId?: string;
  artworkUrl: string;
  mediaUrl: string;
  useStreamAccess?: boolean;
  createdAt?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  dislikeCount?: number | null;
};

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

function EngagementIcon({
  name,
  size = 18,
  color = '#fff',
}: {
  name: 'like' | 'dislike' | 'share' | 'download';
  size?: number;
  color?: string;
}) {
  const s = size;
  const strokeWidth = 1.9;

  if (name === 'like') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 11v10H4V11h3Zm0 10h10.1a2 2 0 0 0 2-1.6l1.2-7A2 2 0 0 0 18.3 10H14V6.6a2.6 2.6 0 0 0-4.7-1.6L7 8.5V11Z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'dislike') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path
          d="M7 13V3H4v10h3Zm0 0 2.3 3.5A2.6 2.6 0 0 0 14 14.4V18h4.3a2 2 0 0 0 2-2.4l-1.2-7a2 2 0 0 0-2-1.6H7Z"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  if (name === 'share') {
    return (
      <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <Path
          d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M16 6l-4-4-4 4"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M12 2v14"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 10l5 5 5-5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 15V3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function AudioScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const {
    playQueue,
    currentItem,
    state: playerState,
    togglePlayPause,
    skipNext,
    skipPrev,
    seekTo,
    setInlineAudioHostActive,
  } = useMediaPlayer();

  const lastContentItemsRef = useRef<ApiContentItem[]>([]);

  const playbackUrlCacheRef = useRef<Map<string, { url: string; ts: number }>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());
  const startPlaybackInFlightRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const [items, setItems] = useState<AudioCard[]>([]);

  const [searchResults, setSearchResults] = useState<AudioCard[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

  const [reactionStateById, setReactionStateById] = useState<
    Record<string, { reaction: 'like' | 'dislike' | null; likeDelta: number; dislikeDelta: number }>
  >({});

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedContentIds, setReportedContentIds] = useState<Record<string, boolean>>({});

  const hasActiveAudio = Boolean(currentItem?.mediaType === 'audio');

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REPORTED_CONTENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const ids = Array.isArray(parsed) ? (parsed as any[]).map((x) => String(x)) : [];
        const map: Record<string, true> = {};
        ids.forEach((id) => {
          if (id) map[id] = true;
        });
        setReportedContentIds(map);
      } catch {
        setReportedContentIds({});
      }
    })().catch(() => undefined);
  }, []);

  const showThankYou = useCallback(() => {
    const message = 'Thank you for reporting.';
    if (Platform.OS === 'android') {
      const ToastAndroid = require('react-native').ToastAndroid as typeof import('react-native').ToastAndroid;
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Reported', message);
  }, []);

  const persistReported = useCallback(async (next: Record<string, boolean>) => {
    try {
      await AsyncStorage.setItem(
        REPORTED_CONTENT_STORAGE_KEY,
        JSON.stringify(Object.keys(next).filter((k) => Boolean(next[k])))
      );
    } catch {
      // ignore
    }
  }, []);

  const activeAudioMeta = useMemo(() => {
    if (currentItem?.mediaType !== 'audio') return null;
    const key = String(currentItem.contentId ?? currentItem.id ?? '');
    if (!key) return null;
    
    const fromList = items.find((x) => x.id === key || x.contentId === key);
    if (fromList) return fromList;
    
    // Fallback if not found locally (e.g., jumping from Home playQueue with mixed content types)
    return {
      id: key,
      contentId: key,
      title: currentItem.title ?? 'Unknown',
      artistName: currentItem.artistName ?? 'Unknown',
      artistId: currentItem.artistId,
      artworkUrl: currentItem.artworkUrl ?? FALLBACK_ARTWORK,
      mediaUrl: currentItem.mediaUrl ?? '',
      useStreamAccess: Boolean(currentItem.useStreamAccess),
      viewCount: null,
      likeCount: null,
      dislikeCount: null,
    } as AudioCard;
  }, [currentItem, items]);

  const submitReport = useCallback(
    async (reason: 'Spam' | 'Inappropriate' | 'Copyright') => {
      if (!activeAudioMeta?.contentId && !activeAudioMeta?.id) return;
      const id = String(activeAudioMeta.contentId ?? activeAudioMeta.id);
      if (reportedContentIds[id]) return;

      setReportSubmitting(true);
      try {
        const res = await contentApi.post('/report', {
          contentId: activeAudioMeta.contentId ?? activeAudioMeta.id,
          reason,
        });

        if (!res?.data?.success) {
          throw new Error(res?.data?.message || 'Failed to submit report');
        }

        setReportedContentIds((prev) => {
          const next = { ...prev, [id]: true };
          persistReported(next).catch(() => undefined);
          return next;
        });
        setReportModalOpen(false);
        showThankYou();
      } catch (e: any) {
        Alert.alert('Report Failed', e?.message || 'Failed to submit report. Please try again.');
      } finally {
        setReportSubmitting(false);
      }
    },
    [activeAudioMeta, persistReported, reportedContentIds, showThankYou]
  );


  const toCount = useCallback((v: any): number | null => {
    if (v === null || v === undefined) return null;
    const n = typeof v === 'string' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }, []);

  const formatCompactViews = useCallback((v: number | null | undefined): string => {
    const n = typeof v === 'number' && Number.isFinite(v) ? v : null;
    if (n === null) return '—';
    if (n < 1000) return `${n}`;
    if (n < 1_000_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`;
    if (n < 1_000_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  }, []);

  const formatDateLabel = useCallback((raw?: string | null): string => {
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
  }, []);

  const showComingSoon = useCallback((feature: 'Sharing' | 'Offline Downloads') => {
    const message =
      'Feature Coming Soon: We are working hard to bring Sharing/Offline Downloads to you in the next update!';
    if (Platform.OS === 'android') {
      const ToastAndroid = require('react-native').ToastAndroid as typeof import('react-native').ToastAndroid;
      ToastAndroid.show(message, ToastAndroid.LONG);
      return;
    }
    Alert.alert(feature, message);
  }, []);

  const onPressShare = useCallback(() => {
    showComingSoon('Sharing');
  }, [showComingSoon]);

  const onPressDownload = useCallback(() => {
    showComingSoon('Offline Downloads');
  }, [showComingSoon]);

  const onPressLike = useCallback(
    (id: string) => {
      setReactionStateById((prev) => {
        const cur = prev[id] ?? { reaction: null, likeDelta: 0, dislikeDelta: 0 };
        const currentReaction = cur.reaction;
        const nextReaction: 'like' | 'dislike' | null = currentReaction === 'like' ? null : 'like';

        if (currentReaction === 'like') {
          return { ...prev, [id]: { reaction: nextReaction, likeDelta: cur.likeDelta - 1, dislikeDelta: cur.dislikeDelta } };
        }

        if (currentReaction === 'dislike') {
          return {
            ...prev,
            [id]: { reaction: nextReaction, likeDelta: cur.likeDelta + 1, dislikeDelta: cur.dislikeDelta - 1 },
          };
        }

        return { ...prev, [id]: { reaction: nextReaction, likeDelta: cur.likeDelta + 1, dislikeDelta: cur.dislikeDelta } };
      });
    },
    []
  );

  const onPressDislike = useCallback(
    (id: string) => {
      setReactionStateById((prev) => {
        const cur = prev[id] ?? { reaction: null, likeDelta: 0, dislikeDelta: 0 };
        const currentReaction = cur.reaction;
        const nextReaction: 'like' | 'dislike' | null = currentReaction === 'dislike' ? null : 'dislike';

        if (currentReaction === 'dislike') {
          return { ...prev, [id]: { reaction: nextReaction, likeDelta: cur.likeDelta, dislikeDelta: cur.dislikeDelta - 1 } };
        }

        if (currentReaction === 'like') {
          return {
            ...prev,
            [id]: { reaction: nextReaction, likeDelta: cur.likeDelta - 1, dislikeDelta: cur.dislikeDelta + 1 },
          };
        }

        return { ...prev, [id]: { reaction: nextReaction, likeDelta: cur.likeDelta, dislikeDelta: cur.dislikeDelta + 1 } };
      });
    },
    []
  );

  const fetchAll = useCallback(async () => {
    const res = await apiV1.get(`/content?ts=${Date.now()}`, {
      params: {
        mediaType: 'audio',
      },
      headers: {
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });

    const fromResponse = (data: any): ApiContentItem[] => {
      if (!data) return [];
      if (Array.isArray(data?.items)) return data.items;
      if (Array.isArray(data?.data?.items)) return data.data.items;
      if (Array.isArray(data?.result?.items)) return data.result.items;
      if (Array.isArray(data?.content?.items)) return data.content.items;
      if (Array.isArray(data?.content)) return data.content;
      if (Array.isArray(data)) return data;
      return [];
    };

    const raw: ApiContentItem[] = fromResponse(res.data);
    if (raw.length > 0) {
      lastContentItemsRef.current = raw;
    }

    const effectiveRaw: ApiContentItem[] = raw.length > 0 ? raw : lastContentItemsRef.current;

    if (__DEV__) {
      const first = effectiveRaw[0] as any;
      if (first) {
        console.log('[AudioScreen] /content sample item keys', Object.keys(first));
        console.log('[AudioScreen] /content sample item mediaType/type', {
          mediaType: first.mediaType,
          type: first.type,
          media_type: first.media_type,
          fileUrl: first.fileUrl,
          mediaUrl: first.mediaUrl,
        });
      } else {
        console.log('[AudioScreen] /content returned 0 items');
      }
    }

    const detectMediaType = (it: any): 'audio' | 'video' => {
      const raw = (
        `${it?.type ?? ''} ${it?.mediaType ?? ''} ${it?.media_type ?? ''} ${it?.contentType ?? ''} ${
          it?.content_type ?? ''
        }`
      )
        .toString()
        .toLowerCase();

      if (raw.includes('audio')) return 'audio';
      if (raw.includes('video')) return 'video';

      const url = (it?.mediaUrl ?? it?.fileUrl ?? it?.url ?? '').toString().toLowerCase();
      if (url.includes('.mp4') || url.includes('.mov') || url.includes('video')) return 'video';
      if (url.includes('.mp3') || url.includes('.wav') || url.includes('.aac') || url.includes('audio')) return 'audio';

      return 'audio';
    };

    if (__DEV__) {
      const total = effectiveRaw.length;
      let videoCount = 0;
      let audioCount = 0;
      for (const it of effectiveRaw) {
        const t = detectMediaType(it);
        if (t === 'video') videoCount += 1;
        else audioCount += 1;
      }
      console.log('[AudioScreen] /content counts', { total, audioCount, videoCount });
    }

    const mapped: AudioCard[] = effectiveRaw
      .map((it) => {
        const mediaType = detectMediaType(it);
        if (mediaType !== 'audio') return null;

        const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://music-streaming-platform-cvad.onrender.com').replace(/\/+$/, '');
        const thumbStorageKey = (it.thumbnail_storage_key ?? it.thumbnailStorageKey ?? null) as any;
        const artworkFromStorageKey = thumbStorageKey
          ? `${baseUrl}/api/v1/fan/stream/thumbnail/${encodeURIComponent(String(it.id))}`
          : '';
        const artworkUrl =
          (it.thumbnailUrl ?? it.artwork ?? '').toString() || artworkFromStorageKey || FALLBACK_ARTWORK;
        const artistIdValue = it.artistId !== null && it.artistId !== undefined ? String(it.artistId) : undefined;

        const rawMediaUrl = (it.mediaUrl ?? it.fileUrl ?? it.audioUrl ?? '').toString();

        const viewCount = toCount((it as any).viewCount) ?? toCount((it as any).views) ?? null;
        const likeCount = toCount((it as any).likeCount) ?? null;
        const dislikeCount = toCount((it as any).dislikeCount) ?? null;

        return {
          id: String(it.id),
          contentId: String(it.id),
          title: (it.title ?? 'Untitled').toString(),
          artistName: (it.artistName ?? 'Artist').toString(),
          artistId: artistIdValue,
          artworkUrl,
          mediaUrl: rawMediaUrl ? normalizePlaybackUrl(rawMediaUrl) : '',
          useStreamAccess: Boolean(it.useStreamAccess),
          createdAt: (it.createdAt ?? null) as any,
          viewCount,
          likeCount,
          dislikeCount,
        };
      })
      .filter(Boolean) as AudioCard[];

    return mapped;
  }, []);

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const isRefresh = Boolean(opts?.refresh);
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const next = await fetchAll();
        setItems(next);
      } catch (e) {
        if (__DEV__) {
          console.warn('[AudioScreen] load failed', e);
        }
      } finally {
        setRefreshing(false);
        setLoading(false);
      }
    },
    [fetchAll]
  );

  const prefetchPlaybackUrls = useCallback(async (list: AudioCard[]) => {
    const now = Date.now();
    const MAX_AGE_MS = 60_000;
    const CANDIDATES = list
      .filter((x) => x.useStreamAccess)
      .slice(0, 20);

    await Promise.all(
      CANDIDATES.map(async (x) => {
        const key = x.contentId ?? x.id;
        if (!key) return;

        const cached = playbackUrlCacheRef.current.get(key);
        if (cached && now - cached.ts < MAX_AGE_MS && cached.url) return;
        if (prefetchingRef.current.has(key)) return;

        prefetchingRef.current.add(key);
        try {
          const url = await getPlaybackUrl(key, 'audio');
          if (!url) return;
          playbackUrlCacheRef.current.set(key, { url: normalizePlaybackUrl(url), ts: Date.now() });
        } catch {
          // ignore
        } finally {
          prefetchingRef.current.delete(key);
        }
      })
    );
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!items.length) return;
    if (normalizedQuery) return;

    const t = setTimeout(() => {
      prefetchPlaybackUrls(items).catch(() => undefined);
    }, 200);

    return () => {
      clearTimeout(t);
    };
  }, [items, normalizedQuery, prefetchPlaybackUrls]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      const hay = `${x.title} ${x.artistName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const topSongs = useMemo(() => {
    return [...items]
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
        const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 10);
  }, [items]);

  // Build navigation params for FullPlayerScreen — must be after filtered & searchResults
  const buildFullPlayerParams = useCallback(
    (song: AudioCard) => {
      const list = searchResults !== null ? searchResults : filtered;
      const queue: MediaItem[] = list
        .filter((x) => Boolean(x.mediaUrl) || x.useStreamAccess)
        .map((x) => ({
          id: x.id,
          contentId: x.contentId,
          title: x.title,
          artistName: x.artistName,
          artistId: x.artistId,
          mediaType: 'audio' as const,
          artworkUrl: x.artworkUrl,
          mediaUrl:
            playbackUrlCacheRef.current.get(x.contentId ?? x.id)?.url ??
            (x.mediaUrl ? normalizePlaybackUrl(x.mediaUrl) : ''),
          isLocked: false,
          useStreamAccess: x.useStreamAccess,
        }));
      const queueIndex = Math.max(
        0,
        queue.findIndex((q) => q.id === song.id || q.contentId === song.id)
      );
      return {
        songId: song.id,
        title: song.title,
        artist: song.artistName,
        imageUrl: song.artworkUrl || '',
        audioUrl: song.mediaUrl || '',
        queueIndex,
        queue,
      };
    },
    [filtered, searchResults]
  );

  const normalizeForSearch = useCallback((s: string) => {
    return (s ?? '')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const matchesQuery = useCallback(
    (it: AudioCard, q: string) => {
      if (!q) return true;
      const hayRaw = `${it.title ?? ''} ${it.artistName ?? ''}`;
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
          const res = await apiV1.get(`/content?ts=${Date.now()}`, {
            params: {
              mediaType: 'audio',
            },
            headers: {
              'Cache-Control': 'no-store',
              Pragma: 'no-cache',
            },
          });

          const fromResponse = (data: any): ApiContentItem[] => {
            if (!data) return [];
            if (Array.isArray(data?.items)) return data.items;
            if (Array.isArray(data?.data?.items)) return data.data.items;
            if (Array.isArray(data?.result?.items)) return data.result.items;
            if (Array.isArray(data?.content?.items)) return data.content.items;
            if (Array.isArray(data?.content)) return data.content;
            if (Array.isArray(data)) return data;
            return [];
          };

          const raw: ApiContentItem[] = fromResponse(res.data);
          if (requestId !== searchRequestIdRef.current) return;
          if (raw.length > 0) {
            lastContentItemsRef.current = raw;
          }

          const effectiveRaw: ApiContentItem[] = raw.length > 0 ? raw : lastContentItemsRef.current;

          const detectMediaType = (it: any): 'audio' | 'video' => {
            const raw = (
              `${it?.type ?? ''} ${it?.mediaType ?? ''} ${it?.media_type ?? ''} ${it?.contentType ?? ''} ${
                it?.content_type ?? ''
              }`
            )
              .toString()
              .toLowerCase();

            if (raw.includes('audio')) return 'audio';
            if (raw.includes('video')) return 'video';

            const url = (it?.mediaUrl ?? it?.fileUrl ?? it?.url ?? '').toString().toLowerCase();
            if (url.includes('.mp4') || url.includes('.mov') || url.includes('video')) return 'video';
            if (url.includes('.mp3') || url.includes('.wav') || url.includes('.aac') || url.includes('audio'))
              return 'audio';

            return 'audio';
          };

          const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://music-streaming-platform-cvad.onrender.com').replace(/\/+$/, '');

          const mapped: AudioCard[] = effectiveRaw
            .map((it) => {
              const mediaType = detectMediaType(it);
              if (mediaType !== 'audio') return null;

              const thumbStorageKey = (it.thumbnail_storage_key ?? it.thumbnailStorageKey ?? null) as any;
              const artworkFromStorageKey = thumbStorageKey
                ? `${baseUrl}/api/v1/fan/stream/thumbnail/${encodeURIComponent(String(it.id))}`
                : '';

              const artworkUrl =
                (it.thumbnailUrl ?? it.artwork ?? '').toString() || artworkFromStorageKey || FALLBACK_ARTWORK;
              const artistIdValue =
                it.artistId !== null && it.artistId !== undefined ? String(it.artistId) : undefined;

              const rawMediaUrl = (it.mediaUrl ?? it.fileUrl ?? it.audioUrl ?? '').toString();

              const viewCount = toCount((it as any).viewCount) ?? toCount((it as any).views) ?? null;
              const likeCount = toCount((it as any).likeCount) ?? null;
              const dislikeCount = toCount((it as any).dislikeCount) ?? null;

              return {
                id: String(it.id),
                contentId: String(it.id),
                title: (it.title ?? 'Untitled').toString(),
                artistName: (it.artistName ?? 'Artist').toString(),
                artistId: artistIdValue,
                artworkUrl,
                mediaUrl: rawMediaUrl ? normalizePlaybackUrl(rawMediaUrl) : '',
                useStreamAccess: Boolean(it.useStreamAccess),
                createdAt: (it.createdAt ?? null) as any,
                viewCount,
                likeCount,
                dislikeCount,
              };
            })
            .filter(Boolean) as AudioCard[];

          const final = mapped.filter((x) => matchesQuery(x, q));
          setSearchResults(final);
        } catch {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchResults([]);
        } finally {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchLoading(false);
        }
      })().catch(() => undefined);
    }, 250);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [matchesQuery, normalizedQuery]);

  const startPlayback = useCallback(
    async (startId: string) => {
      if (startPlaybackInFlightRef.current) return;
      startPlaybackInFlightRef.current = true;

      const list = searchResults !== null ? searchResults : filtered;

      const queue: MediaItem[] = list
        .filter((x) => Boolean(x.mediaUrl) || x.useStreamAccess)
        .map((x) => ({
          ...(playbackUrlCacheRef.current.get(x.contentId ?? x.id)?.url
            ? { mediaUrl: playbackUrlCacheRef.current.get(x.contentId ?? x.id)?.url ?? '' }
            : {}),
          id: x.id,
          contentId: x.contentId,
          title: x.title,
          artistName: x.artistName,
          artistId: x.artistId,
          mediaType: 'audio',
          artworkUrl: x.artworkUrl,
          mediaUrl:
            playbackUrlCacheRef.current.get(x.contentId ?? x.id)?.url ??
            (x.mediaUrl ? normalizePlaybackUrl(x.mediaUrl) : ''),
          isLocked: false,
          useStreamAccess: x.useStreamAccess,
        }));

      const idx = queue.findIndex((q) => q.id === startId || q.contentId === startId);
      if (idx < 0) return;

      try {
        await playQueue(queue, idx);
      } finally {
        startPlaybackInFlightRef.current = false;
      }
    },
    [filtered, playQueue, searchResults]
  );

  const onPressSong = useCallback(
    (song: AudioCard) => {
      const params = buildFullPlayerParams(song);
      // Navigate to FullPlayer — it will auto-play on mount.
      // If the same song is already playing, the FullPlayer detects it and won't restart.
      navigation.navigate('FullPlayer', params);
    },
    [buildFullPlayerParams, navigation]
  );

  return (
    <LinearGradient colors={Colors.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + (hasActiveAudio ? 120 : 20) }}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
        >
          <View style={styles.headerRow}>
            <Text style={styles.title}>Audio</Text>
          </View>

          <View style={styles.searchWrap}>
            <BlurView intensity={24} tint="dark" style={styles.searchBlur}>
              <SearchIcon color="rgba(255,255,255,0.7)" size={18} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search songs, artists, genres"
                placeholderTextColor="rgba(255,255,255,0.35)"
                style={styles.searchInput}
              />
            </BlurView>
          </View>

          {searchResults !== null ? (
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              {searchLoading ? <ActivityIndicator color="#fff" /> : null}
            </View>
          ) : (
            <>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Top Songs</Text>
                {loading ? <ActivityIndicator color="#fff" /> : null}
              </View>

              <FlatList
                data={topSongs}
                horizontal
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hListContent}
                renderItem={({ item }) => (
                  <Pressable style={styles.topCard} onPress={() => onPressSong(item)}>
                    <Image source={{ uri: item.artworkUrl || FALLBACK_ARTWORK }} style={styles.topImg} />
                    <View style={styles.topMeta}>
                      <Text style={styles.topTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.topSub} numberOfLines={1}>
                        {item.artistName}
                      </Text>
                    </View>
                    <View style={styles.playBadge}>
                      <Play size={14} color="#000" />
                    </View>
                  </Pressable>
                )}
              />
            </>
          )}

          {searchResults === null ? (
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>All Audio</Text>
            </View>
          ) : null}

          <View style={styles.listWrap}>
            {(searchResults ?? filtered).map((song) => (
              <Pressable key={song.id} style={styles.row} onPress={() => onPressSong(song)}>
                <Image source={{ uri: song.artworkUrl || FALLBACK_ARTWORK }} style={styles.rowImg} />
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {song.artistName}
                  </Text>
                </View>
                <View style={styles.rowPlay}>
                  <Play size={16} color="#fff" />
                </View>
              </Pressable>
            ))}

            {searchResults === null ? (
              !loading && filtered.length === 0 ? <Text style={styles.emptyText}>No audio found.</Text> : null
            ) : !searchLoading && (searchResults ?? []).length === 0 ? (
              <Text style={styles.emptyText}>No results found.</Text>
            ) : null}
          </View>
        </ScrollView>


      </SafeAreaView>

      <Modal
        visible={reportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!reportSubmitting) setReportModalOpen(false);
        }}
      >
        <Pressable
          style={styles.reportModalBackdrop}
          onPress={() => {
            if (!reportSubmitting) setReportModalOpen(false);
          }}
        />
        <View style={styles.reportModalCard}>
          <Text style={styles.reportModalTitle}>Report content</Text>
          <Text style={styles.reportModalSub}>Select a reason</Text>

          <Pressable
            style={({ pressed }) => [styles.reportReasonBtn, pressed ? styles.reportReasonBtnPressed : null]}
            disabled={reportSubmitting}
            onPress={() => submitReport('Spam')}
          >
            <Text style={styles.reportReasonText}>Spam</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.reportReasonBtn, pressed ? styles.reportReasonBtnPressed : null]}
            disabled={reportSubmitting}
            onPress={() => submitReport('Inappropriate')}
          >
            <Text style={styles.reportReasonText}>Inappropriate</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.reportReasonBtn, pressed ? styles.reportReasonBtnPressed : null]}
            disabled={reportSubmitting}
            onPress={() => submitReport('Copyright')}
          >
            <Text style={styles.reportReasonText}>Copyright</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.reportCancelBtn, pressed ? styles.reportCancelBtnPressed : null]}
            disabled={reportSubmitting}
            onPress={() => setReportModalOpen(false)}
          >
            <Text style={styles.reportCancelText}>{reportSubmitting ? 'Submitting...' : 'Cancel'}</Text>
          </Pressable>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flex: 1, backgroundColor: 'transparent' },


  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: { color: '#fff', fontSize: 28, fontWeight: '900' },

  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },

  sectionRow: {
    marginTop: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '800',
  },

  hListContent: {
    paddingLeft: 20,
    paddingRight: 10,
    paddingTop: 12,
  },
  topCard: {
    width: 168,
    marginRight: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  topImg: { width: '100%', height: 110 },
  topMeta: { padding: 12 },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  topSub: { marginTop: 4, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  playBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },

  nowPlayingWrap: {
    marginTop: 16,
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nowPlayingHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  nowPlayingRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nowPlayingHidePill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  nowPlayingHideText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '900',
  },
  nowPlayingTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  nowPlayingSub: { marginTop: 4, color: 'rgba(255,255,255,0.62)', fontSize: 12, fontWeight: '700' },
  nowPlayingToggle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  nowPlayingCollapsedWrap: {
    marginTop: 12,
    marginHorizontal: 20,
    alignItems: 'flex-end',
  },
  nowPlayingShowPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  nowPlayingShowText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '900',
  },

  inlinePlayerWrap: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inlinePlayerTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inlineTime: {
    color: 'rgba(255,255,255,0.80)',
    fontSize: 11,
    fontWeight: '800',
  },
  inlineSlider: {
    width: '100%',
    height: 18,
  },
  inlineControls: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  inlineBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  inlinePlayImg: {
    width: 24,
    height: 24,
  },

  engagementRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  engagementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  engagementBtnActive: {
    backgroundColor: 'rgba(255,106,0,0.16)',
    borderColor: 'rgba(255,106,0,0.55)',
  },
  engagementCount: { color: 'rgba(255,255,255,0.90)', fontSize: 12, fontWeight: '900' },
  engagementCountActive: { color: Colors.accent },
  reportBtnDisabled: {
    opacity: 0.65,
  },
  reportTextDisabled: {
    color: 'rgba(255,255,255,0.40)',
  },

  reportModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  reportModalCard: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 26,
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(20,20,20,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  reportModalTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  reportModalSub: {
    marginTop: 6,
    marginBottom: 12,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '700',
  },
  reportReasonBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    marginBottom: 10,
  },
  reportReasonBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  reportReasonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  reportCancelBtn: {
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  reportCancelBtnPressed: {
    opacity: 0.85,
  },
  reportCancelText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '800',
  },

  listWrap: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 10,
  },
  rowImg: { width: 46, height: 46, borderRadius: 12 },
  rowMeta: { flex: 1, marginLeft: 12 },
  rowTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  rowSub: { marginTop: 4, color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '700' },
  rowPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  emptyText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
