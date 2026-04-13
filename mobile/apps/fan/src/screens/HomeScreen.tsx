import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Linking,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BadgeCheck, Play, Search } from 'lucide-react-native';
import { apiV1 } from '../services/api';
import { fetchVerifiedArtists, fetchFeaturedArtists, type ArtistListItem } from '../services/artistService';
import { API_HOST_BASE_URL, ARTIST_WEB_URL } from '../config/env';
import { useAuth } from '../store/authStore';
import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import { getOptimizedImageUrl } from '../utils/cloudinary';
import type { MediaItem } from '../media.types';

const { width } = Dimensions.get('window');

type FeaturedArtistCard = {
  id: string;
  name: string;
  avatar: string;
};

type ArtistCard = {
  id: string;
  name: string;
  subText: string;
  image: string;
  isVerified?: boolean;
  isSubscriptionBased?: boolean;
};

const FALLBACK_THUMBNAIL =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

type ContentCard = {
  id: string;
  contentId?: string;
  title: string;
  artist: string;
  artistId?: string;
  description: string;
  thumbnail: string;
  isLocked: boolean;
  createdAt?: string | null;
  mediaType?: 'audio' | 'video' | 'audio_video';
  mediaUrl?: string | null;
  useStreamAccess?: boolean;
};

type ApiContentItem = {
  id: string | number;
  title?: string;
  type?: string;
  artwork?: string | null;
  thumbnailUrl?: string | null;
  thumbnail_storage_key?: string | null;
  locked?: boolean;
  isLocked?: boolean;
  artistName?: string | null;
  artistId?: string | number | null;
  createdAt?: string | null;
  mediaType?: string | null;
  mediaUrl?: string | null;
  fileUrl?: string | null;
  useStreamAccess?: boolean;
  isVerified?: boolean;
  verified?: boolean;
  artist?: {
    id?: string | number | null;
    name?: string | null;
    isVerified?: boolean;
    verified?: boolean;
  } | null;
};

