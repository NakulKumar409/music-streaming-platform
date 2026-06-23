import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  LayoutAnimation,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Path,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
} from "react-native-svg";

import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView } from "expo-video";
import { ArrowLeft, BadgeCheck, Lock, X } from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useMediaPlayer } from "../providers/MediaPlayerProvider";
import {
  fetchArtistById,
  fetchArtistMedia,
  type ArtistDetail,
  type ArtistMediaItem,
} from "../services/artistService";
import { userService } from "../services/userService";
import { Colors } from "../theme";
import {
  LockedContentOverlay,
  RetentionBanner,
  StrongUpsellModal,
} from "../ui/SubscriptionUI";
import YouTubeVideoControlsOverlay from "../ui/YouTubeVideoControlsOverlay";
import { getOptimizedImageUrl } from "../utils/cloudinary";

function SpotifyIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="12" fill="#1DB954" />
      <Path
        d="M6.8 10.2c4.2-1.2 8.6-.9 12.6.8"
        fill="none"
        stroke="#0a0a0a"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.85"
      />
      <Path
        d="M7.6 13.0c3.4-0.9 6.7-0.6 9.8 0.9"
        fill="none"
        stroke="#0a0a0a"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <Path
        d="M8.4 15.7c2.6-0.6 5.1-0.4 7.4 0.7"
        fill="none"
        stroke="#0a0a0a"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.85"
      />
    </Svg>
  );
}

function YouTubeIcon({ size = 18 }: { size?: number }) {
  const w = size;
  const h = size * 0.78;
  return (
    <Svg
      width={w}
      height={h}
      viewBox="0 0 24 19"
      preserveAspectRatio="xMidYMid meet">
      <Rect x="0" y="0" width="24" height="19" rx="4.2" fill="#FF0000" />
      <Path d="M10 5.2L16 9.5L10 13.8V5.2Z" fill="#ffffff" />
    </Svg>
  );
}

function InstagramBrandIcon({ size = 18 }: { size?: number }) {
  const r = 5.2;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet">
      <Defs>
        <SvgLinearGradient id="igGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F58529" />
          <Stop offset="0.35" stopColor="#DD2A7B" />
          <Stop offset="0.7" stopColor="#8134AF" />
          <Stop offset="1" stopColor="#515BD4" />
        </SvgLinearGradient>
      </Defs>

      <Rect x="2" y="2" width="20" height="20" rx={r} fill="url(#igGradient)" />

      <Rect
        x="6.6"
        y="6.6"
        width="10.8"
        height="10.8"
        rx="3"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
      />
      <Circle
        cx="12"
        cy="12"
        r="3.0"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.7"
      />
      <Circle cx="16.4" cy="7.6" r="1.0" fill="#ffffff" />
    </Svg>
  );
}

type Song = {
  id: string;
  contentId?: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  locked: boolean;
  mediaType: "audio" | "video";
  mediaUrl: string;
  useStreamAccess?: boolean;
  createdAt?: string | null;
  likeCount?: number | null;
  dislikeCount?: number | null;
  userReaction?: "like" | "dislike" | null;
};

type Artist = {
  id: string;
  name: string;
  verified: boolean;
  subscribers: string;
  profileImage: string;
  coverImage: string;
  bio: string;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  subscriptionPrice: number;
};

type TabKey = "All" | "Audio" | "Video";

const TABS: TabKey[] = ["All", "Audio", "Video"];

