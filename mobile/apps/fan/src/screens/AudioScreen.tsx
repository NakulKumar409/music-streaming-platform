import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import { Play, Search as SearchIcon } from 'lucide-react-native';

import { apiV1 } from '../services/api';
import { getPlaybackUrl, normalizePlaybackUrl } from '../services/streamService';
import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import type { MediaItem } from '../media.types';

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
  artistName?: string | null;
  artistId?: string | number | null;
  createdAt?: string | null;
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
};

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

export default function AudioScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const { playQueue } = useMediaPlayer();

  const lastContentItemsRef = useRef<ApiContentItem[]>([]);

  const playbackUrlCacheRef = useRef<Map<string, { url: string; ts: number }>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const [items, setItems] = useState<AudioCard[]>([]);

  const [searchResults, setSearchResults] = useState<AudioCard[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

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

        const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
        const thumbStorageKey = (it.thumbnail_storage_key ?? it.thumbnailStorageKey ?? null) as any;
        const artworkFromStorageKey = thumbStorageKey
          ? `${baseUrl}/api/v1/fan/stream/thumbnail/${encodeURIComponent(String(it.id))}`
          : '';
        const artworkUrl =
          (it.thumbnailUrl ?? it.artwork ?? '').toString() || artworkFromStorageKey || FALLBACK_ARTWORK;
        const artistIdValue = it.artistId !== null && it.artistId !== undefined ? String(it.artistId) : undefined;

        const rawMediaUrl = (it.mediaUrl ?? it.fileUrl ?? '').toString();

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

          const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

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

              const rawMediaUrl = (it.mediaUrl ?? it.fileUrl ?? '').toString();

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
      await playQueue(queue, idx);
    },
    [filtered, playQueue, searchResults]
  );

  const onPressSong = useCallback(
    (song: AudioCard) => {
      startPlayback(song.id).catch(() => undefined);
    },
    [startPlayback]
  );

  return (
    <LinearGradient colors={Colors.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 140 }}
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

          {searchResults === null ? (
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
          ) : (
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Search Results</Text>
              {searchLoading ? <ActivityIndicator color="#fff" /> : null}
            </View>
          )}

          {searchResults === null ? (
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>All Audio</Text>
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
