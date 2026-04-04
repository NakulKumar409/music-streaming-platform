import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiV1, contentApi } from '../services/api';
import { getPlaybackUrl, normalizePlaybackUrl } from '../services/streamService';
import { API_HOST_BASE_URL } from '../config/env';
import { fetchVerifiedArtists } from '../services/artistService';
import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import type { MediaItem } from '../media.types';

// New Architecture Components
import AudioHeader from '../ui/audio/AudioHeader';
import CategoryChips, { CategoryType } from '../ui/audio/CategoryChips';
import FeaturedCarousel from '../ui/audio/FeaturedCarousel';
import AudioListItem, { AudioItemData } from '../ui/audio/AudioListItem';
import ArtistListItem from '../ui/audio/ArtistListItem';

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
  useStreamAccess?: boolean;
};

type AudioCard = AudioItemData & {
  artistId?: string;
  contentId: string;
  mediaUrl: string;
  useStreamAccess?: boolean;
  createdAt?: string | null;
};

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

export default function AudioScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const { playQueue, currentItem, state: playerState } = useMediaPlayer();

  const lastContentItemsRef = useRef<ApiContentItem[]>([]);
  const playbackUrlCacheRef = useRef<Map<string, { url: string; ts: number }>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const normalizedQuery = useMemo(() => query.trim().toLowerCase(), [query]);
  const [activeCategory, setActiveCategory] = useState<CategoryType>('All');
  const [items, setItems] = useState<AudioCard[]>([]);

  const [searchResults, setSearchResults] = useState<AudioCard[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Pagination states for Artists
  const [artists, setArtists] = useState<any[]>([]);
  const [artistsOffset, setArtistsOffset] = useState(0);
  const [hasMoreArtists, setHasMoreArtists] = useState(true);
  const [fetchingArtists, setFetchingArtists] = useState(false);

  const hasActiveAudio = Boolean(currentItem?.mediaType === 'audio');

  const fetchAll = useCallback(async () => {
    const res = await apiV1.get(`/content?ts=${Date.now()}`, {
      params: { mediaType: 'audio' },
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
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

    const mapped: AudioCard[] = effectiveRaw.map((it) => {
      const baseUrl = API_HOST_BASE_URL;
      const thumbStorageKey = (it.thumbnail_storage_key ?? it.thumbnailStorageKey ?? null) as any;
      const artworkFromStorageKey = thumbStorageKey
        ? `${baseUrl}/api/v1/fan/stream/thumbnail/${encodeURIComponent(String(it.id))}`
        : '';
      const artworkUrl = (it.thumbnailUrl ?? it.artwork ?? '').toString() || artworkFromStorageKey || FALLBACK_ARTWORK;
      const artistIdValue = it.artistId !== null && it.artistId !== undefined ? String(it.artistId) : undefined;
      const rawMediaUrl = (it.mediaUrl ?? it.fileUrl ?? it.audioUrl ?? '').toString();

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
    }).filter(Boolean) as AudioCard[];

    return mapped;
  }, []);

  const load = useCallback(async (opts?: { refresh?: boolean }) => {
    const isRefresh = Boolean(opts?.refresh);
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const next = await fetchAll();
      setItems(next);
    } catch (e) {
      if (__DEV__) console.warn('[AudioScreen] load failed', e);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [fetchAll]);

  const loadArtists = useCallback(async (isRefresh = false) => {
    if (fetchingArtists || (!isRefresh && !hasMoreArtists)) return;
    try {
      setFetchingArtists(true);
      const limit = 20;
      const currentOffset = isRefresh ? 0 : artistsOffset;
      const fetched = await fetchVerifiedArtists(limit, currentOffset);
      
      if (isRefresh) {
        setArtists(fetched);
      } else {
        const appended = [...artists, ...fetched];
        // naive deduplication
        const unique = Array.from(new Map(appended.map(item => [item.id, item])).values());
        setArtists(unique);
      }
      
      setArtistsOffset(currentOffset + fetched.length);
      setHasMoreArtists(fetched.length >= limit);
    } catch (e) {
      if (__DEV__) console.warn('[AudioScreen] fetchVerifiedArtists failed:', e);
    } finally {
      setFetchingArtists(false);
    }
  }, [artists, artistsOffset, fetchingArtists, hasMoreArtists]);

  useEffect(() => {
    if (activeCategory === 'Artists' && artists.length === 0) {
      loadArtists(true).catch(() => undefined);
    }
  }, [activeCategory, artists.length, loadArtists]);

  const prefetchPlaybackUrls = useCallback(async (list: AudioCard[]) => {
    const now = Date.now();
    const MAX_AGE_MS = 60_000;
    const CANDIDATES = list.filter((x) => x.useStreamAccess).slice(0, 20);

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
        } finally {
          prefetchingRef.current.delete(key);
        }
      })
    );
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load])
  );

  useEffect(() => {
    if (!items.length) return;
    if (normalizedQuery) return;
    const t = setTimeout(() => { prefetchPlaybackUrls(items).catch(() => undefined); }, 200);
    return () => clearTimeout(t);
  }, [items, normalizedQuery, prefetchPlaybackUrls]);

  const filtered = useMemo(() => {
    const q = normalizedQuery;
    let base = items;

    // Optional client-side category filtering (basic demo logic)
    if (activeCategory !== 'All') {
      if (activeCategory === 'Trending') {
        base = [...items].reverse(); // Mock trending
      } else if (activeCategory === 'Albums') {
        base = items.filter((_, i) => i % 2 === 1);
      }
    }

    if (!q) return base;
    return base.filter((x) => {
      const hay = `${x.title} ${x.artistName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, normalizedQuery, activeCategory]);

  const topSongs = useMemo(() => {
    return [...items]
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
        const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 5);
  }, [items]);

  const buildFullPlayerParams = useCallback((song: AudioCard) => {
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
    const queueIndex = Math.max(0, queue.findIndex((q) => q.id === song.id || q.contentId === song.id));
    return {
      songId: song.id,
      title: song.title,
      artist: song.artistName,
      imageUrl: song.artworkUrl || '',
      audioUrl: song.mediaUrl || '',
      queueIndex,
      queue,
    };
  }, [filtered, searchResults]);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }

    if (!normalizedQuery) {
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
            params: { mediaType: 'audio' },
            headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
          });

          const raw = res.data?.items || res.data?.data?.items || res.data?.result?.items || [];
          if (requestId !== searchRequestIdRef.current) return;
          
          if (raw.length > 0) {
            lastContentItemsRef.current = raw;
          }

          const effectiveRaw: ApiContentItem[] = raw.length > 0 ? raw : lastContentItemsRef.current;
          
          const mapped: AudioCard[] = effectiveRaw.map((it: any) => {
            const baseUrl = API_HOST_BASE_URL;
            const thumbStorageKey = (it.thumbnail_storage_key ?? it.thumbnailStorageKey ?? null) as any;
            const artworkFromStorageKey = thumbStorageKey
              ? `${baseUrl}/api/v1/fan/stream/thumbnail/${encodeURIComponent(String(it.id))}`
              : '';
            const artworkUrl = (it.thumbnailUrl ?? it.artwork ?? '').toString() || artworkFromStorageKey || FALLBACK_ARTWORK;
            const artistIdValue = it.artistId !== null && it.artistId !== undefined ? String(it.artistId) : undefined;
            const rawMediaUrl = (it.mediaUrl ?? it.fileUrl ?? it.audioUrl ?? '').toString();

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
          });

          const final = mapped.filter((x) => `${x.title} ${x.artistName}`.toLowerCase().includes(normalizedQuery));
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
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [normalizedQuery]);

  const onPressSong = useCallback((song: AudioCard) => {
    const params = buildFullPlayerParams(song);
    navigation.navigate('FullPlayer', params);
  }, [buildFullPlayerParams, navigation]);


  const renderHeader = () => {
    return (
      <View>
        <AudioHeader query={query} setQuery={setQuery} />
        {!normalizedQuery && (
          <CategoryChips
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />
        )}
        
        {searchResults !== null ? (
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Search Results</Text>
            {searchLoading && <ActivityIndicator color={Colors.accent} size="small" />}
          </View>
        ) : (
          <FeaturedCarousel items={topSongs} onPressItem={onPressSong} isLoading={loading} />
        )}
        
        {searchResults === null && (
          <View style={[styles.sectionRow, { marginBottom: 10 }]}>
            <Text style={styles.sectionTitle}>{activeCategory === 'All' ? 'All Audio' : activeCategory}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading || searchLoading) {
      return (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>
          {searchResults !== null ? 'No results found.' : 'No audio found.'}
        </Text>
      </View>
    );
  };

  return (
    <LinearGradient colors={['#0A0A0A', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <FlatList
          data={activeCategory === 'Artists' ? artists : (searchResults ?? filtered)}
          keyExtractor={(item) => item.id}
          renderItem={({ item }: any) => {
            if (activeCategory === 'Artists') {
              return (
                <ArtistListItem 
                  item={item} 
                  onPress={() => navigation.navigate('Artist', { artistId: item.id })} 
                />
              );
            }
            const isActive = Boolean(currentItem && (item.id === currentItem.id || item.contentId === currentItem.contentId || item.id === currentItem.contentId || item.contentId === currentItem.id));
            return (
              <AudioListItem 
                item={item} 
                onPress={onPressSong} 
                isActive={isActive} 
                isPlaying={playerState.isPlaying} 
              />
            );
          }}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={fetchingArtists && activeCategory === 'Artists' ? <ActivityIndicator color={Colors.accent} size="large" style={{ marginVertical: 20 }} /> : null}
          onEndReached={() => {
            if (activeCategory === 'Artists') loadArtists(false);
          }}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + (hasActiveAudio ? 120 : 20) }}
          refreshControl={
            <RefreshControl 
              tintColor={Colors.accent} 
              refreshing={refreshing} 
              onRefresh={() => {
                if (activeCategory === 'Artists') {
                  loadArtists(true);
                } else {
                  load({ refresh: true });
                }
              }} 
            />
          }
        />
      </SafeAreaView>

      <Modal visible={reportModalOpen} transparent animationType="fade" onRequestClose={() => { if (!reportSubmitting) setReportModalOpen(false); }}>
        <Pressable style={styles.reportModalBackdrop} onPress={() => { if (!reportSubmitting) setReportModalOpen(false); }} />
        <View style={styles.reportModalCard}>
          <Text style={styles.reportModalTitle}>Report content</Text>
          <Text style={styles.reportModalSub}>Select a reason</Text>

          {['Spam', 'Inappropriate', 'Copyright'].map((reason) => (
            <Pressable
              key={reason}
              style={({ pressed }) => [styles.reportReasonBtn, pressed && styles.reportReasonBtnPressed]}
              disabled={reportSubmitting}
              onPress={() => setReportModalOpen(false)}
            >
              <Text style={styles.reportReasonText}>{reason}</Text>
            </Pressable>
          ))}

          <Pressable
            style={({ pressed }) => [styles.reportCancelBtn, pressed && styles.reportCancelBtnPressed]}
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
  sectionRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
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
});
