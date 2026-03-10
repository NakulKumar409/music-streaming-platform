import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Play, Search as SearchIcon } from 'lucide-react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

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
};

type VideoCard = {
  id: string;
  title: string;
  artistName: string;
  artistId?: string;
  artworkUrl: string;
  mediaUrl: string;
  useStreamAccess?: boolean;
  category: string;
  createdAt?: string | null;
};

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1400&q=80';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 12;
const GRID_COLS = 2;
const GRID_ITEM_W = (SCREEN_WIDTH - 20 * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS;
const GRID_ITEM_H = Math.round(GRID_ITEM_W * (9 / 16) + 60);

function normalizeCategory(raw: unknown): string {
  const c = (raw ?? '').toString().trim();
  return c || 'Trending';
}

export default function VideoScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const { currentItem, state: playerState, togglePlayPause } = useMediaPlayer();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [items, setItems] = useState<VideoCard[]>([]);

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [activeVideoMeta, setActiveVideoMeta] = useState<VideoCard | null>(null);
  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(null);
  const [loadingPlaybackUrl, setLoadingPlaybackUrl] = useState(false);

  const fetchAll = useCallback(async () => {
    const res = await apiV1.get('/content');
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
          useStreamAccess: Boolean(it.useStreamAccess),
          category: normalizeCategory(it.genre),
          createdAt: (it.createdAt ?? null) as any,
        };
      })
      .filter(Boolean) as VideoCard[];

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

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((x) => set.add(normalizeCategory(x.category)));
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ['All', 'Trending Videos', ...list.filter((x) => x !== 'Trending Videos')].slice(0, 14);
  }, [items]);

  const trending = useMemo(() => {
    return [...items]
      .sort((a, b) => {
        const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
        const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((x) => {
      if (activeCategory !== 'All') {
        if (activeCategory === 'Trending Videos') {
          // keep all; trending section already shown
        } else if (normalizeCategory(x.category) !== activeCategory) {
          return false;
        }
      }

      if (!q) return true;
      const hay = `${x.title} ${x.artistName} ${x.category}`.toLowerCase();
      return hay.includes(q);
    });
  }, [activeCategory, items, query]);

  const pauseGlobalAudioIfNeeded = useCallback(async () => {
    if (currentItem?.mediaType !== 'audio') return;
    if (!playerState.isPlaying) return;
    try {
      await togglePlayPause();
    } catch {
      // ignore
    }
  }, [currentItem?.mediaType, playerState.isPlaying, togglePlayPause]);

  const resolvePlaybackUrl = useCallback(async (video: VideoCard) => {
    if (video.useStreamAccess) {
      return await streamService.getPlaybackUrl(video.id, 'video');
    }
    return video.mediaUrl ? streamService.normalizePlaybackUrl(video.mediaUrl) : '';
  }, []);

  const onPressVideo = useCallback(
    (video: VideoCard) => {
      (async () => {
        setActiveVideoId(video.id);
        setActiveVideoMeta(video);

        await pauseGlobalAudioIfNeeded();

        setLoadingPlaybackUrl(true);
        try {
          const url = await resolvePlaybackUrl(video);
          if (!url) return;
          setActivePlaybackUrl(url);
        } catch {
          // keep placeholder
          setActivePlaybackUrl(null);
        } finally {
          setLoadingPlaybackUrl(false);
        }
      })().catch(() => undefined);
    },
    [pauseGlobalAudioIfNeeded, resolvePlaybackUrl]
  );

  const player = useVideoPlayer(
    activePlaybackUrl ? { uri: activePlaybackUrl } : null,
    (p) => {
      try {
        p.play();
      } catch {
        // ignore
      }
    }
  );

  const renderGridItem = useCallback(
    ({ item }: { item: VideoCard }) => {
      const isActive = item.id === activeVideoId;
      return (
      <Pressable
        style={[styles.gridItem, isActive ? styles.gridItemActive : null]}
        onPress={() => onPressVideo(item)}
      >
        <View style={styles.thumbWrap}>
          <Image source={{ uri: item.artworkUrl || FALLBACK_ARTWORK }} style={styles.thumb} />
          <View style={styles.playOverlay}>
            <View style={styles.playBadge}>
              <Play size={16} color="#000" />
            </View>
          </View>
          {isActive ? <View style={styles.playingPill} /> : null}
        </View>
        <Text style={styles.gridTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.gridSub} numberOfLines={1}>
          {item.artistName}
        </Text>
      </Pressable>
      );
    },
    [activeVideoId, onPressVideo]
  );

  return (
    <LinearGradient colors={Colors.backgroundGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Video</Text>
        </View>

        <View style={styles.headerPlayerWrap}>
          <BlurView intensity={26} tint="dark" style={styles.headerPlayerBlur}>
            <View style={styles.headerPlayerFrame}>
              {activePlaybackUrl && player ? (
                <VideoView
                  player={player}
                  style={styles.headerPlayerVideo}
                  allowsFullscreen
                  allowsPictureInPicture
                />
              ) : (
                <View style={styles.headerPlaceholder}>
                  <Image
                    source={{ uri: activeVideoMeta?.artworkUrl || FALLBACK_ARTWORK }}
                    style={styles.headerPlaceholderImg}
                    blurRadius={8}
                  />
                  <View style={styles.headerPlaceholderOverlay}>
                    {loadingPlaybackUrl ? <ActivityIndicator color="#fff" /> : null}
                    <Text style={styles.headerPlaceholderText}>
                      {loadingPlaybackUrl
                        ? 'Loading video...'
                        : 'Select a video to play'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.headerMetaRow}>
              <Text style={styles.headerNowPlayingTitle} numberOfLines={1}>
                {activeVideoMeta?.title ? activeVideoMeta.title : 'Trending Videos'}
              </Text>
              <Text style={styles.headerNowPlayingSub} numberOfLines={1}>
                {activeVideoMeta?.artistName ? activeVideoMeta.artistName : 'Tap any video below to start playing'}
              </Text>
            </View>
          </BlurView>
        </View>

        <FlatList
          data={['__content__']}
          keyExtractor={(x) => x}
          renderItem={() => null}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 140 }}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={() => load({ refresh: true })} />}
          ListHeaderComponent={
            <View>
              <View style={styles.searchWrap}>
                <BlurView intensity={24} tint="dark" style={styles.searchBlur}>
                  <SearchIcon color="rgba(255,255,255,0.7)" size={18} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search videos"
                    placeholderTextColor="rgba(255,255,255,0.35)"
                    style={styles.searchInput}
                  />
                </BlurView>
              </View>

              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Trending Videos</Text>
                {loading ? <ActivityIndicator color="#fff" /> : null}
              </View>

              <FlatList
                data={trending}
                horizontal
                keyExtractor={(i) => i.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hListContent}
                renderItem={({ item }) => {
                  const isActive = item.id === activeVideoId;
                  return (
                    <Pressable
                      style={[styles.trendingCard, isActive ? styles.trendingCardActive : null]}
                      onPress={() => onPressVideo(item)}
                    >
                      <Image source={{ uri: item.artworkUrl || FALLBACK_ARTWORK }} style={styles.trendingImg} />
                      <View style={styles.trendingMeta}>
                        <Text style={styles.trendingTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.trendingSub} numberOfLines={1}>
                          {item.artistName}
                        </Text>
                      </View>
                      {isActive ? <View style={styles.trendingPlayingBar} /> : null}
                    </Pressable>
                  );
                }}
              />

              <Text style={[styles.sectionTitle, { marginTop: 20, paddingHorizontal: 20 }]}>Categories</Text>
              <FlatList
                data={categories}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(c) => c}
                contentContainerStyle={styles.catRow}
                renderItem={({ item: c }) => {
                  const active = c === activeCategory;
                  return (
                    <Pressable
                      key={c}
                      style={[styles.catPill, active ? styles.catPillActive : null]}
                      onPress={() => setActiveCategory(c)}
                    >
                      <Text style={[styles.catText, active ? styles.catTextActive : null]}>{c}</Text>
                    </Pressable>
                  );
                }}
              />

              <Text style={[styles.sectionTitle, { marginTop: 18, paddingHorizontal: 20 }]}>Explore</Text>
              <View style={styles.gridWrap}>
                <FlatList
                  data={filtered}
                  renderItem={renderGridItem}
                  keyExtractor={(i) => i.id}
                  numColumns={GRID_COLS}
                  scrollEnabled={false}
                  columnWrapperStyle={{ gap: GRID_GAP }}
                  contentContainerStyle={{ paddingTop: 10, paddingBottom: 10, gap: GRID_GAP }}
                />
              </View>

              {!loading && filtered.length === 0 ? (
                <Text style={styles.emptyText}>No videos found.</Text>
              ) : null}
            </View>
          }
        />
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

  headerPlayerWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headerPlayerBlur: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,10,10,0.30)',
  },
  headerPlayerFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  headerPlayerVideo: {
    width: '100%',
    height: '100%',
  },
  headerPlaceholder: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  headerPlaceholderImg: {
    width: '100%',
    height: '100%',
    opacity: 0.9,
  },
  headerPlaceholderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 18,
  },
  headerPlaceholderText: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerMetaRow: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerNowPlayingTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  headerNowPlayingSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },

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
  trendingCard: {
    width: 210,
    marginRight: 12,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  trendingCardActive: {
    borderColor: 'rgba(255,106,0,0.55)',
    backgroundColor: 'rgba(255,106,0,0.10)',
  },
  trendingImg: { width: '100%', height: 118 },
  trendingMeta: { padding: 12 },
  trendingTitle: { color: '#fff', fontSize: 14, fontWeight: '900' },
  trendingSub: { marginTop: 4, color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  trendingPlayingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: Colors.accent,
  },

  catRow: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  catPillActive: {
    borderColor: 'rgba(255,106,0,0.6)',
    backgroundColor: 'rgba(255,106,0,0.16)',
  },
  catText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  catTextActive: { color: Colors.accent },

  gridWrap: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  gridItem: {
    width: GRID_ITEM_W,
    minHeight: GRID_ITEM_H,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 12,
  },
  gridItemActive: {
    borderColor: 'rgba(255,106,0,0.55)',
    backgroundColor: 'rgba(255,106,0,0.10)',
  },
  thumbWrap: {
    width: '100%',
    height: Math.round(GRID_ITEM_W * (9 / 16)),
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  thumb: { width: '100%', height: '100%' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.10)',
  },
  playBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
  },
  playingPill: {
    position: 'absolute',
    left: 10,
    top: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  gridTitle: {
    paddingHorizontal: 12,
    paddingTop: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  gridSub: {
    paddingHorizontal: 12,
    paddingTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },

  emptyText: {
    marginTop: 16,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