export default function HomeScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const { currentItem, state: playerState, togglePlayPause, playQueue } = useMediaPlayer();
  const { user } = useAuth();
  const activeAudioMeta = currentItem?.mediaType === 'audio' ? currentItem : null;
  const hasActiveAudio = !!activeAudioMeta;

  const [loading, setLoading] = useState(true);
  const [artistsError, setArtistsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const dataLoadedRef = useRef(false);
  const [featuredArtists, setFeaturedArtists] = useState<FeaturedArtistCard[]>([]);
  const [trendingArtists, setTrendingArtists] = useState<ArtistCard[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<ContentCard[]>([]);

  // Derived filtered arrays — two separate rows, always BOTH rendered
  const recentAudios = recentlyAdded.filter(
    (x) => x.mediaType === 'audio' || x.mediaType === 'audio_video'
  );
  const recentVideos = recentlyAdded.filter(
    (x) => x.mediaType === 'video' || x.mediaType === 'audio_video'
  );

  // Build navigation params for FullPlayerScreen
  const buildFullPlayerParams = useCallback(
    (item: ContentCard) => {
      const queue: MediaItem[] = recentAudios.map((x) => ({
        id: x.id,
        contentId: x.contentId ?? x.id,
        title: x.title,
        artistName: x.artist,
        artistId: x.artistId,
        mediaType: 'audio' as const,
        artworkUrl: x.thumbnail,
        mediaUrl: x.mediaUrl ?? null,
        useStreamAccess: Boolean(x.useStreamAccess),
        isLocked: false,
      }));
      const idx = Math.max(0, queue.findIndex((q) => q.id === item.id));
      return {
        songId: item.id,
        title: item.title,
        artist: item.artist,
        imageUrl: item.thumbnail,
        audioUrl: item.mediaUrl || '',
        queueIndex: idx,
        queue,
      };
    },
    [recentAudios]
  );


  const toArtistCard = useCallback((a: ArtistListItem): ArtistCard => {
    const isSubscriptionBased = Number(a.subscriptionPrice ?? 0) > 0;
    return {
      id: a.id,
      name: a.name,
      image: a.image,
      isVerified: Boolean(a.isVerified),
      isSubscriptionBased,
      subText: '',
    };
  }, []);

  const fetchContent = useCallback(async (opts?: { isRefresh?: boolean }) => {
    const isRefresh = Boolean(opts?.isRefresh);

    // Skip if data already loaded and not refreshing
    if (dataLoadedRef.current && !isRefresh) {
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) setRefreshing(true);
      if (!dataLoadedRef.current) setLoading(true);
      setArtistsError(null);

      const [featuredResult, artistsResult, contentRes] = await Promise.allSettled([
        fetchFeaturedArtists().catch(() => []),
        fetchVerifiedArtists().catch(() => []),
        apiV1.get('/content').catch(() => null),
      ]);

      const featuredData = featuredResult.status === 'fulfilled' ? featuredResult.value : [];
      const artists = artistsResult.status === 'fulfilled' ? artistsResult.value : [];
      const trending = artists.slice(0, 12).map(toArtistCard);

      let recentFromApi: ContentCard[] = [];
      if (contentRes.status === 'fulfilled' && contentRes.value?.data) {
        const apiItems: ApiContentItem[] = Array.isArray(contentRes.value.data?.items)
          ? contentRes.value.data.items
          : [];
        const baseUrl = API_HOST_BASE_URL;

        recentFromApi = apiItems
          .map((it) => {
            const rawMt = (it.mediaType || it.type || '').toString().toLowerCase();
            const hasVideoUrl = Boolean((it as any).videoUrl);
            let mediaType: ContentCard['mediaType'];
            if (
              rawMt === 'audio_video' ||
              rawMt === 'audiovideo' ||
              rawMt === 'audio+video'
            ) {
              mediaType = 'audio_video';
            } else if (rawMt.includes('video') || hasVideoUrl) {
              mediaType = 'video';
            } else {
              mediaType = 'audio';
            }
            const thumb = (it.thumbnailUrl || it.artwork || '').toString();
            const thumbFallbackFromStorageKey = it.thumbnail_storage_key
              ? `${baseUrl}/api/v1/fan/stream/thumbnail/${encodeURIComponent(String(it.id))}`
              : '';
            const artistId = (it.artistId ?? it.artist?.id ?? '') as any;
            return {
              id: String(it.id),
              contentId: String(it.id),
              title: it.title ?? 'Untitled',
              artist: String(it.artistName ?? it.artist?.name ?? 'Artist'),
              artistId: artistId ? String(artistId) : undefined,
              description: (it.type || '').toString(),
              thumbnail: thumb || thumbFallbackFromStorageKey || FALLBACK_THUMBNAIL,
              isLocked: false,
              createdAt: (it.createdAt ?? null) as any,
              mediaType,
              mediaUrl: (it.mediaUrl ?? it.fileUrl ?? null) as any,
              useStreamAccess: Boolean(it.useStreamAccess),
              viewCount: (it.viewCount ?? it.views ?? 0) as any,
              likeCount: (it.likeCount ?? 0) as any,
              dislikeCount: (it.dislikeCount ?? 0) as any,
              userReaction: (it.userReaction ?? null) as any,
            };
          })
          .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          });
      }

      if (!mountedRef.current) return;
      setFeaturedArtists(featuredData);
      setTrendingArtists(trending);
      setRecentlyAdded(recentFromApi);
      dataLoadedRef.current = true;

      if (featuredResult.status === 'rejected' && artistsResult.status === 'rejected') {
        setArtistsError('Could not load artists. Please try again.');
      }
    } catch {
      if (!mountedRef.current) return;
      setArtistsError('Could not load artists. Please try again.');
    } finally {
      if (!mountedRef.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [toArtistCard]);

  // Initial load on mount only - data persists when returning to home
  useEffect(() => {
    mountedRef.current = true;
    fetchContent();
    return () => { mountedRef.current = false; };
  }, [fetchContent]);

  const onPressArtist = (artistId: string) => {
    navigation.navigate('Artist', { artistId });
  };

  // Tapping an item in the AUDIO row — always play as audio
  const onPressAudioItem = async (item: ContentCard) => {
    const params = buildFullPlayerParams(item);
    navigation.navigate('FullPlayer', params);
  };

  // Tapping an item in the VIDEO row — always open in VideoTab
  const onPressVideoItem = (item: ContentCard) => {
    navigation.getParent()?.navigate('VideoTab', {
      screen: 'VideoIndex',
      params: {
        autoplayVideo: {
          id: item.contentId ?? item.id,
          title: item.title,
          artistName: item.artist,
          artistId: item.artistId,
          artworkUrl: item.thumbnail,
          mediaUrl: item.mediaUrl || '',
          useStreamAccess: Boolean(item.useStreamAccess),
          category: 'Recently Added',
        },
      },
    });
  };

  const onPressSeeAllTrending = () => {
    navigation.navigate('SeeAllTrending', {
      artists: trendingArtists,
    });
  };

  const onPressBecomeArtist = () => {
    if (user?.role === 'ARTIST') {
      Linking.openURL(ARTIST_WEB_URL + '/artist/dashboard').catch((err) =>
        console.error('An error occurred', err)
      );
    } else {
      navigation.navigate('ArtistOnboarding');
    }
  };

  const renderFeaturedArtist = ({ item }: { item: FeaturedArtistCard }) => (
    <View style={styles.featuredCard}>
      <Image source={{ uri: getOptimizedImageUrl(item.avatar) }} style={styles.featuredImg} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.85)']}
        style={styles.featuredOverlay}
      />
      <View style={styles.featuredTextWrap}>
        <Text style={styles.featuredArtistName} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    </View>
  );

  const renderTrendingArtist = ({ item }: { item: ArtistCard }) => (
    <Pressable style={styles.trendingCard} onPress={() => onPressArtist(item.id)}>
      <Image source={{ uri: getOptimizedImageUrl(item.image) }} style={styles.trendingImg} resizeMode="contain" />
      <View style={styles.trendingNameRow}>
        <Text style={styles.trendingName} numberOfLines={1}>
          {item.name}
        </Text>
      </View>

    </Pressable>
  );

  // Square thumbnail for audio — tapping plays as audio
  const renderRecentAudio = ({ item }: { item: ContentCard }) => (
    <Pressable style={styles.audioCard} onPress={() => onPressAudioItem(item)}>
      <Image source={{ uri: getOptimizedImageUrl(item.thumbnail || FALLBACK_THUMBNAIL) }} style={styles.audioImg} />
      <View style={styles.audioBadge}>
        <View style={styles.audioDot} />
      </View>
      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
    </Pressable>
  );

  // 16:9 landscape thumbnail for video — tapping opens VideoTab
  const renderRecentVideo = ({ item }: { item: ContentCard }) => (
    <Pressable style={styles.videoCard} onPress={() => onPressVideoItem(item)}>
      <Image source={{ uri: getOptimizedImageUrl(item.thumbnail || FALLBACK_THUMBNAIL) }} style={styles.videoImg} />
      <View style={styles.videoPlayOverlay}>
        <Play color="#fff" size={22} fill="rgba(255,255,255,0.85)" />
      </View>
      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardArtist} numberOfLines={1}>{item.artist}</Text>
      </View>
    </Pressable>
  );

  if (loading)
    return (
      <LinearGradient
        colors={['#000000', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBackground}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.loading}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </LinearGradient>
    );

  return (
    <LinearGradient
      colors={['#000000', '#000000']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBackground}
    >
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.pageWrap}>
          {/* STATIC HEADER - outside ScrollView */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image 
                source={require('../../assets/logo.png')} 
                style={styles.headerLogo}
                resizeMode="cover"
              />
              <Text style={styles.headerTitle}>Discover</Text>
            </View>

            <Pressable onPress={() => navigation.getParent()?.navigate('SearchTab')}>
              <Search color="#fff" size={22} />
            </Pressable>
          </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + (hasActiveAudio ? 180 : 120) }}
        refreshControl={
          <RefreshControl
            tintColor={Colors.accent}
            refreshing={refreshing}
            onRefresh={() => { fetchContent({ isRefresh: true }); }}
          />
        }
      >

        {/* BECOME AN ARTIST BANNER */}
        <Pressable onPress={onPressBecomeArtist} style={styles.artistBannerContainer}>
          <LinearGradient
            colors={['rgba(255,106,0,0.15)', 'rgba(255,106,0,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.artistBannerGradient}
          >
            <View style={styles.artistBannerContent}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.artistBannerTitle}>
                  {user?.role === 'ARTIST' ? 'Artist Dashboard' : 'Become an Artist'}
                </Text>
                <Text style={styles.artistBannerSub}>
                  {user?.role === 'ARTIST' ? 'Manage your music & analytics' : 'Upload your music & grow your audience'}
                </Text>
              </View>
              <View style={styles.artistBannerBtn}>
                <Text style={styles.artistBannerBtnText}>
                  {user?.role === 'ARTIST' ? 'Open' : 'Get Started'}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {/* FEATURED ARTISTS */}
        <Text style={styles.sectionTitleTop}>Featured Artists</Text>
        {loading ? (
          <View style={styles.sectionLoadingRow}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : artistsError ? (
          <View style={styles.sectionErrorWrap}>
            <Text style={styles.sectionErrorText}>{artistsError}</Text>
            <Pressable
              onPress={() => { fetchContent(); }}
              style={styles.retryBtn}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : featuredArtists.length ? (
          <FlatList
            data={featuredArtists}
            horizontal
            initialNumToRender={5}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={renderFeaturedArtist}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{ paddingLeft: 18, paddingRight: 8 }}
          />
        ) : (
          <View style={styles.sectionEmptyWrap}>
            <Text style={styles.sectionEmptyText}>No featured artists yet.</Text>
          </View>
        )}

        {/* TRENDING ARTISTS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Trending Artists</Text>
          <TouchableOpacity onPress={onPressSeeAllTrending} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See All  &gt;</Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={styles.sectionLoadingRow}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : artistsError ? (
          <View style={styles.sectionEmptyWrap}>
            <Text style={styles.sectionEmptyText}>Trending artists unavailable.</Text>
          </View>
        ) : trendingArtists.length ? (
          <FlatList
            data={trendingArtists}
            horizontal
            initialNumToRender={5}
            windowSize={5}
            removeClippedSubviews={true}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 18, paddingRight: 8 }}
            renderItem={renderTrendingArtist}
            keyExtractor={(item) => item.id}
            nestedScrollEnabled
          />
        ) : (
          <View style={styles.sectionEmptyWrap}>
            <Text style={styles.sectionEmptyText}>No trending artists yet.</Text>
          </View>
        )}

        {/* RECENTLY ADDED AUDIO */}
        <Text style={styles.sectionTitleTop}>Recently Added Audio</Text>
        {recentAudios.length > 0 ? (
          <FlatList
            data={recentAudios}
            horizontal
            initialNumToRender={5}
            windowSize={5}
            removeClippedSubviews={true}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{ paddingLeft: 18, paddingRight: 8 }}
            renderItem={renderRecentAudio}
            keyExtractor={(item) => `audio-${item.id}`}
          />
        ) : (
          <View style={styles.sectionEmptyWrap}>
            <Text style={styles.sectionEmptyText}>No audio content yet.</Text>
          </View>
        )}

        {/* RECENTLY ADDED VIDEOS */}
        <Text style={[styles.sectionTitleTop, { marginBottom: 14 }]}>Recently Added Videos</Text>
        {recentVideos.length > 0 ? (
          <FlatList
            data={recentVideos}
            horizontal
            initialNumToRender={5}
            windowSize={5}
            removeClippedSubviews={true}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{ paddingLeft: 18, paddingRight: 8, paddingBottom: 50 }}
            renderItem={renderRecentVideo}
            keyExtractor={(item) => `video-${item.id}`}
          />
        ) : (
          <View style={styles.sectionEmptyWrap}>
            <Text style={styles.sectionEmptyText}>No video content yet.</Text>
          </View>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ================================= */
/* STYLES */
/* ================================= */

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pageWrap: {
    flex: 1,
    minHeight: '100%',
  },


  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },

  headerTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  sectionTitleTop: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 18,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 22,
    marginBottom: 10,
  },

  seeAll: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },

  artistBannerContainer: {
    marginHorizontal: 18,
    marginTop: 10,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.15)',
  },
  artistBannerGradient: {
    padding: 16,
  },
  artistBannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  artistBannerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  artistBannerSub: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
  },
  artistBannerBtn: {
    backgroundColor: 'rgba(255,106,0,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.4)',
  },
  artistBannerBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },

  featuredCard: {
    width: width * 0.62,
    height: 178,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  featuredImg: { width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.15)' },

  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  featuredTextWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 12,
  },

  featuredNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  featuredArtistName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

  verifiedWrap: {
    marginLeft: 8,
    marginTop: 2,
  },

  subscriptionTag: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,181,8,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,8,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  subscriptionTagText: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '800',
  },

  featuredSubText: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },

  sectionTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontWeight: '700',
  },

  trendingCard: {
    width: 96,
    marginRight: 12,
  },
  trendingImg: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  trendingNameRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendingName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  trendingVerified: {
    marginLeft: 6,
    marginTop: 1,
  },
  trendingSubText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },

  sectionLoadingRow: {
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'flex-start',
  },

  sectionErrorWrap: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'flex-start',
  },

  sectionErrorText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },

  retryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,181,8,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,181,8,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },

  retryBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },

  sectionEmptyWrap: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  sectionEmptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Audio card (square album art) ──
  audioCard: {
    width: width * 0.38,
    marginRight: 14,
    marginBottom: 20,
  },
  audioImg: {
    width: width * 0.38,
    height: width * 0.38,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  audioBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  audioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#fff',
    opacity: 0.9,
  },

  // ── Video card (16:9 landscape) ──
  videoCard: {
    width: width * 0.58,
    marginRight: 14,
    marginBottom: 20,
  },
  videoImg: {
    width: width * 0.58,
    height: Math.round((width * 0.58) * (9 / 16)),
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.58,
    height: Math.round((width * 0.58) * (9 / 16)),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderRadius: 12,
  },

  // ── Shared card text ──
  cardTextWrap: {
    marginTop: 7,
    paddingHorizontal: 2,
  },
  cardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  cardArtist: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});
