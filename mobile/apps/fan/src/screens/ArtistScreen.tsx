import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  UIManager,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ArrowLeft, BadgeCheck, Settings } from 'lucide-react-native';
import { ResizeMode, Video } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import SubscriptionExpiryScreen from './SubscriptionExpiryScreen';
import { fetchArtistById, fetchArtistMedia, type ArtistDetail, type ArtistMediaItem } from '../services/artistService';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import YouTubeVideoControlsOverlay from '../ui/YouTubeVideoControlsOverlay';
import { Colors } from '../theme';

type Song = {
  id: string;
  contentId?: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  locked: boolean;
  mediaType: 'audio' | 'video';
  mediaUrl: string;
  useStreamAccess?: boolean;
};

type Artist = {
  id: string;
  name: string;
  verified: boolean;
  subscribers: string;
  profileImage: string;
  coverImage: string;
};

type TabKey = 'All' | 'Audio' | 'Video';

const TABS: TabKey[] = ['All', 'Audio', 'Video'];

type ChannelTabKey = 'Home' | 'Videos' | 'Playlists' | 'Community';
const CHANNEL_TABS: ChannelTabKey[] = ['Home', 'Videos', 'Playlists', 'Community'];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ArtistScreen({ navigation, route }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  const {
    playQueue,
    currentItem,
    state: playerState,
    videoRef,
    onVideoPlaybackStatusUpdate,
    togglePlayPause,
    seekTo,
    setExpanded,
    setInlineVideoHostActive,
  } = useMediaPlayer();

  useEffect(() => {
    const isInlineVideo = isFocused && currentItem?.mediaType === 'video' && !playerState.isExpanded;
    setInlineVideoHostActive(isInlineVideo);
    return () => {
      setInlineVideoHostActive(false);
    };
  }, [currentItem?.mediaType, isFocused, playerState.isExpanded, setInlineVideoHostActive]);

  const [activeTab, setActiveTab] = useState<TabKey>('All');
  const [activeChannelTab, setActiveChannelTab] = useState<ChannelTabKey>('Home');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const [inlineVideoAspectRatio, setInlineVideoAspectRatio] = useState(16 / 9);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Subscription expiry state with debug toggle
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);
  const [showDebugToggle, setShowDebugToggle] = useState(__DEV__);

  const handleRenewSubscription = () => {
    navigation.navigate('SubscriptionFlow');
    setIsSubscriptionActive(true); // Reset after navigation
  };

  const artistId = (route?.params?.artistId ?? '').toString();
  const initialMediaId = (route?.params?.contentId ?? '').toString();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [artistRes, mediaRes] = await Promise.all([
          fetchArtistById(artistId),
          fetchArtistMedia(artistId),
        ]);

        if (!mounted) return;

        const a: ArtistDetail | null = artistRes;
        if (!a) {
          setArtist(null);
          setSongs([]);
          setError('Artist not found');
          return;
        }

        const normalizedArtist: Artist = {
          id: a.id,
          name: a.name,
          verified: a.isVerified,
          subscribers: deriveSubscribersLabel(a.id),
          profileImage: a.profileImageUrl,
          coverImage: a.coverImageUrl,
        };

        const toSong = (it: ArtistMediaItem): Song => ({
          id: it.id,
          contentId: it.contentId,
          title: it.title,
          artist: a.name,
          duration: it.mediaType === 'video' ? 'Video' : 'Audio',
          thumbnail: it.artworkUrl,
          locked: false,
          mediaType: it.mediaType,
          mediaUrl: it.mediaUrl,
          useStreamAccess: it.useStreamAccess,
        });

        setArtist(normalizedArtist);
        setSongs(mediaRes.map(toSong));
      } catch {
        if (!mounted) return;
        setError('Failed to load artist');
        setArtist(null);
        setSongs([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [artistId]);

  useEffect(() => {
    if (!artist) return;
    if (!initialMediaId) return;
    if (!songs.length) return;

    const match = songs.find((s) => s.id === initialMediaId || s.contentId === initialMediaId);
    if (!match) return;

    if (match.mediaType === 'audio') setActiveTab('Audio');
    if (match.mediaType === 'video') setActiveTab('Video');

    const queue = songs
      .filter((s) => Boolean(s.mediaUrl) || s.useStreamAccess)
      .map((s) => ({
        id: s.id,
        contentId: s.contentId,
        title: s.title,
        artistName: s.artist,
        artistId: artist.id,
        mediaType: s.mediaType,
        artworkUrl: s.thumbnail,
        mediaUrl: s.mediaUrl || '',
        isLocked: false,
        useStreamAccess: s.useStreamAccess,
      }));
    const idx = queue.findIndex((q) => q.id === initialMediaId || q.contentId === initialMediaId);
    if (idx < 0) return;

    playQueue(queue, idx).catch(() => undefined);
    setCurrentSong(match);
  }, [artist, initialMediaId, playQueue, songs]);

  useEffect(() => {
    const nextIsVideoPlaying = currentItem?.mediaType === 'video';
    if (nextIsVideoPlaying === isVideoPlaying) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsVideoPlaying(nextIsVideoPlaying);
  }, [currentItem?.mediaType, isVideoPlaying]);

  const isUnlocked = Boolean(route?.params?.unlocked);
  const isTemporarilyUnlocked = true;

  const filteredSongs = useMemo(() => {
    const baseSongs = isTemporarilyUnlocked ? songs.map((s) => ({ ...s, locked: false })) : songs;
    if (activeTab === 'All') return baseSongs;
    if (activeTab === 'Audio') return baseSongs.filter((s) => s.mediaType === 'audio');
    return baseSongs.filter((s) => s.mediaType === 'video');
  }, [activeTab, isTemporarilyUnlocked, songs]);

  const channelContent = useMemo(() => {
    if (activeChannelTab === 'Playlists') return [];
    if (activeChannelTab === 'Community') return [];
    return filteredSongs;
  }, [activeChannelTab, filteredSongs]);

  const useGrid = activeTab === 'Video';

  // Disable audio playback when subscription is expired
  const handleSongPress = (song: Song) => {
    if (!artist) return;
    if (!isSubscriptionActive) {
      return; // Block all playback when subscription is expired
    }
    
    const queue = filteredSongs
      .filter((s) => Boolean(s.mediaUrl) || s.useStreamAccess)
      .map((s) => ({
        id: s.id,
        title: s.title,
        artistName: s.artist,
        artistId: artist.id,
        mediaType: s.mediaType,
        artworkUrl: s.thumbnail,
        mediaUrl: s.mediaUrl || '',
        isLocked: false,
        useStreamAccess: s.useStreamAccess,
      }));
    const idx = queue.findIndex((q) => q.id === song.id);
    playQueue(queue, idx >= 0 ? idx : 0).catch(() => undefined);
    setCurrentSong(song);
  };

  useEffect(() => {
    if (!artist) return;
    Image.prefetch(artist.coverImage);
    songs.forEach((s) => {
      if (s.thumbnail) Image.prefetch(s.thumbnail);
    });
  }, [artist, songs]);

  useEffect(() => {
    if (!currentSong) setCurrentSong(songs[0] ?? null);
  }, [songs, currentSong]);

  return (
    <LinearGradient
      colors={Colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBackground}
    >
      <StatusBar barStyle="light-content" />
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {isVideoPlaying && currentItem?.mediaType === 'video' ? (
          <View style={styles.stickyVideoHost}>
            <InlineVideoPlayer
              mediaUrl={currentItem.mediaUrl}
              aspectRatio={inlineVideoAspectRatio}
              onAspectRatio={(r) => setInlineVideoAspectRatio(r)}
              videoRef={videoRef}
              shouldPlay={playerState.isPlaying}
              positionMs={playerState.positionMs}
              durationMs={playerState.durationMs}
              onPlaybackStatusUpdate={onVideoPlaybackStatusUpdate}
              onTogglePlay={() => togglePlayPause().catch(() => undefined)}
              onSeek={(pos) => seekTo(pos).catch(() => undefined)}
              onToggleFullscreen={() => setExpanded(true)}
              onBack={() => navigation.goBack()}
              topInset={insets.top}
            />
          </View>
        ) : null}
        {/* Debug Toggle */}
        {showDebugToggle && (
          <View style={styles.debugToggle}>
            <TouchableOpacity
              style={[
                styles.debugButton,
                !isSubscriptionActive && styles.debugButtonActive
              ]}
              onPress={() => setIsSubscriptionActive(!isSubscriptionActive)}
            >
              <Settings size={16} color="#fff" />
              <Text style={styles.debugButtonText}>
                Subscription: {isSubscriptionActive ? 'Active' : 'Expired'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Subscription Expiry Guard Screen */}
        {!isSubscriptionActive && artist ? (
          <SubscriptionExpiryScreen artistName={artist.name} onRenewSubscription={handleRenewSubscription} />
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : error || !artist ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.errorText}>{error || 'Unable to load artist.'}</Text>
          </View>
        ) : (
          <>
            <FlatList
              key={useGrid ? 'grid' : 'list'}
              numColumns={useGrid ? 2 : 1}
              data={channelContent}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <>
                  {!isVideoPlaying ? (
                    <ProfileHeaderSection
                      bannerUrl={artist.coverImage}
                      avatarUrl={artist.profileImage || artist.coverImage}
                      name={artist.name}
                      verified={artist.verified}
                      subscribersLabel={artist.subscribers}
                      onBack={() => navigation.goBack()}
                      onSubscribe={() => navigation.navigate('SubscriptionFlow')}
                      onJoin={() => navigation.navigate('SubscriptionFlow')}
                    />
                  ) : (
                    <InlineArtistMetaSection
                      avatarUrl={artist.profileImage || artist.coverImage}
                      name={artist.name}
                      verified={artist.verified}
                      subscribersLabel={artist.subscribers}
                      videoTitle={currentItem?.title ?? currentSong?.title ?? ''}
                      onSubscribe={() => navigation.navigate('SubscriptionFlow')}
                      onJoin={() => navigation.navigate('SubscriptionFlow')}
                    />
                  )}

                  <ChannelNavTabs
                    active={activeChannelTab}
                    onChange={(k) => {
                      setActiveChannelTab(k);
                      if (k === 'Home') setActiveTab('All');
                      if (k === 'Videos') setActiveTab('Video');
                    }}
                  />

                  <MediaFilterPills active={activeTab} onChange={setActiveTab} />
                </>
              }
              contentContainerStyle={{
                paddingTop: isVideoPlaying ? 220 : 0,
                paddingBottom: tabBarHeight + 140,
              }}
              columnWrapperStyle={useGrid ? styles.gridRow : undefined}
              renderItem={({ item, index }) => (
                <MediaCard
                  item={item}
                  index={index}
                  isGrid={useGrid}
                  onPress={() => handleSongPress(item)}
                />
              )}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.loadingWrap}>
                  <Text style={styles.emptyText}>
                    {activeChannelTab === 'Playlists'
                      ? 'No playlists yet.'
                      : activeChannelTab === 'Community'
                        ? 'No community posts yet.'
                        : 'No uploads yet.'}
                  </Text>
                </View>
              }
            />
          </>
        )}
      </View>
    </SafeAreaView>
    </LinearGradient>
  );
}

