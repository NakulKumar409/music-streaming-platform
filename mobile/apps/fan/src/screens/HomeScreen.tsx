import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  Modal,
  Platform,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BadgeCheck, Lock, Play, Search, X, Bell, Settings, ChevronRight, Disc3 } from 'lucide-react-native';
import ThemeSwitcher from '../ui/ThemeSwitcher';
import { LockedContentOverlay } from '../ui/SubscriptionUI';
import { apiV1 } from '../services/api';
import { fetchVerifiedArtists, fetchFeaturedArtists, type ArtistListItem } from '../services/artistService';
import { API_HOST_BASE_URL, ARTIST_WEB_URL } from '../config/env';
import { useAuth } from '../store/authStore';
import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import { getOptimizedImageUrl } from '../utils/cloudinary';
import AppImage from '../components/AppImage';
import { resolveAppImageUrl, FALLBACK_ARTWORK, FALLBACK_ARTIST_AVATAR, FALLBACK_BANNER } from '../utils/imageUtils';
import type { MediaItem } from '../media.types';
import { useToast } from '../ui/ToastProvider';
import { findMediaQueueIndex } from '../utils/mediaQueue';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Consistent horizontal padding used throughout the page
const H_PAD = 20;

// Artist circle: fixed consistent size for ALL trending artists
const ARTIST_CIRCLE = 84;

// Audio card: ~2.3 visible cards on screen at once
const AUDIO_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.42);

// Video card: 16:9 landscape
const VIDEO_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.56);
const VIDEO_CARD_HEIGHT = Math.round(VIDEO_CARD_WIDTH * (9 / 16));

// Featured artist card
const FEATURED_CARD_WIDTH = Math.round(SCREEN_WIDTH * 0.62);
const FEATURED_CARD_HEIGHT = 176;

// Keep `width` alias for any legacy use
const width = SCREEN_WIDTH;

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
  durationMs?: number;
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
  viewCount?: number;
  views?: number;
  likeCount?: number;
  dislikeCount?: number;
  userReaction?: 'LIKE' | 'DISLIKE' | null;
  durationMs?: number | null;
  artist?: {
    id?: string | number | null;
    name?: string | null;
    isVerified?: boolean;
    verified?: boolean;
  } | null;
};

/* ─────────────────────── Helpers ─────────────────────── */

function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/* ─────────────────────── Section Header Row ─────────────────────── */
function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={shStyles.row}>
      <Text style={shStyles.title}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity
          onPress={onSeeAll}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={shStyles.seeAllBtn}
        >
          <Text style={shStyles.seeAllText}>See All</Text>
          <ChevronRight color="rgba(255,255,255,0.4)" size={14} />
        </TouchableOpacity>
      )}
    </View>
  );
}
const shStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    marginTop: 28,
    marginBottom: 14,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
});

/* ─────────────────────── Section State Wrappers ─────────────────── */
function SectionLoading() {
  return (
    <View style={ssStyles.loadingRow}>
      <ActivityIndicator color={Colors.accent} size="small" />
    </View>
  );
}
function SectionError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={ssStyles.errorWrap}>
      <Text style={ssStyles.errorText}>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} style={ssStyles.retryBtn} activeOpacity={0.75}>
          <Text style={ssStyles.retryText}>Try again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
function SectionEmpty({ message }: { message: string }) {
  return (
    <View style={ssStyles.emptyWrap}>
      <Text style={ssStyles.emptyText}>{message}</Text>
    </View>
  );
}
const ssStyles = StyleSheet.create({
  loadingRow: { paddingHorizontal: H_PAD, paddingVertical: 20, alignItems: 'flex-start' },
  errorWrap: { paddingHorizontal: H_PAD, paddingVertical: 14 },
  errorText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '500', marginBottom: 12 },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,182,8,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,182,8,0.35)',
  },
  retryText: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
  emptyWrap: { paddingHorizontal: H_PAD, paddingVertical: 14 },
  emptyText: { color: 'rgba(255,255,255,0.38)', fontSize: 13, fontWeight: '500' },
});

/* ═══════════════════════ HOME SCREEN ═══════════════════════ */