type ChannelTabKey = "Home" | "Videos" | "Playlists" | "Community";
const CHANNEL_TABS: ChannelTabKey[] = [
  "Home",
  "Videos",
  "Playlists",
  "Community",
];

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
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
    videoPlayer,
    togglePlayPause,
    seekTo,
    setExpanded,
    setInlineVideoHostActive,
  } = useMediaPlayer();

  useEffect(() => {
    const isInlineVideo =
      isFocused &&
      currentItem?.mediaType === "video" &&
      !playerState.isExpanded;
    setInlineVideoHostActive(isInlineVideo);
    return () => {
      setInlineVideoHostActive(false);
    };
  }, [
    currentItem?.mediaType,
    isFocused,
    playerState.isExpanded,
    setInlineVideoHostActive,
  ]);

  const [activeTab, setActiveTab] = useState<TabKey>("All");
  const [activeChannelTab, setActiveChannelTab] =
    useState<ChannelTabKey>("Home");
  const [currentSong, setCurrentSong] = useState<Song | null>(null);

  const [inlineVideoAspectRatio, setInlineVideoAspectRatio] = useState(16 / 9);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscription state
  const [isSubscribedToArtist, setIsSubscribedToArtist] = useState(false);
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(true);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [isExpiringSoon, setIsExpiringSoon] = useState(false);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState<number>(0);
  const [lockedClicks, setLockedClicks] = useState(0);
  const [showStrongUpsell, setShowStrongUpsell] = useState(false);
  const [showArtistLockModal, setShowArtistLockModal] = useState<{
    visible: boolean;
    song: Song | null;
  }>({
    visible: false,
    song: null,
  });

  const [showDebugToggle, setShowDebugToggle] = useState(__DEV__);

  const handleRenewSubscription = () => {
    navigation.navigate("SubscriptionFlow");
    setIsSubscriptionActive(true); // Reset after navigation
  };

  const artistIdParam = (route?.params?.artistId ?? "").toString();
  const artistId = useMemo(() => {
    const s = (artistIdParam ?? "").toString().trim();
    if (!s) return "";
    const base = s.includes(":") ? s.split(":")[0] : s;
    const n = Number.parseInt(base, 10);
    if (!Number.isFinite(n) || n <= 0) return base;
    return String(n);
  }, [artistIdParam]);
  const initialMediaId = (route?.params?.contentId ?? "").toString();

  const activeAudioMeta =
    currentItem?.mediaType === "audio" ? currentItem : null;
  const hasActiveAudio = !!activeAudioMeta;

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isFocused) return;

      if (!artistId) {
        console.warn("[ArtistScreen] missing artistId param", {
          params: route?.params,
        });
        setArtist(null);
        setSongs([]);
        setError("Artist not found");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch subscription status
        userService
          .getFullSubscriptionStatus()
          .then((status) => {
            if (status) {
              const artistIdS = String(artistId);
              // Check specific artist sub
              const targetArtistSub = status.artists?.find(
                (s) => s.artistId === artistIdS && s.status === "ACTIVE"
              );
              const platformSub = status.platform;
              const hasPlatformSub = platformSub?.status === "ACTIVE";

              const isSub = !!targetArtistSub || hasPlatformSub;
              setIsSubscribedToArtist(isSub);
              setIsSubscriptionActive(isSub);

              const activeSub =
                targetArtistSub || (hasPlatformSub ? platformSub : null);

              if (activeSub) {
                setExpiryDate(
                  activeSub.nextBillingDate || activeSub.endDate || null
                );
                setIsExpiringSoon(activeSub.isExpiringSoon || false);

                if (activeSub.nextBillingDate) {
                  const now = new Date();
                  const end = new Date(activeSub.nextBillingDate);
                  const diff = Math.ceil(
                    (end.getTime() - now.getTime()) / (1000 * 86400)
                  );
                  setDaysUntilExpiry(diff > 0 ? diff : 0);
                }
              } else {
                setExpiryDate(null);
                setIsExpiringSoon(false);
              }
            }
          })
          .catch(() => undefined);

        const artistRes = await fetchArtistById(artistId);

        if (!mounted) return;

        const a: ArtistDetail | null = artistRes;
        if (!a) {
          setArtist(null);
          setSongs([]);
          setError("Artist not found");
          return;
        }

        const normalizedArtist: Artist = {
          id: a.id,
          name: a.name,
          verified: a.isVerified,
          subscribers: deriveSubscribersLabel(a.id),
          profileImage: a.profileImageUrl,
          coverImage: a.coverImageUrl,
          bio: (a as any).bio ?? "",
          spotifyUrl: (a as any).spotifyUrl ?? null,
          youtubeUrl: (a as any).youtubeUrl ?? null,
          instagramUrl: (a as any).instagramUrl ?? null,
          subscriptionPrice: a.subscriptionPrice,
        };

        const toSong = (it: ArtistMediaItem): Song => ({
          id: it.id,
          contentId: it.contentId,
          title: it.title,
          artist: a.name,
          duration: it.mediaType === "video" ? "Video" : "Audio",
          thumbnail: it.artworkUrl,
          locked: it.locked,
          mediaType: it.mediaType,
          mediaUrl: it.mediaUrl,
          useStreamAccess: it.useStreamAccess,
          createdAt: it.createdAt ?? null,
          likeCount: it.likeCount ?? null,
          dislikeCount: it.dislikeCount ?? null,
          userReaction: it.userReaction ?? null,
        });

        setArtist(normalizedArtist);

        try {
          const mediaRes = await fetchArtistMedia(artistId);
          if (!mounted) return;
          setSongs(mediaRes.map(toSong));
        } catch (e: any) {
          if (!mounted) return;
          console.warn("[ArtistScreen] fetchArtistMedia failed", {
            artistId,
            message: e?.message,
            status: e?.response?.status,
            data: e?.response?.data,
          });
          setSongs([]);
        }
      } catch (e: any) {
        if (!mounted) return;
        console.warn("[ArtistScreen] fetchArtistById failed", {
          artistId,
          message: e?.message,
          status: e?.response?.status,
          data: e?.response?.data,
        });
        setError("Failed to load artist");
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
  }, [artistId, isFocused]);

  useEffect(() => {
    if (!artist) return;
    if (!initialMediaId) return;
    if (!songs.length) return;

    const match = songs.find(
      (s) => s.id === initialMediaId || s.contentId === initialMediaId
    );
    if (!match) return;

    if (match.mediaType === "audio") setActiveTab("Audio");
    if (match.mediaType === "video") setActiveTab("Video");

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
        mediaUrl: s.mediaUrl || "",
        isLocked: s.locked ?? false,
        useStreamAccess: s.useStreamAccess,
      }));
    const idx = queue.findIndex(
      (q) => q.id === initialMediaId || q.contentId === initialMediaId
    );
    if (idx < 0) return;

    playQueue(queue, idx).catch(() => undefined);
    setCurrentSong(match);
  }, [artist, initialMediaId, playQueue, songs]);

  useEffect(() => {
    const nextIsVideoPlaying = currentItem?.mediaType === "video";
    if (nextIsVideoPlaying === isVideoPlaying) return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsVideoPlaying(nextIsVideoPlaying);
  }, [currentItem?.mediaType, isVideoPlaying]);

  const isUnlocked = Boolean(route?.params?.unlocked);
  const isTemporarilyUnlocked = isUnlocked;

  const filteredSongs = useMemo(() => {
    const baseSongs = isTemporarilyUnlocked
      ? songs.map((s) => ({ ...s, locked: false }))
      : songs;
    if (activeTab === "All") return baseSongs;
    if (activeTab === "Audio")
      return baseSongs.filter((s) => s.mediaType === "audio");
    return baseSongs.filter((s) => s.mediaType === "video");
  }, [activeTab, isTemporarilyUnlocked, songs]);

  // Build navigation params for FullPlayerScreen — Move after filteredSongs
  const buildFullPlayerParams = useCallback(
    (song: Song) => {
      if (!artist) return null;
      const queue = filteredSongs
        .filter((s) => Boolean(s.mediaUrl) || s.useStreamAccess)
        .map((s) => ({
          id: s.id,
          contentId: s.contentId,
          title: s.title,
          artistName: s.artist,
          artistId: artist.id,
          mediaType: s.mediaType,
          artworkUrl: s.thumbnail,
          mediaUrl: s.mediaUrl || "",
          isLocked: s.locked ?? false,
          useStreamAccess: s.useStreamAccess,
        }));
      const idx = queue.findIndex((q) => q.id === song.id);
      return {
        songId: song.id,
        title: song.title,
        artist: song.artist,
        imageUrl: song.thumbnail,
        audioUrl: song.mediaUrl || "",
        queueIndex: idx >= 0 ? idx : 0,
        queue,
      };
    },
    [artist, filteredSongs]
  );

  const channelContent = useMemo(() => {
    if (activeChannelTab === "Playlists") return [];
    if (activeChannelTab === "Community") return [];
    return filteredSongs;
  }, [activeChannelTab, filteredSongs]);

  const useGrid = false; // Always use single-column list layout

  const handleSongPress = (song: Song) => {
    if (!artist) return;
    if (song.locked) {
      // Tracking locked clicks for smart upsell
      const newCount = lockedClicks + 1;
      setLockedClicks(newCount);

      if (newCount >= 3) {
        setShowStrongUpsell(true);
      }

      // If song is locked, show the artist lock modal for specific upsell
      if (song.locked) {
        setShowArtistLockModal({ visible: true, song });
      }

      return; // Block playback when locked
    }

    if (song.mediaType === "video") {
      navigation.navigate("VideoTab", {
        screen: "VideoIndex",
        params: {
          autoplayVideo: {
            id: song.contentId || song.id.replace(":video", ""),
            title: song.title,
            artistName: song.artist,
            artistId: artist.id,
            artworkUrl: song.thumbnail,
            mediaUrl: song.mediaUrl || "",
            useStreamAccess: song.useStreamAccess,
            category: "Artist Upload",
            likeCount: song.likeCount ?? 0,
            dislikeCount: song.dislikeCount ?? 0,
            userReaction: song.userReaction ?? null,
          },
        },
      });
      return;
    }

    const params = buildFullPlayerParams(song);
    if (params) {
      navigation.navigate("FullPlayer", params);
    }
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
      style={styles.gradientBackground}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.container}>
          {isVideoPlaying && currentItem?.mediaType === "video" ? (
            <View style={styles.stickyVideoHost}>
              <InlineVideoPlayer
                mediaUrl={currentItem.mediaUrl}
                aspectRatio={inlineVideoAspectRatio}
                onAspectRatio={(r) => setInlineVideoAspectRatio(r)}
                videoPlayer={videoPlayer}
                shouldPlay={playerState.isPlaying}
                positionMs={playerState.positionMs}
                durationMs={playerState.durationMs}
                onTogglePlay={() => togglePlayPause().catch(() => undefined)}
                onSeek={(pos) => seekTo(pos).catch(() => undefined)}
                onToggleFullscreen={() => setExpanded(true)}
                onBack={() => navigation.goBack()}
                topInset={insets.top}
              />
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={Colors.accent} />
            </View>
          ) : error || !artist ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.errorText}>
                {error || "Unable to load artist."}
              </Text>
            </View>
          ) : (
            <>
              <FlatList
                key="list"
                numColumns={1}
                initialNumToRender={5}
                windowSize={5}
                removeClippedSubviews={true}
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
                        bio={artist.bio}
                        spotifyUrl={artist.spotifyUrl}
                        youtubeUrl={artist.youtubeUrl}
                        instagramUrl={artist.instagramUrl}
                        onBack={() => navigation.goBack()}
                        onSubscribe={() =>
                          navigation.navigate("SubscriptionFlow", {
                            artistId: artist.id,
                            artistName: artist.name,
                            amount: artist.subscriptionPrice,
                          })
                        }
                        onJoin={() =>
                          navigation.navigate("SubscriptionFlow", {
                            artistId: artist.id,
                            artistName: artist.name,
                            amount: artist.subscriptionPrice,
                          })
                        }
                        isSubscribed={isSubscribedToArtist}
                        expiryDate={expiryDate}
                        subscriptionPrice={artist.subscriptionPrice}
                      />
                    ) : (
                      <InlineArtistMetaSection
                        avatarUrl={artist.profileImage || artist.coverImage}
                        name={artist.name}
                        verified={artist.verified}
                        subscribersLabel={artist.subscribers}
                        videoTitle={
                          currentItem?.title ?? currentSong?.title ?? ""
                        }
                        onSubscribe={() =>
                          navigation.navigate("SubscriptionFlow", {
                            artistId: artist.id,
                            artistName: artist.name,
                            amount: artist.subscriptionPrice,
                          })
                        }
                        onJoin={() =>
                          navigation.navigate("SubscriptionFlow", {
                            artistId: artist.id,
                            artistName: artist.name,
                            amount: artist.subscriptionPrice,
                          })
                        }
                        isSubscribed={isSubscribedToArtist}
                        expiryDate={expiryDate}
                      />
                    )}

                    <ChannelNavTabs
                      active={activeChannelTab}
                      onChange={(k) => {
                        setActiveChannelTab(k);

                        // ✅ Reset filter based on tab
                        if (k === "Home") {
                          setActiveTab("All");
                        } else if (k === "Videos") {
                          setActiveTab("Video");
                        } else {
                          // Playlists & Community - reset to All
                          setActiveTab("All");
                        }
                      }}
                    />

                    {isExpiringSoon && isSubscribedToArtist && (
                      <RetentionBanner
                        daysLeft={daysUntilExpiry}
                        onRenew={() =>
                          navigation.navigate("SubscriptionFlow", {
                            artistId: artist.id,
                            artistName: artist.name,
                          })
                        }
                      />
                    )}

                    <MediaFilterPills
                      active={activeTab}
                      onChange={setActiveTab}
                    />
                  </>
                }
                contentContainerStyle={{
                  paddingTop: isVideoPlaying ? 220 : 0,
                  paddingBottom: tabBarHeight + (hasActiveAudio ? 100 : 20),
                }}
                renderItem={({ item, index }) => (
                  <MediaCard
                    item={item}
                    index={index}
                    isGrid={false}
                    onPress={() => handleSongPress(item)}
                  />
                )}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View style={styles.loadingWrap}>
                    <Text style={styles.emptyText}>
                      {activeChannelTab === "Playlists"
                        ? "No playlists yet."
                        : activeChannelTab === "Community"
                        ? "No community posts yet."
                        : "No uploads yet."}
                    </Text>
                  </View>
                }
              />
            </>
          )}
        </View>

        {showStrongUpsell && (
          <StrongUpsellModal
            artistName={artist?.name || "Artist"}
            onSubscribe={() => {
              setShowStrongUpsell(false);
              setLockedClicks(0);
              navigation.navigate("SubscriptionFlow", {
                artistId: artist?.id,
                artistName: artist?.name,
              });
            }}
          />
        )}

        {showArtistLockModal.visible && (
          <Modal
            transparent
            visible={true}
            animationType="fade"
            onRequestClose={() =>
              setShowArtistLockModal({ visible: false, song: null })
            }>
            <LockedContentOverlay
              artistName={artist?.name}
              onSubscribe={() => {
                setShowArtistLockModal({ visible: false, song: null });
                navigation.navigate("SubscriptionFlow", {
                  artistId: artist?.id,
                  artistName: artist?.name,
                  amount: artist?.subscriptionPrice,
                });
              }}
            />
            <Pressable
              style={{
                position: "absolute",
                top: 50,
                right: 20,
                zIndex: 100,
                padding: 10,
              }}
              onPress={() =>
                setShowArtistLockModal({ visible: false, song: null })
              }>
              <X color="#fff" size={28} />
            </Pressable>
          </Modal>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function InlineVideoPlayer({
  mediaUrl,
  aspectRatio,
  onAspectRatio,
  videoPlayer,
  shouldPlay,
  positionMs,
  durationMs,
  onTogglePlay,
  onSeek,
  onToggleFullscreen,
  onBack,
  topInset,
}: {
  mediaUrl: string;
  aspectRatio: number;
  onAspectRatio: (r: number) => void;
  videoPlayer: any;
  shouldPlay: boolean;
  positionMs: number;
  durationMs: number;
  onTogglePlay: () => void;
  onSeek: (pos: number) => void;
  onToggleFullscreen: () => void;
  onBack: () => void;
  topInset: number;
}) {
  const [controlsVisible, setControlsVisible] = useState(true);
  const toggleControls = useCallback(() => setControlsVisible((v) => !v), []);

  return (
    <View style={[styles.youtubeVideoWrap, { aspectRatio }]}>
      <VideoView
        player={videoPlayer}
        style={{ width: "100%", height: undefined, aspectRatio }}
        contentFit="contain"
        nativeControls={false}
        allowsVideoFrameAnalysis={false}
      />

      <YouTubeVideoControlsOverlay
        isPlaying={shouldPlay}
        positionMs={positionMs}
        durationMs={durationMs}
        onTogglePlay={onTogglePlay}
        onSeek={onSeek}
        isFullscreen={false}
        onToggleFullscreen={onToggleFullscreen}
        isVisible={controlsVisible}
        onToggleVisibility={toggleControls}
      />

      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0)"]}
        style={styles.youtubeVideoTopGradient}
      />
      <View
        style={[
          styles.youtubeVideoTopRow,
          { paddingTop: Math.max(10, topInset + 6) },
        ]}>
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
  bio,
  spotifyUrl,
  youtubeUrl,
  instagramUrl,
  onBack,
  onSubscribe,
  onJoin,
  isSubscribed,
  expiryDate,
  subscriptionPrice,
}: {
  bannerUrl: string;
  avatarUrl: string;
  name: string;
  verified: boolean;
  subscribersLabel: string;
  bio: string;
  spotifyUrl: string | null;
  youtubeUrl: string | null;
  instagramUrl: string | null;
  onBack: () => void;
  onSubscribe: () => void;
  onJoin: () => void;
  isSubscribed: boolean;
  expiryDate: string | null;
  subscriptionPrice: number;
}) {
  const openUrl = async (raw: string) => {
    const trimmed = (raw || "").toString().trim();
    if (!trimmed) return;
    const url =
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) return;
      await Linking.openURL(url);
    } catch {
      // ignore
    }
  };

  return (
    <View style={styles.profileWrap}>
      <View style={styles.bannerWrap}>
        <Image
          source={{ uri: getOptimizedImageUrl(bannerUrl) }}
          style={styles.bannerImg}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.75)"]}
          style={styles.bannerGradient}
        />
        <View style={styles.bannerTopRow}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <ArrowLeft color="#fff" size={22} />
          </Pressable>
        </View>
      </View>

      <View style={styles.avatarRow}>
        <View style={styles.avatarWrap}>
          <Image
            source={{ uri: getOptimizedImageUrl(avatarUrl) }}
            style={styles.avatarImg}
          />
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

        {bio ? (
          <Text style={styles.profileBio} numberOfLines={4}>
            {bio}
          </Text>
        ) : null}

        {spotifyUrl || youtubeUrl || instagramUrl ? (
          <View style={styles.socialWrap}>
            <View style={styles.socialRow}>
              {spotifyUrl ? (
                <Pressable
                  onPress={() => openUrl(spotifyUrl)}
                  style={styles.socialIconBtn}>
                  <SpotifyIcon size={18} />
                </Pressable>
              ) : null}
              {youtubeUrl ? (
                <Pressable
                  onPress={() => openUrl(youtubeUrl)}
                  style={styles.socialIconBtn}>
                  <YouTubeIcon size={18} />
                </Pressable>
              ) : null}
              {instagramUrl ? (
                <Pressable
                  onPress={() => openUrl(instagramUrl)}
                  style={styles.socialIconBtn}>
                  <InstagramBrandIcon size={18} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {isSubscribed ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={styles.subscribedBadge}>
                <BadgeCheck color="#fff" size={14} />
                <Text style={styles.subscribedText}>Subscribed</Text>
              </View>
              {expiryDate && (
                <Text
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 13,
                    fontWeight: "500",
                  }}>
                  Expires:{" "}
                  {new Date(expiryDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity style={styles.subscribeBtn} onPress={onSubscribe}>
              <Text style={styles.subscribeBtnText}>Subscription</Text>
            </TouchableOpacity>
          )}
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
  isSubscribed,
  expiryDate,
}: {
  avatarUrl: string;
  name: string;
  verified: boolean;
  subscribersLabel: string;
  videoTitle: string;
  onSubscribe: () => void;
  onJoin: () => void;
  isSubscribed: boolean;
  expiryDate: string | null;
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
          <Image
            source={{ uri: getOptimizedImageUrl(avatarUrl) }}
            style={styles.inlineAvatarImg}
          />
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
        </View>
        <View style={styles.inlineActionRow}>
          {!isSubscribed ? (
            <TouchableOpacity
              style={styles.inlineSubscribeBtn}
              onPress={onSubscribe}>
              <Text style={styles.inlineSubscribeText}>Subscribe</Text>
            </TouchableOpacity>
          ) : (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>
                Subscribed
              </Text>
              {expiryDate && (
                <Text style={styles.inlineExpiryText}>
                  Expires:{" "}
                  {new Date(expiryDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function ChannelNavTabs({
  active,
  onChange,
}: {
  active: ChannelTabKey;
  onChange: (k: ChannelTabKey) => void;
}) {
  return (
    <BlurView intensity={22} tint="dark" style={styles.channelTabsWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.channelTabsContent}>
        {CHANNEL_TABS.map((t) => {
          const isActive = active === t;
          return (
            <Pressable
              key={t}
              onPress={() => onChange(t)}
              style={[
                styles.channelTabPill,
                isActive ? styles.channelTabPillActive : null,
              ]}>
              <Text
                style={[
                  styles.channelTabText,
                  isActive ? styles.channelTabTextActive : null,
                ]}>
                {t}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </BlurView>
  );
}

function MediaFilterPills({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <View style={styles.filterWrap}>
      <View style={styles.filterRow}>
        {TABS.map((t) => {
          const isActive = active === t;
          return (
            <Pressable
              key={t}
              onPress={() => onChange(t)}
              style={[
                styles.filterPill,
                isActive ? styles.filterPillActive : null,
              ]}>
              <Text
                style={[
                  styles.filterText,
                  isActive ? styles.filterTextActive : null,
                ]}>
                {t}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatDateLabel(raw?: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "";
  const now = Date.now();
  const diff = Math.max(0, now - d.getTime());
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years <= 1 ? "1 year ago" : `${years} years ago`;
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
  const dateLabel = formatDateLabel(item.createdAt);
  const badgeText = item.mediaType === "video" ? "VIDEO" : "AUDIO";

  return (
    <Pressable
      onPress={onPress}
      style={[styles.cardPressable, styles.cardPressableList]}>
      <View style={styles.card}>
        <View style={styles.cardThumbWrap}>
          <Image
            source={{ uri: getOptimizedImageUrl(item.thumbnail) }}
            style={styles.cardThumb}
          />
          {item.locked && (
            <View style={styles.lockOverlay}>
              <Lock size={12} color="#fff" fill="rgba(255,255,255,0.2)" />
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.00)", "rgba(0,0,0,0.55)"]}
            style={styles.cardThumbGradient}
          />

          <View style={styles.cardBadgeRight}>
            <Text style={styles.cardBadgeText}>{badgeText}</Text>
          </View>
        </View>

        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {dateLabel || item.artist}
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
  if (n >= 1_000_000_000)
    return `${stripTrailingZero((n / 1_000_000_000).toFixed(1))}B`;
  if (n >= 1_000_000)
    return `${stripTrailingZero((n / 1_000_000).toFixed(1))}M`;
  if (n >= 1_000) return `${stripTrailingZero((n / 1_000).toFixed(1))}K`;
  return `${n}`;
}

function stripTrailingZero(s: string) {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function deriveSubscribersLabel(seed: string | number) {
  const key = String(seed || "");
  const n = (stableHash(`subs:${key}`) % 9_000_000) + 120_000;
  return `${compactNumber(n)} subscribers`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  stickyVideoHost: {
    position: "absolute",
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
    backgroundColor: "transparent",
  },

  youtubeVideoWrap: {
    width: "100%",
    backgroundColor: Colors.backgroundAlt,
    alignSelf: "center",
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    overflow: "hidden",
  },
  youtubeVideo: {
    // unused; inline style on <Video />
  },
  youtubeVideoTopGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  youtubeVideoTopRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  errorText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  emptyText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
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
    overflow: "hidden",
    backgroundColor: "#121212",
  },
  bannerImg: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  bannerGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  bannerTopRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  avatarRow: {
    marginTop: -44,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    backgroundColor: "#121212",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  profileMeta: {
    paddingHorizontal: 18,
    paddingTop: 10,
    alignItems: "center",
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "100%",
  },
  profileName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.2,
    maxWidth: 260,
  },
  profileSubs: {
    marginTop: 6,
    color: "rgba(255,255,255,0.70)",
    fontSize: 13,
  },
  profileBio: {
    marginTop: 10,
    paddingHorizontal: 18,
    color: "rgba(255,255,255,0.82)",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  socialRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  socialWrap: {
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  socialIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  socialIconBtnPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  channelTabsWrap: {
    marginTop: 14,
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  channelTabsContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  channelTabPill: {
    marginRight: 10,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  channelTabPillActive: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.22)",
  },
  channelTabText: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 14,
    fontWeight: "800",
  },
  channelTabTextActive: {
    color: "#fff",
  },

  filterWrap: {
    marginTop: 12,
    paddingHorizontal: 14,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterPill: {
    marginRight: 10,
    paddingHorizontal: 14,
    height: 30,
    borderRadius: 999,
    backgroundColor: "rgba(18,18,18,0.80)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterPillActive: {
    backgroundColor: "rgba(255,182,8,0.20)",
    borderColor: "#FFB608",
  },
  filterTextActive: {
    color: "#FFB608",
  },
  filterText: {
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  
  inlineMetaWrap: {
    paddingTop: 12,
    paddingHorizontal: 14,
  },
  inlineVideoTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20,
  },
  inlineMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  inlineAvatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#121212",
  },
  inlineAvatarImg: {
    width: "100%",
    height: "100%",
  },
  inlineMetaTextWrap: {
    flex: 1,
    marginLeft: 10,
  },
  inlineNameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  inlineArtistName: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    maxWidth: 180,
  },
  inlineSubs: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  subscribedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1DB954",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  subscribedText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
  },
  subscribeBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    minWidth: 140,
    alignItems: "center",
  },
  subscribeBtnText: {
    color: "#000",
    fontSize: 14,
    fontWeight: "700",
  },
  joinBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  joinBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  inlineJoinBtnSubscribed: {
    backgroundColor: "rgba(255,106,0,0.15)",
    borderColor: "rgba(255,106,0,0.5)",
  },
  expiryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 4,
    marginTop: 2,
  },
  expiryBadgeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontWeight: "800",
  },
  inlineExpiryText: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 4,
    textAlign: "center",
  },
  inlineActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineSubscribeBtn: {
    justifyContent: "center",
  },
  inlineSubscribeText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  inlineJoinBtn: {
    marginLeft: 8,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  inlineJoinText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "800",
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
    backgroundColor: "rgba(18,18,18,0.86)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  cardThumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#0B0B0B",
  },
  cardThumb: {
    width: "100%",
    height: "100%",
  },
  cardThumbGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 70,
  },
  cardBadgeRight: {
    position: "absolute",
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBadgeLeft: {
    position: "absolute",
    left: 10,
    bottom: 10,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBadgeLeftIcon: {
    marginRight: 6,
  },
  cardBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  cardTitle: {
    paddingHorizontal: 12,
    paddingTop: 12,
    color: "#fff",
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
  },
  cardMeta: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
    color: "rgba(255,255,255,0.62)",
    fontSize: 12,
    fontWeight: "600",
  },

  // Debug styles
  debugToggle: {
    position: "absolute",
    top: 10,
    right: 14,
    zIndex: 1000,
  },
  debugButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  debugButtonActive: {
    backgroundColor: "rgba(255, 182, 8, 0.25)",
    borderColor: Colors.accent,
  },
  debugButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  lockOverlay: {
    position: "absolute",
    top: 6,
    left: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
});
