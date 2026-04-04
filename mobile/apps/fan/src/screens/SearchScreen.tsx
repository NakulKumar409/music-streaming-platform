import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search as SearchIcon, X, User } from 'lucide-react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { AxiosRequestConfig } from 'axios';

import { Colors } from '../theme';
import { api } from '../services/api';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import { useQuery } from '@tanstack/react-query';
import { getOptimizedImageUrl } from '../utils/cloudinary';

type Artist = {
  id: number;
  name: string;
  profileImageUrl: string | null;
  isVerified: boolean;
  subscriptionPrice: number;
  genre: string;
};

type SearchHistoryItem = {
  id: number;
  user_id: number;
  query: string;
  created_at: string;
};

const RECENT_SEARCHES_STORAGE_KEY = 'recentSearches';

const ArtistItem = React.memo(({ item, onPress }: { item: Artist; onPress: (item: Artist) => void }) => (
  <Pressable style={styles.artistRow} onPress={() => onPress(item)}>
    <View style={styles.artistThumbWrap}>
      {item.profileImageUrl ? (
        <Image source={{ uri: getOptimizedImageUrl(item.profileImageUrl) }} style={styles.artistThumb} />
      ) : (
        <View style={styles.artistThumbPlaceholder}>
          <User color="rgba(255,255,255,0.5)" size={24} />
        </View>
      )}
    </View>
    <View style={styles.artistInfo}>
      <Text style={styles.artistName} numberOfLines={1}>
        {item.name}
      </Text>
      {item.genre ? (
        <Text style={styles.artistGenre} numberOfLines={1}>
          {item.genre}
        </Text>
      ) : null}
    </View>
  </Pressable>
));

const HistoryItem = React.memo(({ item, onPress, onDelete }: { item: SearchHistoryItem; onPress: (item: SearchHistoryItem) => void; onDelete: (id: number) => void }) => (
  <BlurView intensity={18} tint="dark" style={styles.historyRow}>
    <Pressable
      style={{ flex: 1 }}
      onPress={() => onPress(item)}
    >
      <Text style={styles.historyText} numberOfLines={1}>
        {item.query}
      </Text>
    </Pressable>
    <Pressable
      accessibilityLabel="Delete recent search"
      style={styles.historyDeleteBtn}
      onPress={() => onDelete(item.id)}
    >
      <X color="#fff" size={16} />
    </Pressable>
  </BlurView>
));