export default function HomeScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const { currentItem, togglePlayPause, playQueue } = useMediaPlayer();
  const { user } = useAuth();
  const { showToast } = useToast();
  const activeAudioMeta = currentItem?.mediaType === 'audio' ? currentItem : null;
  const hasActiveAudio = !!activeAudioMeta;

  const [loading, setLoading] = useState(true);
  const [artistsError, setArtistsError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showArtistLockModal, setShowArtistLockModal] = useState<{ visible: boolean; item: ContentCard | null }>({
    visible: false,
    item: null,
  });
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
        isLocked: x.isLocked,
        duration: x.durationMs,
      }));
      const idx = findMediaQueueIndex(queue, item);
      if (idx < 0) return null;

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
      image: resolveAppImageUrl(a.image, 'artist'),
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
            const artistId = (it.artistId ?? it.artist?.id ?? (it as any).artist_id ?? '') as any;
            return {
              id: String(it.id),
              contentId: String(it.id),
              title: it.title ?? 'Untitled',
              artist: String(it.artistName ?? it.artist?.name ?? 'Artist'),
              artistId: artistId ? String(artistId) : undefined,
              description: (it.type || '').toString(),
              thumbnail: resolveAppImageUrl(thumb || thumbFallbackFromStorageKey, 'song'),
              isLocked: Boolean(it.isLocked || it.locked),
              createdAt: (it.createdAt ?? null) as any,
              mediaType,
              mediaUrl: (it.mediaUrl ?? it.fileUrl ?? null) as any,
              useStreamAccess: Boolean(it.useStreamAccess),
              viewCount: (it.viewCount ?? it.views ?? 0) as any,
              likeCount: (it.likeCount ?? 0) as any,
              dislikeCount: (it.dislikeCount ?? 0) as any,
              userReaction: (it.userReaction ?? null) as any,
              durationMs:
                Number.isFinite(Number(it.durationMs)) && Number(it.durationMs) > 0
                  ? Math.round(Number(it.durationMs))
                  : undefined,
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

  const onPressArtist = useCallback((artistId: string) => {
    navigation.navigate('Artist', { artistId });
  }, [navigation]);

  // Tapping an item in the AUDIO row — always play as audio
  const onPressAudioItem = useCallback(async (item: ContentCard) => {
    if (item.isLocked) {
      showToast({
        tone: 'warning',
        title: 'Subscription required',
        message: `Subscribe to ${item.artist || 'this artist'} to play "${item.title}".`,
        actionLabel: 'View plan',
        onAction: () => {
          navigation.navigate('SubscriptionFlow', {
            artistId: item.artistId,
            artistName: item.artist,
            contentId: item.contentId ?? item.id,
            defaultPlan: 'ARTIST',
          });
        },
      });
      return;
    }

    const params = buildFullPlayerParams(item);
    if (!params) {
      showToast({
        tone: 'error',
        title: "Couldn't open this song",
        message: 'The song list changed. Please refresh and try again.',
      });
      return;
    }

    navigation.navigate('FullPlayer', params);
  }, [buildFullPlayerParams, navigation, showToast]);

  // Tapping an item in the VIDEO row — always open in VideoTab
  const onPressVideoItem = useCallback((item: ContentCard) => {
    if (item.isLocked) {
      showToast({
        tone: 'warning',
        title: 'Subscription required',
        message: `Subscribe to ${item.artist || 'this artist'} to watch "${item.title}".`,
      });
      setShowArtistLockModal({ visible: true, item });
      return;
    }

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
  }, [navigation, showToast]);

  const onPressSeeAllTrending = useCallback(() => {
    navigation.navigate('SeeAllTrending', {
      artists: trendingArtists,
    });
  }, [navigation, trendingArtists]);

  const onPressBecomeArtist = async () => {
    if (user?.role === 'ARTIST') {
      const dashboardUrl = ARTIST_WEB_URL + '/artist/dashboard';
      try {
        const canOpen = await Linking.canOpenURL(dashboardUrl);
        if (!canOpen) {
          Alert.alert(
            'Cannot Open Dashboard',
            'Unable to open the artist dashboard. Please try again later or contact support.',
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }
        await Linking.openURL(dashboardUrl);
      } catch (err) {
        console.error('[HomeScreen] Failed to open artist dashboard:', err);
        Alert.alert(
          'Error Opening Dashboard',
          'Something went wrong while trying to open the artist dashboard. Please try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } else {
      navigation.navigate('ArtistOnboarding');
    }
  };

  /* ── Render: Featured Artist card ── */
  const renderFeaturedArtist = useCallback(({ item }: { item: FeaturedArtistCard }) => (
    <Pressable
      style={styles.featuredCard}
      onPress={() => {
        console.log('[HomeScreen] Featured artist clicked:', { name: item.name, id: item.id });
        onPressArtist(item.id);
      }}
    >
      <AppImage
        uri={item.avatar}
        fallbackType="artist"
        style={styles.featuredImg}
        resizeMode="cover"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.88)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.featuredTextWrap}>
        <Text style={styles.featuredArtistName} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    </Pressable>
  ), [onPressArtist]);

  /* ── Render: Trending Artist — perfect circle ── */
  const renderTrendingArtist = useCallback(({ item }: { item: ArtistCard }) => (
    <Pressable style={styles.trendingCard} onPress={() => onPressArtist(item.id)}>
      {/* Outer ring border */}
      <View style={styles.trendingCircleOuter}>
        {/* Inner clip: enforces perfect circle crop */}
        <View style={styles.trendingCircleInner}>
          <AppImage
            uri={item.image}
            fallbackType="artist"
            style={styles.trendingImg}
            resizeMode="cover"
          />
        </View>
      </View>
      <View style={styles.trendingNameWrap}>
        <Text style={styles.trendingName} numberOfLines={1} ellipsizeMode="tail">
          {item.name}
        </Text>
        {item.isVerified && (
          <BadgeCheck size={11} color={Colors.accent} />
        )}
      </View>
    </Pressable>
  ), [onPressArtist]);

  /* ── Render: Recently Added Audio — premium card ── */
  const renderRecentAudio = useCallback(({ item }: { item: ContentCard }) => {
    const duration = formatDuration(item.durationMs);
    return (
      <Pressable
        style={styles.audioCard}
        onPress={() => onPressAudioItem(item)}
        android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: false }}
      >
        {/* Album art container — square, clipped */}
        <View style={styles.audioImgContainer}>
          <AppImage
            uri={item.thumbnail}
            fallbackType="song"
            style={styles.audioImg}
            resizeMode="cover"
          />
          {/* Bottom fade for depth */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.42)']}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* Lock badge (top-left) */}
          {item.isLocked && (
            <View style={styles.audioBadgeLock}>
              <Lock color="#fff" size={11} />
            </View>
          )}
          {/* Duration badge (bottom-right) */}
          {!!duration && (
            <View style={styles.audioDurationBadge}>
              <Text style={styles.audioDurationText}>{duration}</Text>
            </View>
          )}
          {/* Centered play button */}
          <View style={styles.audioPlayOverlay} pointerEvents="none">
            <View style={styles.audioPlayBtn}>
              <Play color="#fff" size={14} fill="#fff" />
            </View>
          </View>
        </View>
        {/* Text below art */}
        <View style={styles.audioCardText}>
          <Text style={styles.audioCardTitle} numberOfLines={1} ellipsizeMode="tail">
            {item.title}
          </Text>
          <Text style={styles.audioCardArtist} numberOfLines={1} ellipsizeMode="tail">
            {item.artist}
          </Text>
        </View>
      </Pressable>
    );
  }, [onPressAudioItem]);

  /* ── Render: Recently Added Video card ── */
  const renderRecentVideo = useCallback(({ item }: { item: ContentCard }) => (
    <Pressable style={styles.videoCard} onPress={() => onPressVideoItem(item)}>
      <View style={styles.videoImgContainer}>
        <AppImage
          uri={item.thumbnail}
          fallbackType="video"
          style={styles.videoImg}
          resizeMode="cover"
        />
        {item.isLocked && (
          <View style={styles.videoBadgeLock}>
            <Lock color="#fff" size={11} />
          </View>
        )}
        <View style={styles.videoPlayOverlay}>
          <View style={styles.videoPlayBtn}>
            <Play color="#fff" size={18} fill="#fff" />
          </View>
        </View>
      </View>
      <View style={styles.videoCardText}>
        <Text style={styles.videoCardTitle} numberOfLines={1} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.videoCardArtist} numberOfLines={1} ellipsizeMode="tail">
          {item.artist}
        </Text>
      </View>
    </Pressable>
  ), [onPressVideoItem]);


  /* ── Full-page loading state ── */
  if (loading) {
    return (
      <LinearGradient
        colors={Platform.OS === 'web' ? ['var(--color-bg)', 'var(--color-bg)'] : ['#000000', '#000000']}
        style={styles.gradientBackground}
      >
        <StatusBar barStyle="light-content" />
        <View style={styles.fullLoading}>
          <ActivityIndicator color={Colors.accent} size="large" />
          <Text style={styles.fullLoadingText}>Loading your music…</Text>
        </View>
      </LinearGradient>
    );
  }

  /* ── Main render ── */
  return (
    <LinearGradient
      colors={Platform.OS === 'web' ? ['var(--color-bg)', 'var(--color-bg)'] : ['#000000', '#000000']}
      style={styles.gradientBackground}
    >
      <StatusBar barStyle="light-content" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.pageWrap}>

          {/* ══ STATIC HEADER ══ */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.headerLogo}
                resizeMode="cover"
              />
              <View>
                <Text style={styles.headerTitle}>Discover</Text>
                <Text style={styles.headerSubtitle}>Music you'll love</Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => navigation.getParent()?.navigate('SearchTab')}
                activeOpacity={0.7}
                accessibilityLabel="Search"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Search color="#fff" size={18} />
              </TouchableOpacity>

              {Platform.OS === 'web' && (
                <>
                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={() => { /* Notifications placeholder */ }}
                    activeOpacity={0.7}
                    accessibilityLabel="Notifications"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Bell color="#fff" size={18} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.headerIconButton}
                    onPress={() => navigation.getParent()?.navigate('AccountTab')}
                    activeOpacity={0.7}
                    accessibilityLabel="Settings"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Settings color="#fff" size={18} />
                  </TouchableOpacity>

                  <ThemeSwitcher />
                </>
              )}
            </View>
          </View>

          {/* ══ SCROLLABLE CONTENT ══ */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={Platform.OS !== 'web'}
            contentContainerStyle={{
              paddingBottom: tabBarHeight + (hasActiveAudio ? 180 : 120),
            }}
            refreshControl={
              <RefreshControl
                tintColor={Colors.accent}
                colors={[Colors.accent]}
                refreshing={refreshing}
                onRefresh={() => { fetchContent({ isRefresh: true }); }}
              />
            }
          >

            {/* ── BECOME AN ARTIST BANNER ── */}
            <Pressable onPress={onPressBecomeArtist} style={styles.artistBannerContainer}>
              <LinearGradient
                colors={['rgba(255,106,0,0.14)', 'rgba(255,106,0,0.03)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.artistBannerGradient}
              >
                <View style={styles.artistBannerContent}>
                  <View style={styles.artistBannerIconWrap}>
                    <Disc3 color={Colors.accent} size={22} />
                  </View>
                  <View style={styles.artistBannerTextBlock}>
                    <Text style={styles.artistBannerTitle}>
                      {user?.role === 'ARTIST' ? 'Artist Dashboard' : 'Become an Artist'}
                    </Text>
                    <Text style={styles.artistBannerSub} numberOfLines={1}>
                      {user?.role === 'ARTIST'
                        ? 'Manage your music & analytics'
                        : 'Upload your music & grow your audience'}
                    </Text>
                  </View>
                  <View style={styles.artistBannerBtn}>
                    <Text style={styles.artistBannerBtnText}>
                      {user?.role === 'ARTIST' ? 'Open' : 'Start'}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* ══ FEATURED ARTISTS ══ */}
            <SectionHeader title="Featured Artists" />
            {artistsError ? (
              <SectionError
                message="Couldn't load featured artists."
                onRetry={() => fetchContent()}
              />
            ) : featuredArtists.length > 0 ? (
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
                contentContainerStyle={styles.hListPad}
              />
            ) : (
              <SectionEmpty message="No featured artists yet." />
            )}

            {/* ══ TRENDING ARTISTS ══ */}
            <SectionHeader title="Trending Artists" onSeeAll={onPressSeeAllTrending} />
            {artistsError ? (
              <SectionError
                message="Couldn't load trending artists."
                onRetry={() => fetchContent()}
              />
            ) : trendingArtists.length > 0 ? (
              <FlatList
                data={trendingArtists}
                horizontal
                initialNumToRender={6}
                windowSize={5}
                removeClippedSubviews={true}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hListPad}
                renderItem={renderTrendingArtist}
                keyExtractor={(item) => item.id}
                nestedScrollEnabled
              />
            ) : (
              <SectionEmpty message="No trending artists yet." />
            )}

            {/* ══ RECENTLY ADDED AUDIO ══ */}
            <SectionHeader title="Recently Added Audio" />
            {recentAudios.length > 0 ? (
              <FlatList
                data={recentAudios}
                horizontal
                initialNumToRender={5}
                windowSize={5}
                removeClippedSubviews={true}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={styles.hListPad}
                renderItem={renderRecentAudio}
                keyExtractor={(item) => `audio-${item.id}`}
              />
            ) : (
              <SectionEmpty message="No audio tracks added yet." />
            )}

            {/* ══ RECENTLY ADDED VIDEOS ══ */}
            <SectionHeader title="Recently Added Videos" />
            {recentVideos.length > 0 ? (
              <FlatList
                data={recentVideos}
                horizontal
                initialNumToRender={5}
                windowSize={5}
                removeClippedSubviews={true}
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled
                contentContainerStyle={[styles.hListPad, { paddingBottom: 8 }]}
                renderItem={renderRecentVideo}
                keyExtractor={(item) => `video-${item.id}`}
              />
            ) : (
              <SectionEmpty message="No videos added yet." />
            )}

            <View style={{ height: 16 }} />
          </ScrollView>
        </View>

        {/* ══ LOCK MODAL (unchanged logic) ══ */}
        {showArtistLockModal.visible && (
          <Modal
            transparent
            visible={true}
            animationType="fade"
            onRequestClose={() => setShowArtistLockModal({ visible: false, item: null })}
          >
            <LockedContentOverlay
              artistName={showArtistLockModal.item?.artist}
              onSubscribe={() => {
                setShowArtistLockModal({ visible: false, item: null });
                navigation.navigate('SubscriptionFlow', {
                  artistId: showArtistLockModal.item?.artistId,
                  artistName: showArtistLockModal.item?.artist,
                });
              }}
            />
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setShowArtistLockModal({ visible: false, item: null })}
            >
              <X color="#fff" size={26} />
            </Pressable>
          </Modal>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ═══════════════════════ STYLES ═══════════════════════ */

const styles = StyleSheet.create({

  /* ── Layout shells ── */
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pageWrap: {
    flex: 1,
  },
  fullLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 14,
  },
  fullLoadingText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
  },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingTop: Platform.OS === 'android' ? 10 : 4,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  headerLogo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    flexShrink: 0,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.38)',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  /* ── Artist become banner ── */
  artistBannerContainer: {
    marginHorizontal: H_PAD,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.18)',
  },
  artistBannerGradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  artistBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artistBannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,106,0,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  artistBannerTextBlock: {
    flex: 1,
    gap: 3,
  },
  artistBannerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  artistBannerSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '500',
  },
  artistBannerBtn: {
    backgroundColor: 'rgba(255,106,0,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,106,0,0.4)',
    flexShrink: 0,
  },
  artistBannerBtnText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '800',
  },

  /* ── Shared horizontal list padding ── */
  hListPad: {
    paddingLeft: H_PAD,
    paddingRight: H_PAD / 2,
  },

  /* ── Featured artist card ── */
  featuredCard: {
    width: FEATURED_CARD_WIDTH,
    height: FEATURED_CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  featuredImg: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  featuredTextWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
  },
  featuredArtistName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  /* ── Trending artist card (perfect circle) ── */
  trendingCard: {
    width: ARTIST_CIRCLE + 8,
    alignItems: 'center',
    marginRight: 16,
  },
  // Outer ring — subtle glow border
  trendingCircleOuter: {
    width: ARTIST_CIRCLE + 4,
    height: ARTIST_CIRCLE + 4,
    borderRadius: (ARTIST_CIRCLE + 4) / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Inner clip container — enforces perfect circle crop for any image ratio
  trendingCircleInner: {
    width: ARTIST_CIRCLE,
    height: ARTIST_CIRCLE,
    borderRadius: ARTIST_CIRCLE / 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  trendingImg: {
    width: ARTIST_CIRCLE,
    height: ARTIST_CIRCLE,
  },
  trendingNameWrap: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: ARTIST_CIRCLE + 8,
  },
  trendingName: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },

  /* ── Recently Added Audio card (premium) ── */
  audioCard: {
    width: AUDIO_CARD_WIDTH,
    marginRight: 14,
    marginBottom: 4,
  },
  audioImgContainer: {
    width: AUDIO_CARD_WIDTH,
    height: AUDIO_CARD_WIDTH, // 1:1 square
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  audioImg: {
    width: '100%',
    height: '100%',
  },
  audioBadgeLock: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  audioDurationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 10,
  },
  audioDurationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  audioPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioPlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioCardText: {
    marginTop: 10,
    paddingHorizontal: 2,
  },
  audioCardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.05,
    lineHeight: 17,
  },
  audioCardArtist: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 14,
  },

  /* ── Recently Added Video card ── */
  videoCard: {
    width: VIDEO_CARD_WIDTH,
    marginRight: 14,
    marginBottom: 4,
  },
  videoImgContainer: {
    width: VIDEO_CARD_WIDTH,
    height: VIDEO_CARD_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  videoImg: {
    width: '100%',
    height: '100%',
  },
  videoBadgeLock: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 10,
  },
  videoPlayOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.20)',
  },
  videoPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoCardText: {
    marginTop: 10,
    paddingHorizontal: 2,
  },
  videoCardTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.05,
    lineHeight: 17,
  },
  videoCardArtist: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 14,
  },

  /* ── Modal close button ── */
  modalCloseBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 100,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
});