function InlineVideoPlayer({
  mediaUrl,
  aspectRatio,
  onAspectRatio,
  videoRef,
  shouldPlay,
  positionMs,
  durationMs,
  onPlaybackStatusUpdate,
  onTogglePlay,
  onSeek,
  onToggleFullscreen,
  onBack,
  topInset,
}: {
  mediaUrl: string;
  aspectRatio: number;
  onAspectRatio: (r: number) => void;
  videoRef: any;
  shouldPlay: boolean;
  positionMs: number;
  durationMs: number;
  onPlaybackStatusUpdate: (st: any) => void;
  onTogglePlay: () => void;
  onSeek: (pos: number) => void;
  onToggleFullscreen: () => void;
  onBack: () => void;
  topInset: number;
}) {
  return (
    <View style={[styles.youtubeVideoWrap, { aspectRatio }]}>
      <Video
        key={`${mediaUrl}-${aspectRatio}`}
        ref={videoRef}
        style={{ width: '100%', height: undefined, aspectRatio }}
        source={{ uri: mediaUrl }}
        shouldPlay={shouldPlay}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls={false}
        progressUpdateIntervalMillis={100}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onReadyForDisplay={(e) => {
          const size = (e as any)?.naturalSize;
          const w = Number(size?.width ?? 0);
          const h = Number(size?.height ?? 0);
          if (w > 0 && h > 0) {
            const ratio = w / h;
            if (Number.isFinite(ratio) && ratio > 0) onAspectRatio(ratio);
            return;
          }
          onAspectRatio(16 / 9);
        }}
      />

      <YouTubeVideoControlsOverlay
        isPlaying={shouldPlay}
        positionMs={positionMs}
        durationMs={durationMs}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        isFullscreen={false}
        onToggleFullscreen={onToggleFullscreen}
      />

      <LinearGradient colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']} style={styles.youtubeVideoTopGradient} />
      <View style={[styles.youtubeVideoTopRow, { paddingTop: Math.max(10, topInset + 6) }]}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <ArrowLeft color="#fff" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

function ProfileHeaderSection({
  bannerUrl,
  avatarUrl,
  name,
  verified,
  subscribersLabel,
  onBack,
  onSubscribe,
  onJoin,
}: {
  bannerUrl: string;
  avatarUrl: string;
  name: string;
  verified: boolean;
  subscribersLabel: string;
  onBack: () => void;
  onSubscribe: () => void;
  onJoin: () => void;
}) {
  return (
    <View style={styles.profileWrap}>
      <View style={styles.bannerWrap}>
        <Image source={{ uri: bannerUrl }} style={styles.bannerImg} />
        <LinearGradient colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.75)']} style={styles.bannerGradient} />
        <View style={styles.bannerTopRow}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
        </View>
      </View>

      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
        </View>
      </View>

      <View style={styles.profileMeta}>
        <View style={styles.nameRow}>
          <Text style={styles.profileName} numberOfLines={1}>
            {name}
          </Text>
          {verified ? (
            <View style={styles.verifiedBadge}>
              <BadgeCheck color="#4AA3FF" fill="#4AA3FF" size={18} />
            </View>
          ) : null}
        </View>
        <Text style={styles.profileSubs}>{subscribersLabel}</Text>

        <View style={styles.actionsRow}>
          <Pressable onPress={onSubscribe} style={styles.subscribeBtn}>
            <Text style={styles.subscribeBtnText}>Subscribe</Text>
          </Pressable>
          <Pressable onPress={onJoin} style={styles.joinBtn}>
            <Text style={styles.joinBtnText}>Join</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function InlineArtistMetaSection({
  avatarUrl,
  name,
  verified,
  subscribersLabel,
  videoTitle,
  onSubscribe,
  onJoin,
}: {
  avatarUrl: string;
  name: string;
  verified: boolean;
  subscribersLabel: string;
  videoTitle: string;
  onSubscribe: () => void;
  onJoin: () => void;
}) {
  return (
    <View style={styles.inlineMetaWrap}>
      {videoTitle ? (
        <Text style={styles.inlineVideoTitle} numberOfLines={2}>
          {videoTitle}
        </Text>
      ) : null}

      <View style={styles.inlineMetaRow}>
        <View style={styles.inlineAvatarWrap}>
          <Image source={{ uri: avatarUrl }} style={styles.inlineAvatarImg} />
        </View>

        <View style={styles.inlineMetaTextWrap}>
          <View style={styles.inlineNameRow}>
            <Text style={styles.inlineArtistName} numberOfLines={1}>
              {name}
            </Text>
            {verified ? (
              <View style={styles.verifiedBadge}>
                <BadgeCheck color="#4AA3FF" fill="#4AA3FF" size={18} />
              </View>
            ) : null}
          </View>
          <Text style={styles.inlineSubs}>{subscribersLabel}</Text>
        </View>

        <View style={styles.inlineActionsRow}>
          <Pressable onPress={onSubscribe} style={styles.inlineSubscribeBtn}>
            <Text style={styles.inlineSubscribeText}>Subscribe</Text>
          </Pressable>
          <Pressable onPress={onJoin} style={styles.inlineJoinBtn}>
            <Text style={styles.inlineJoinText}>Join</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ChannelNavTabs({ active, onChange }: { active: ChannelTabKey; onChange: (k: ChannelTabKey) => void }) {
  return (
    <BlurView intensity={22} tint="dark" style={styles.channelTabsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.channelTabsContent}
      >
        {CHANNEL_TABS.map((t) => {
          const isActive = active === t;
          return (
            <Pressable
              key={t}
              onPress={() => onChange(t)}
              style={[styles.channelTabPill, isActive ? styles.channelTabPillActive : null]}
            >
              <Text style={[styles.channelTabText, isActive ? styles.channelTabTextActive : null]}>{t}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </BlurView>
  );
}

function MediaFilterPills({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  return (
    <View style={styles.filterWrap}>
      <View style={styles.filterRow}>
        {TABS.map((t) => {
          const isActive = active === t;
          return (
            <Pressable
              key={t}
              onPress={() => onChange(t)}
              style={[styles.filterPill, isActive ? styles.filterPillActive : null]}
            >
              <Text style={[styles.filterText, isActive ? styles.filterTextActive : null]}>{t}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function MediaCard({
  item,
  index,
  isGrid,
  onPress,
}: {
  item: Song;
  index: number;
  isGrid: boolean;
  onPress: () => void;
}) {
  const viewsLabel = deriveViewsLabel(item.id);
  const timeAgoLabel = deriveTimeAgoLabel(item.id);
  const metaLine = `${viewsLabel} • ${timeAgoLabel}`;
  const badgeText = item.mediaType === 'video' ? 'VIDEO' : 'AUDIO';

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cardPressable,
        isGrid ? styles.cardPressableGrid : styles.cardPressableList,
        isGrid && index % 2 === 0 ? styles.cardGridRightGutter : null,
      ]}
    >
      <View style={styles.card}>
        <View style={styles.cardThumbWrap}>
          <Image source={{ uri: item.thumbnail }} style={styles.cardThumb} />
          <LinearGradient colors={['rgba(0,0,0,0.00)', 'rgba(0,0,0,0.55)']} style={styles.cardThumbGradient} />

          <View style={styles.cardBadgeRight}>
            <Text style={styles.cardBadgeText}>{badgeText}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {metaLine}
        </Text>
      </View>
    </Pressable>
  );
}

function stableHash(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function compactNumber(n: number) {
  if (n >= 1_000_000_000) return `${stripTrailingZero((n / 1_000_000_000).toFixed(1))}B`;
  if (n >= 1_000_000) return `${stripTrailingZero((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${stripTrailingZero((n / 1_000).toFixed(1))}K`;
  return `${n}`;
}

function stripTrailingZero(s: string) {
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function deriveSubscribersLabel(seed: string | number) {
  const key = String(seed || '');
  const n = (stableHash(`subs:${key}`) % 9_000_000) + 120_000;
  return `${compactNumber(n)} subscribers`;
}

function deriveViewsLabel(seed: string) {
  const n = (stableHash(`views:${seed}`) % 40_000_000) + 1_200;
  return `${compactNumber(n)} views`;
}

function deriveTimeAgoLabel(seed: string) {
  const days = (stableHash(`ago:${seed}`) % 400) + 1;
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.max(1, Math.round(days / 7))} weeks ago`;
  if (days < 365) return `${Math.max(1, Math.round(days / 30))} months ago`;
  return `${Math.max(1, Math.round(days / 365))} years ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  stickyVideoHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
  },
  gradientBackground: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  youtubeVideoWrap: {
    width: '100%',
    backgroundColor: Colors.backgroundAlt,
    alignSelf: 'center',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: 'hidden',
  },
  youtubeVideo: {
    // unused; inline style on <Video />
  },
  youtubeVideoTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  youtubeVideoTopRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  errorText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    marginLeft: 10,
    marginTop: 2,
  },

  profileWrap: {
    marginTop: 12,
  },
  bannerWrap: {
    height: 170,
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  avatarRow: {
    marginTop: -44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#121212',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  profileMeta: {
    paddingHorizontal: 18,
    paddingTop: 10,
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '100%',
  },
  profileName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.2,
    maxWidth: 260,
  },
  profileSubs: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.70)',
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscribeBtn: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#FF2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  joinBtn: {
    marginLeft: 12,
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    fontWeight: '800',
  },

  channelTabsWrap: {
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  channelTabsContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  channelTabPill: {
    marginRight: 10,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelTabPillActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  channelTabText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 14,
    fontWeight: '800',
  },
  channelTabTextActive: {
    color: '#fff',
  },

  filterWrap: {
    marginTop: 12,
    paddingHorizontal: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterPill: {
    marginRight: 10,
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(18,18,18,0.80)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  filterText: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  filterTextActive: {
    color: '#fff',
  },

  inlineMetaWrap: {
    paddingTop: 12,
    paddingHorizontal: 14,
  },
  inlineVideoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
  inlineMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#121212',
  },
  inlineAvatarImg: {
    width: '100%',
    height: '100%',
  },
  inlineMetaTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  inlineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inlineArtistName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    maxWidth: 180,
  },
  inlineSubs: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  inlineActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  inlineSubscribeBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#FF2D2D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineSubscribeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  inlineJoinBtn: {
    marginLeft: 8,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineJoinText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 13,
    fontWeight: '800',
  },

  gridRow: {
    paddingHorizontal: 14,
  },
  cardPressable: {
    marginTop: 14,
  },
  cardPressableGrid: {
    flex: 1,
  },
  cardPressableList: {
    paddingHorizontal: 14,
  },
  cardGridRightGutter: {
    marginRight: 12,
  },
  card: {
    borderRadius: 16,
    backgroundColor: 'rgba(18,18,18,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  cardThumbWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0B0B0B',
  },
  cardThumb: {
    width: '100%',
    height: '100%',
  },
  cardThumbGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  cardBadgeRight: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeLeft: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBadgeLeftIcon: {
    marginRight: 6,
  },
  cardBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  cardTitle: {
    paddingHorizontal: 12,
    paddingTop: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  cardMeta: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
    fontWeight: '600',
  },

  // Debug styles
  debugToggle: {
    position: 'absolute',
    top: 10,
    right: 14,
    zIndex: 1000,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  debugButtonActive: {
    backgroundColor: 'rgba(255, 182, 8, 0.25)',
    borderColor: Colors.accent,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