export default function SearchScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const { currentItem } = useMediaPlayer();
  const activeAudioMeta = currentItem?.mediaType === 'audio' ? currentItem : null;
  const hasActiveAudio = !!activeAudioMeta;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<SearchHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const inputRef = useRef<TextInput | null>(null);

  // Debounce: update debouncedQuery 300ms after user stops typing
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load recent searches from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const fallback = parsed
            .map((q: any, idx: number) => ({
              id: -(idx + 1),
              user_id: 0,
              query: (q ?? '').toString(),
              created_at: new Date().toISOString(),
            }))
            .filter((x) => x.query.trim().length > 0);
          setRecentSearches(fallback);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  // Persist recent searches to AsyncStorage
  const persistHistoryFallback = useCallback(async (items: SearchHistoryItem[]) => {
    try {
      const queries = items
        .map((x) => x.query)
        .filter((q) => q.trim().length > 0)
        .slice(0, 10);
      await AsyncStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(queries));
    } catch {
      // ignore
    }
  }, []);

  // Fetch search history from API
  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get('/search/history');
      const items = (res.data?.items ?? []) as SearchHistoryItem[];
      setRecentSearches(items);
      await persistHistoryFallback(items);
    } catch {
      // ignore
    } finally {
      setIsLoadingHistory(false);
    }
  }, [persistHistoryFallback]);

  // Load history when search is focused and empty
  useEffect(() => {
    if (!isSearchFocused) return;
    if (searchQuery.trim().length > 0) return;
    fetchHistory().catch(() => undefined);
  }, [fetchHistory, isSearchFocused, searchQuery]);

  // Save search query to history
  const saveHistory = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;
      try {
        await api.post('/search/history', { query: q });
        await fetchHistory();
      } catch {
        // ignore
      }
    },
    [fetchHistory]
  );

  // Delete history item
  const deleteHistoryItem = useCallback(
    async (id: number) => {
      if (id < 0) {
        const next = recentSearches.filter((x) => x.id !== id);
        setRecentSearches(next);
        await persistHistoryFallback(next);
        return;
      }
      try {
        await api.delete(`/search/history/${id}`);
      } catch {
        // ignore
      }
      await fetchHistory();
    },
    [fetchHistory, persistHistoryFallback, recentSearches]
  );

  // React Query: fetch artists for debouncedQuery
  // staleTime is inherited from the global QueryClient default (5 min)
  // React Query provides an AbortSignal via queryFn context — no manual AbortController needed
  const {
    data: searchData,
    isFetching: isLoading,
  } = useQuery({
    queryKey: ['artistSearch', debouncedQuery],
    queryFn: async ({ signal }) => {
      const res = await api.get(
        `/artists/search?q=${encodeURIComponent(debouncedQuery)}`,
        { signal }
      );
      return (res.data?.artists ?? []) as Artist[];
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const artists = searchData ?? [];

  // Cleanup on unmount (React Query handles in-flight cancellation via signal)
  useEffect(() => {
    return () => { /* no-op — React Query cancels via AbortSignal */ };
  }, []);

  // Navigate to artist profile
  const navigateToArtist = useCallback(
    (artist: Artist) => {
      saveHistory(artist.name).catch(() => undefined);
      navigation.navigate('HomeTab', {
        screen: 'Artist',
        params: { artistId: artist.id },
      });
    },
    [navigation, saveHistory]
  );

  // Clear search input
  const onClearSearch = useCallback(() => {
    setSearchQuery('');
    inputRef.current?.focus();
  }, []);

  // Render artist item
  const renderArtistItem = useCallback(
    ({ item }: { item: Artist }) => (
      <ArtistItem item={item} onPress={navigateToArtist} />
    ),
    [navigateToArtist]
  );

  // Render history item
  const renderHistoryItem = useCallback(
    ({ item }: { item: SearchHistoryItem }) => (
      <HistoryItem
        item={item}
        onPress={(it) => {
          setSearchQuery(it.query);
          setIsSearchFocused(true);
          saveHistory(it.query).catch(() => undefined);
        }}
        onDelete={(id) => {
          deleteHistoryItem(id).catch(() => undefined);
        }}
      />
    ),
    [deleteHistoryItem, saveHistory]
  );

  const showRecent = isSearchFocused && searchQuery.trim().length === 0;
  const showResults = searchQuery.trim().length >= 2;
  const showNoResults = showResults && !isLoading && artists.length === 0;

  return (
    <LinearGradient
      colors={Colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        {/* Search Header */}
        <View>
          <BlurView intensity={20} tint="dark" style={styles.searchBar}>
            <View style={styles.searchPill}>
              <SearchIcon color="rgba(255,255,255,0.7)" size={18} />
              <TextInput
                ref={(r) => {
                  inputRef.current = r;
                }}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search artists"
                placeholderTextColor={Colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                autoFocus={false}
                returnKeyType="search"
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
              />
              {searchQuery.length > 0 ? (
                <Pressable style={styles.clearBtn} onPress={onClearSearch}>
                  <X color="#fff" size={16} />
                </Pressable>
              ) : null}
            </View>
          </BlurView>

          {/* Section Title */}
          {showRecent ? (
            <Text style={styles.sectionTitle}>
              {isLoadingHistory ? 'Recent Searches…' : 'Recent Searches'}
            </Text>
          ) : showResults ? (
            <Text style={styles.sectionTitle}>
              {isLoading ? 'Searching…' : `${artists.length} Artist${artists.length !== 1 ? 's' : ''}`}
            </Text>
          ) : null}
        </View>

        {/* Results List */}
        {showRecent ? (
          <FlatList
            data={recentSearches}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: tabBarHeight + (hasActiveAudio ? 96 : 44),
            }}
            renderItem={renderHistoryItem}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptySub}>No recent searches</Text>
              </View>
            }
          />
        ) : (
          <FlatList
            data={artists}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: tabBarHeight + (hasActiveAudio ? 96 : 44),
            }}
            renderItem={renderArtistItem}
            ListEmptyComponent={
              showNoResults ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyTitle}>No artist found</Text>
                  <Text style={styles.emptySub}>Try a different spelling or search term.</Text>
                </View>
              ) : searchQuery.trim().length === 1 ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptySub}>Type at least 2 characters to search</Text>
                </View>
              ) : (
                <View style={styles.emptySpacer} />
              )
            }
          />
        )}

        {/* Loading Overlay */}
        {isLoading && !showRecent && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  list: {
    backgroundColor: 'transparent',
    flex: 1,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  searchInput: {
    flex: 1,
    color: Colors.textPrimary,
    paddingHorizontal: 12,
    fontSize: 14,
    height: 44,
  },
  clearBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  artistThumbWrap: {
    width: 56,
    height: 56,
    marginRight: 14,
  },
  artistThumb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  artistThumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artistInfo: {
    flex: 1,
  },
  artistName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  artistGenre: {
    color: Colors.textMuted,
    marginTop: 4,
    fontSize: 13,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  historyText: {
    color: Colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  historyDeleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    marginLeft: 10,
  },
  emptyWrap: {
    paddingTop: 56,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySub: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  emptySpacer: {
    height: 180,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
});
