import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BlurView } from 'expo-blur';
import { Play, Search as SearchIcon } from 'lucide-react-native';

import { apiV1 } from '../services/api';
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
  title: string;
  artistName: string;
  artistId?: string;
  artworkUrl: string;
  mediaUrl: string;
  useStreamAccess?: boolean;
  genre: string;
  createdAt?: string | null;
};

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

function normalizeGenre(raw: unknown): string {
  const g = (raw ?? '').toString().trim();
  return g || 'Other';
}

export default function AudioScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const { playQueue } = useMediaPlayer();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<AudioCard[]>([]);

  const fetchAll = useCallback(async () => {
    const res = await apiV1.get('/content');
    const raw: ApiContentItem[] = Array.isArray(res.data?.items) ? res.data.items : [];

    const mapped: AudioCard[] = raw
      .map((it) => {
        const mediaTypeRaw = (it.mediaType ?? it.type ?? '').toString().toLowerCase();
        const mediaType = mediaTypeRaw === 'video' ? 'video' : 'audio';
        if (mediaType !== 'audio') return null;

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
          genre: normalizeGenre(it.genre),
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => {
      const hay = `${x.title} ${x.artistName} ${x.genre}`.toLowerCase();
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

  const genres = useMemo(() => {
    const set = new Set<string>();
    items.forEach((x) => set.add(normalizeGenre(x.genre)));
    return Array.from(set).sort((a, b) => a.localeCompare(b)).slice(0, 12);
  }, [items]);

  const startPlayback = useCallback(
    async (startId: string) => {
      const queue: MediaItem[] = filtered
        .filter((x) => Boolean(x.mediaUrl) || x.useStreamAccess)
        .map((x) => ({
          id: x.id,
          contentId: x.id,
          title: x.title,
          artistName: x.artistName,
          artistId: x.artistId,
          mediaType: 'audio',
          artworkUrl: x.artworkUrl,
          mediaUrl: x.mediaUrl || '',
          isLocked: false,
          useStreamAccess: x.useStreamAccess,
        }));

      const idx = queue.findIndex((q) => q.id === startId || q.contentId === startId);
      if (idx < 0) return;
      await playQueue(queue, idx);
    },
    [filtered, playQueue]
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

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Genres</Text>
          <View style={styles.genreWrap}>
            {genres.map((g) => (
              <Pressable key={g} style={styles.genrePill} onPress={() => setQuery(g)}>
                <Text style={styles.genreText}>{g}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>All Audio</Text>
          <View style={styles.listWrap}>
            {filtered.map((song) => (
              <Pressable key={song.id} style={styles.row} onPress={() => onPressSong(song)}>
                <Image source={{ uri: song.artworkUrl || FALLBACK_ARTWORK }} style={styles.rowImg} />
                <View style={styles.rowMeta}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {song.title}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {song.artistName} • {song.genre}
                  </Text>
                </View>
                <View style={styles.rowPlay}>
                  <Play size={16} color="#fff" />
                </View>
              </Pressable>
            ))}
            {!loading && filtered.length === 0 ? (
              <Text style={styles.emptyText}>No audio found.</Text>
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

  genreWrap: {
    paddingHorizontal: 20,
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  genrePill: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  genreText: { color: '#fff', fontSize: 12, fontWeight: '800' },

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
