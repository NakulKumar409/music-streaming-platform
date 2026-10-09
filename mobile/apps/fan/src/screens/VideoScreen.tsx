import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  LayoutAnimation,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { createVideoPlayer, VideoPlayer, VideoView, type VideoSource } from "expo-video";

import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { useEventListener } from "expo";
import { setAudioModeAsync } from "expo-audio";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as ScreenOrientation from "expo-screen-orientation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  Crown,
  Lock,
  Maximize,
  Minimize,
  MoreVertical,
  Search,
  Settings,
  ShieldCheck,
  Video,
  Volume2,
  VolumeX,
  Wifi,
  X,
  Zap,
} from "lucide-react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import PauseButtonImg from "../pausebuttton.png";
import PlayButtonImg from "../playbutton.png";
import { useMediaPlayer } from "../providers/MediaPlayerProvider";
import { apiV1, contentApi, normalizeApiError } from "../services/api";
import { startHeartbeat, stopHeartbeat } from "../services/heartbeatService";
import * as streamService from "../services/streamService";
import { userService } from "../services/userService";
import { Colors } from "../theme";
import { getOptimizedImageUrl } from "../utils/cloudinary";
import { resolveAppImageUrl } from "../utils/imageUtils";
import AppImage from "../components/AppImage";
import {
  formatDurationLabel,
  hasFiniteDuration,
  toFiniteDurationMs,
} from "../utils/mediaTime";
import {
  decodeJwtExpMsFromUrl,
  isStreamingUrlExpiringSoon,
} from "../utils/streaming";

const REPORTED_CONTENT_STORAGE_KEY = "reportedContentIds";

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
  artistProfileImage?: string | null;
  createdAt?: string | null;
  useStreamAccess?: boolean;
  isLocked?: boolean;
  locked?: boolean;
  genre?: string | null;
  viewCount?: number | null;
  views?: number | null;
  likeCount?: number | null;
  dislikeCount?: number | null;
  storageKey?: string | null;
  storage_provider?: string | null;
  userReaction?: "like" | "dislike" | null;
};

type VideoCard = {
  id: string;
  title: string;
  artistName: string;
  artistId?: string;
  artistProfileImage?: string;
  artworkUrl: string;
  mediaUrl: string;
  useStreamAccess?: boolean;
  storageKey?: string | null;
  category: string;
  createdAt?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  dislikeCount?: number | null;
  userReaction?: "like" | "dislike" | null;
  isLocked?: boolean;
};

function toCount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function EngagementIcon({
  name,
  size = 18,
  color = "#fff",
}: {
  name: "like" | "dislike" | "report";
  size?: number;
  color?: string;
}) {
  const s = size;
  const strokeWidth = 1.9;

  if (name === "like") {
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

  if (name === "dislike") {
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

const FALLBACK_ARTWORK =
  "https://images.unsplash.com/photo-1526948128573-703ee1aeb6fa?auto=format&fit=crop&w=1400&q=80";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HEADER_ASPECT = 16 / 9;
const HEADER_HEIGHT = Math.round(SCREEN_WIDTH / HEADER_ASPECT);
const MINI_PLAYER_W = 180;
const MINI_PLAYER_H = Math.round(MINI_PLAYER_W / HEADER_ASPECT);
const DOUBLE_TAP_MS = 250;
const SEEK_DELTA_MS = 10_000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hashColor(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  const r = (h & 0xff0000) >> 16;
  const g = (h & 0x00ff00) >> 8;
  const b = h & 0x0000ff;
  const rr = (r + 256) % 256;
  const gg = (g + 256) % 256;
  const bb = (b + 256) % 256;
  return `rgb(${rr},${gg},${bb})`;
}

function formatCompactViews(v: number | null | undefined): string {
  const n = typeof v === "number" && Number.isFinite(v) ? v : null;
  if (n === null) return "— views";
  if (n < 1000) return `${n} views`;
  if (n < 1_000_000)
    return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K views`;
  if (n < 1_000_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M views`;
  return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B views`;
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

function normalizeCategory(raw: unknown): string {
  const c = (raw ?? "").toString().trim();
  return c || "Trending";
}

export default function VideoScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const tabBarHeight = useBottomTabBarHeight();
  const {
    currentItem,
    state: playerState,
    togglePlayPause,
    syncActiveMediaItem,
    setInlineVideoHostActive,
  } = useMediaPlayer();

  const insets = useSafeAreaInsets();

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<VideoCard[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [lastAttemptedHdQuality, setLastAttemptedHdQuality] =
    useState<streamService.VideoQuality | null>(null);
  const [lastAttemptedVideo, setLastAttemptedVideo] =
    useState<VideoCard | null>(null);

  const [activeVideoMeta, setActiveVideoMeta] = useState<VideoCard | null>(
    null
  );
  const [activePlaybackUrl, setActivePlaybackUrl] = useState<string | null>(
    null
  );
  const [loadingPlaybackUrl, setLoadingPlaybackUrl] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [reactionStateById, setReactionStateById] = useState<
    Record<
      string,
      {
        reaction: "like" | "dislike" | null;
        likeDelta: number;
        dislikeDelta: number;
      }
    >
  >({});

  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [showUpNext, setShowUpNext] = useState(false);
  const [upNextSeconds, setUpNextSeconds] = useState(5);
  const upNextTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showControls, setShowControls] = useState(true);
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const playedOnceRef = useRef(false);

  const [isSeeking, setIsSeeking] = useState(false);
  const seekValueRef = useRef(0);

  const lastStatusPositionRef = useRef(0);
  const lastStatusDurationRef = useRef(0);
  const durationSetForUrlRef = useRef<string | null>(null);

  const [showQualitySheet, setShowQualitySheet] = useState(false);
  const [selectedQuality, setSelectedQuality] =
    useState<streamService.VideoQuality>("Auto");
  const [isHD, setIsHD] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  // Flag to distinguish quality-only URL changes from full video switches
  const isQualitySwitchRef = useRef(false);

  const [maxAllowedResolution, setMaxAllowedResolution] =
    useState<streamService.VideoQuality>("240p");
  const [isStreamingHdAllowed, setIsStreamingHdAllowed] = useState(false);

  // Playback speed
  const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const;
  const [selectedSpeed, setSelectedSpeed] = useState<number>(1.0);
  const [showSpeedSheet, setShowSpeedSheet] = useState(false);
  const [isHolding2x, setIsHolding2x] = useState(false);
  const holding2xTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSpeedRef = useRef<number>(1.0);

  // Mute / Volume
  const [isMuted, setIsMuted] = useState(false);

  // Autoplay
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState(true);

  // More Options sheet
  const [showMoreOptionsSheet, setShowMoreOptionsSheet] = useState(false);

  // Double-tap seek visual feedback
  const [seekFeedback, setSeekFeedback] = useState<{
    dir: "back" | "forward";
    id: number;
  } | null>(null);
  const seekFeedbackAnim = useRef(new Animated.Value(0)).current;
  const seekFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [showHdLockModal, setShowHdLockModal] = useState(false);
  const [showArtistLockModal, setShowArtistLockModal] = useState<{
    visible: boolean;
    video: VideoCard | null;
  }>({
    visible: false,
    video: null,
  });

  const [showMini, setShowMini] = useState(false);
  const scrollYRef = useRef(0);
  const deepScrollRef = useRef(false);

  useEffect(() => {
    (async () => {
      const res = await userService.checkStreamingQuality();
      const maxRes = (
        res?.maxResolution ?? "240p"
      ).toString() as streamService.VideoQuality;
      setMaxAllowedResolution(maxRes);
      setIsStreamingHdAllowed(res?.quality === "HD");

      // If user is not allowed HD, ensure UI doesn't get stuck in an HD selection.
      if (res?.quality !== "HD") {
        setSelectedQuality((prev) => {
          if (prev === "720p" || prev === "1080p" || prev === "Auto")
            return "240p";
          return prev;
        });
        setIsHD(false);
      }
    })().catch(() => {
      setMaxAllowedResolution("240p");
      setIsStreamingHdAllowed(false);
      setSelectedQuality("240p");
      setIsHD(false);
    });
  }, []);

  // Auto-detect orientation changes and update fullscreen state
  useEffect(() => {
    // Only respond to orientation changes when video is active and not manually controlled
    if (!activePlaybackUrl) return;

    // Sync fullscreen state with actual orientation
    // This handles the case when user physically rotates device
    if (isLandscape !== isFullscreen) {
      setIsFullscreen(isLandscape);
    }
  }, [isLandscape, activePlaybackUrl, isFullscreen]);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportedContentIds, setReportedContentIds] = useState<
    Record<string, boolean>
  >({});

  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState(
    HEADER_HEIGHT + 60
  );
  const headerHeightRef = useRef<number>(HEADER_HEIGHT + 60);
  const hasMeasuredHeaderRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VideoCard[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRequestIdRef = useRef(0);

  const listRef = useRef<FlatList<VideoCard> | null>(null);
  const userPausedRef = useRef<boolean>(false); // Track if user explicitly paused

  const safePlay = useCallback((target: { play?: () => any; playing?: boolean } | null | undefined, tag: string) => {
    console.log(`[VideoPlayer:NATIVE] safePlay(${tag}) called, target exists:`, Boolean(target), "playing:", target?.playing);
    if (!target || typeof target.play !== "function") return;
    if (target.playing) {
      console.log(`[VideoPlayer:NATIVE] safePlay(${tag}) skipped - already playing`);
      return;
    }
    try {
      console.log(`[VideoPlayer:NATIVE] safePlay(${tag}) calling target.play()...`);
      const maybePromise = target.play();
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise
          .then((res: any) => {
            console.log(`[VideoPlayer:NATIVE] safePlay(${tag}) target.play() Promise resolved, res:`, res);
          })
          .catch((err: any) => {
            const name = (err?.name || "").toString();
            const msg = (err?.message || "").toString();
            if (
              name === "AbortError" ||
              /interrupted by a call to pause\(\)/i.test(msg)
            )
              return;
            console.error(`[VideoPlayer:NATIVE] safePlay(${tag}) target.play() rejected:`, {
              name: err?.name,
              message: err?.message,
              stack: err?.stack,
              cause: err?.cause,
            });
          });
      } else {
        console.log(`[VideoPlayer:NATIVE] safePlay(${tag}) target.play() synchronous result:`, maybePromise);
      }
    } catch (err: any) {
      console.error(`[VideoPlayer:NATIVE] safePlay(${tag}) synchronous throw:`, {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        cause: err?.cause,
      });
    }
  }, []);

  const [videoPlayer, setVideoPlayer] = useState<VideoPlayer | null>(null);
  const playerRef = useRef<VideoPlayer | null>(null);

  const initializeOrUpdatePlayer = useCallback(
    (url: string) => {
      if (!url) return;
      if (AppState.currentState !== "active") {
        console.log("[VideoScreen] App state is not active, deferring VideoPlayer creation");
        return;
      }
      try {
        const isHls =
          url.includes("kind=video") ||
          url.includes("/media/stream/") ||
          url.includes(".m3u8");
        const videoSource: VideoSource = {
          uri: url,
          contentType: isHls ? "hls" : "auto",
        };
        if (!playerRef.current) {
          const sanitizedUrl = url.includes("?")
            ? `${new URL(url).origin}${new URL(url).pathname}?[token-redacted]`
            : url;
          console.log("[VideoScreen] Creating VideoPlayer with URL:", sanitizedUrl, "contentType:", videoSource.contentType);
          const player = createVideoPlayer(videoSource);
          player.loop = false;
          player.timeUpdateEventInterval = 0.5;
          player.staysActiveInBackground = true;
          playerRef.current = player;
          setVideoPlayer(player);
          if (!userPausedRef.current) {
            console.log("[VideoScreen] Auto-playing on init with valid URL");
            safePlay(player as any, "init");
          }
        } else {
          const sanitizedUrl = url.includes("?")
            ? `${new URL(url).origin}${new URL(url).pathname}?[token-redacted]`
            : url;
          console.log("[VideoScreen] Updating VideoPlayer source:", sanitizedUrl, "contentType:", videoSource.contentType);
          playerRef.current.replace(videoSource);
          if (!userPausedRef.current) {
            safePlay(playerRef.current as any, "replace");
          }
        }
      } catch (err) {
        console.error("[VideoScreen] Error creating or updating VideoPlayer", err);
      }
    },
    [safePlay]
  );

  useEffect(() => {
    if (activePlaybackUrl) {
      initializeOrUpdatePlayer(activePlaybackUrl);
    } else if (playerRef.current) {
      try {
        playerRef.current.pause();
      } catch {}
    }
  }, [activePlaybackUrl, initializeOrUpdatePlayer]);

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.pause();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);
  const lastTapRef = useRef(0);
  const lastTapXRef = useRef(0);
  const playbackSessionRef = useRef(0);
  const qualityAccessGenerationRef = useRef(0);

  const [bgAudioOnlyMode, setBgAudioOnlyMode] = useState(false);
  const bgWasPlayingRef = useRef(false);

  const IOS_INTERRUPTION_DO_NOT_MIX = 1;
  const ANDROID_INTERRUPTION_DUCK_OTHERS = 1;

  const resumeAfterUrlChangeRef = useRef<number | null>(null);
  const qualityResumePositionRef = useRef<number | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const shimmerX = useRef(new Animated.Value(0)).current;

  const miniAnim = useRef(new Animated.Value(0)).current;

  const onHeaderLayout = useCallback((e: LayoutChangeEvent) => {
    const h = Math.max(0, Math.round(e.nativeEvent.layout.height));
    if (h <= 0) return;

    const prev = headerHeightRef.current;
    // Allow height changes but avoid tiny sub-pixel feedback loops.
    if (Math.abs(prev - h) < 8) return;

    headerHeightRef.current = h;
    setMeasuredHeaderHeight(h);
  }, []);

  useEffect(() => {
    // Reset throttling/duration once per playback source.
    lastStatusPositionRef.current = 0;
    lastStatusDurationRef.current = 0;
    durationSetForUrlRef.current = activePlaybackUrl ?? null;

    // For quality switches, do NOT reset position — we want to resume.
    // isQualitySwitchRef is set to true by applyQualitySelection before URL change.
    if (isQualitySwitchRef.current) {
      // Leave positionMs / durationMs as-is so the slider doesn't flash to 0.
      isQualitySwitchRef.current = false;
      return;
    }

    // Full video switch: reset to 0:00.
    setPositionMs(0);
    setDurationMs(0);
    seekValueRef.current = 0;
    playedOnceRef.current = false;
  }, [activePlaybackUrl]);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }
    const sub = AppState.addEventListener("change", (next) => {
      console.log("App state changed to:", next);
      if (!activePlaybackUrl) return;

      const shouldBackground = next === "inactive" || next === "background";
      if (shouldBackground) {
        if (bgAudioOnlyMode) return;

        (async () => {
          const wasPlaying = playerRef.current?.playing ?? false;
          bgWasPlayingRef.current = wasPlaying;
          setBgAudioOnlyMode(true);

          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: "doNotMix",
          });

          // Keep volume at 1.0 and force resume during the transition.
          try {
            if (playerRef.current) playerRef.current.volume = 1.0;
          } catch {
            // ignore
          }
          if (wasPlaying && playerRef.current) {
            safePlay(playerRef.current as any, "appstate-background");
          }
        })().catch(() => undefined);

        return;
      }

      if (next === "active") {
        if (!playerRef.current) {
          initializeOrUpdatePlayer(activePlaybackUrl);
        }
        if (bgAudioOnlyMode) {
          setBgAudioOnlyMode(false);
          const shouldPlay = bgWasPlayingRef.current;
          (async () => {
            try {
              if (playerRef.current) playerRef.current.volume = 1.0;
            } catch {
              // ignore
            }
            if (shouldPlay && playerRef.current) {
              safePlay(playerRef.current as any, "appstate-active");
            }
          })().catch(() => undefined);
        }
      }
    });

    return () => {
      sub.remove();
    };
  }, [
    activePlaybackUrl,
    activeVideoMeta?.id,
    bgAudioOnlyMode,
    safePlay,
    initializeOrUpdatePlayer,
  ]);

  const scheduleTokenRefresh = useCallback(
    (url: string | null) => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }

      const expMs = decodeJwtExpMsFromUrl(url);
      if (!expMs) return;

      // Refresh 60s before expiry for better safety (min 10s delay).
      const now = Date.now();
      const delay = Math.max(10000, expMs - now - 60_000);
      console.log(
        "[VideoScreen] Scheduling token refresh in",
        Math.round(delay / 1000),
        "s"
      );

      tokenRefreshTimerRef.current = setTimeout(() => {
        (async () => {
          if (!activeVideoMeta?.id) return;
          const pos = Math.max(0, Math.round((playerRef.current?.currentTime ?? videoPlayer?.currentTime ?? 0) * 1000));

          console.log("[VideoScreen] Background refreshing video URL...");
          try {
            // Use current selected quality for refresh, respecting subscription
            const refreshQuality: streamService.VideoQuality =
              isStreamingHdAllowed
                ? (selectedQuality as streamService.VideoQuality)
                : "240p";
            const sessionId = playbackSessionRef.current;
            const qualityGeneration = qualityAccessGenerationRef.current;
            const isStillRelevant = () =>
              sessionId === playbackSessionRef.current &&
              qualityGeneration === qualityAccessGenerationRef.current;
            const nextUrl = await streamService.getPlaybackUrl(
              activeVideoMeta.id,
              "video",
              refreshQuality,
              { isStillRelevant }
            );
            if (!isStillRelevant()) return;
            resumeAfterUrlChangeRef.current = pos;
            setActivePlaybackUrl(nextUrl);
          } catch {
            // ignore
          }
        })().catch(() => undefined);
      }, delay);
    },
    [activeVideoMeta?.id, isStreamingHdAllowed, selectedQuality]
  );

  useEffect(() => {
    scheduleTokenRefresh(activePlaybackUrl);
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
    };
  }, [activePlaybackUrl, scheduleTokenRefresh]);

  const hasPlaybackStarted = Boolean(activePlaybackUrl);

  const fetchAll = useCallback(async () => {
    const res = await apiV1.get(`/content?ts=${Date.now()}`, {
      params: { mediaType: "video" },
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
    const raw: ApiContentItem[] = Array.isArray(res.data?.items)
      ? res.data.items
      : [];

    const mapped: VideoCard[] = raw
      .map((it) => {
        const mediaTypeRaw = (it.mediaType ?? it.type ?? "")
          .toString()
          .toLowerCase();
        const mediaType = mediaTypeRaw.includes("video") ? "video" : "audio";
        if (mediaType !== "video") return null;

        const artistIdValue =
          it.artistId !== null && it.artistId !== undefined
            ? String(it.artistId)
            : undefined;

        const rawArtistProfileImage =
          it.artistProfileImage ??
          (it as any).artistProfileImageUrl ??
          (it as any).artist?.profileImageUrl ??
          (it as any).artist?.avatar ??
          (it as any).artist_profile_image_url ??
          (artistIdValue ? `/api/v1/artist/assets/${artistIdValue}/profile` : "");

        const artistProfileImage = rawArtistProfileImage
          ? resolveAppImageUrl(rawArtistProfileImage, "artist")
          : undefined;

        const rawArtwork = it.thumbnailUrl ?? it.artwork;
        const artworkUrl = rawArtwork
          ? resolveAppImageUrl(rawArtwork, "video")
          : FALLBACK_ARTWORK;
        return {
          id: String(it.id),
          title: (it.title ?? "Untitled").toString(),
          artistName: (it.artistName ?? "Artist").toString(),
          artistId: artistIdValue,
          artistProfileImage,
          artworkUrl,
          mediaUrl: (it.mediaUrl ?? it.fileUrl ?? "").toString(),
          useStreamAccess: Boolean(
            it.useStreamAccess ?? it.storage_provider === "cloudinary"
          ),
          storageKey: (it.storageKey ?? null) as any,
          category: normalizeCategory(it.genre),
          createdAt: (it.createdAt ?? null) as any,
          viewCount: (toCount(it.viewCount) ?? toCount(it.views) ?? 0) as any,
          likeCount: (toCount(it.likeCount) ?? 0) as any,
          dislikeCount: (toCount(it.dislikeCount) ?? 0) as any,
          userReaction: (it.userReaction ?? null) as any,
          isLocked: Boolean(it.isLocked || it.locked),
        };
      })
      .filter(Boolean) as VideoCard[];

    return mapped;
  }, []);

  const normalizedQuery = useMemo(
    () => searchQuery.trim().toLowerCase(),
    [searchQuery]
  );

  const normalizeForSearch = useCallback((s: string) => {
    return (s ?? "")
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const matchesQuery = useCallback(
    (it: VideoCard, q: string) => {
      if (!q) return true;
      const hayRaw = `${it.title ?? ""} ${it.artistName ?? ""} ${
        it.category ?? ""
      }`;
      const hay = normalizeForSearch(hayRaw);
      const qq = normalizeForSearch(q);
      if (!qq) return true;

      const tokens = qq.split(" ").filter(Boolean);
      if (!tokens.length) return true;
      return tokens.every((t) => hay.includes(t));
    },
    [normalizeForSearch]
  );

  useEffect(() => {
    // Real-time (debounced) search that always hits the backend with mediaType=video.
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
          const videos = await fetchAll();
          if (requestId !== searchRequestIdRef.current) return;
          const filtered = videos.filter((v) => matchesQuery(v, q));
          setSearchResults(filtered);
        } catch {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchResults([]);
        } finally {
          if (requestId !== searchRequestIdRef.current) return;
          setSearchLoading(false);
        }
      })().catch(() => undefined);
    }, 350);

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    };
  }, [fetchAll, matchesQuery, normalizedQuery]);

  const enterFullscreen = useCallback(async () => {
    setIsFullscreen(true);
    // Lock to landscape when entering fullscreen
    if (Platform.OS !== "web") {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch (err) {}
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    setIsFullscreen(false);
    // Lock back to portrait when exiting fullscreen
    if (Platform.OS !== "web") {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT
        );
      } catch (err) {}
    }
  }, []);

  const stopAndReset = useCallback(async () => {
    playbackSessionRef.current += 1;
    qualityAccessGenerationRef.current += 1;
    try {
      videoPlayer?.pause();
      if (videoPlayer) {
        videoPlayer.seekBy(-videoPlayer.currentTime);
      }
    } finally {
      setActiveVideoId(null);
      setActiveVideoMeta(null);
      setActivePlaybackUrl(null);
      setIsVideoReady(false);
      setIsVideoPlaying(false);
      setPositionMs(0);
      setDurationMs(0);
      setShowUpNext(false);
      setUpNextSeconds(3);
      setShowControls(true);
      playedOnceRef.current = false;
      setShowQualitySheet(false);
      setShowSpeedSheet(false);
      setShowMoreOptionsSheet(false);
      syncActiveMediaItem?.(null, false);
      setInlineVideoHostActive(false);
    }
  }, [videoPlayer, syncActiveMediaItem, setInlineVideoHostActive]);

  const applyPlaybackSpeed = useCallback(
    (speed: number) => {
      setSelectedSpeed(speed);
      selectedSpeedRef.current = speed;
      setShowSpeedSheet(false);
      setShowMoreOptionsSheet(false);
      try {
        if (videoPlayer) {
          videoPlayer.playbackRate = speed;
        }
      } catch (e) {
        console.warn("[VideoScreen] Failed to set playback rate", e);
      }
    },
    [videoPlayer]
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        if (videoPlayer) {
          videoPlayer.muted = next;
        }
      } catch (e) {
        console.warn("[VideoScreen] Failed to toggle mute", e);
      }
      return next;
    });
  }, [videoPlayer]);

  const triggerSeekFeedback = useCallback(
    (dir: "back" | "forward") => {
      if (seekFeedbackTimerRef.current) {
        clearTimeout(seekFeedbackTimerRef.current);
      }
      setSeekFeedback({ dir, id: Date.now() });
      seekFeedbackAnim.setValue(0);
      Animated.timing(seekFeedbackAnim, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }).start(() => {
        setSeekFeedback(null);
      });
    },
    [seekFeedbackAnim]
  );

  const startLongPress2x = useCallback(() => {
    if (!isVideoPlaying || !videoPlayer) return;
    setIsHolding2x(true);
    try {
      videoPlayer.playbackRate = 2.0;
    } catch {}
  }, [isVideoPlaying, videoPlayer]);

  const endLongPress2x = useCallback(() => {
    if (holding2xTimerRef.current) {
      clearTimeout(holding2xTimerRef.current);
      holding2xTimerRef.current = null;
    }
    if (isHolding2x) {
      setIsHolding2x(false);
      try {
        if (videoPlayer) {
          videoPlayer.playbackRate = selectedSpeedRef.current;
        }
      } catch {}
    }
  }, [isHolding2x, videoPlayer]);

  const handlePlayerPressIn = useCallback(() => {
    if (holding2xTimerRef.current) clearTimeout(holding2xTimerRef.current);
    holding2xTimerRef.current = setTimeout(() => {
      startLongPress2x();
    }, 280);
  }, [startLongPress2x]);

  const handlePlayerPressOut = useCallback(() => {
    if (holding2xTimerRef.current) {
      clearTimeout(holding2xTimerRef.current);
      holding2xTimerRef.current = null;
    }
    endLongPress2x();
  }, [endLongPress2x]);

  useEffect(() => {
    const onBackPress = () => {
      if (isFullscreen) {
        exitFullscreen();
        return true;
      }
      if (showQualitySheet) {
        setShowQualitySheet(false);
        return true;
      }
      if (showSpeedSheet) {
        setShowSpeedSheet(false);
        return true;
      }
      if (showMoreOptionsSheet) {
        setShowMoreOptionsSheet(false);
        return true;
      }
      if (activePlaybackUrl) {
        stopAndReset();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [
    isFullscreen,
    exitFullscreen,
    showQualitySheet,
    showSpeedSheet,
    showMoreOptionsSheet,
    activePlaybackUrl,
    stopAndReset,
  ]);

  const onSeekStart = useCallback(() => {
    setIsSeeking(true);
    seekValueRef.current = positionMs;
  }, [positionMs]);

  const onSeekChange = useCallback((value: number) => {
    seekValueRef.current = value;
    setPositionMs(Math.max(0, Math.round(value)));
  }, []);

  const onSeekComplete = useCallback(
    async (value: number) => {
      setIsSeeking(false);
      try {
        const targetSeconds = value / 1000;
        const currentSeconds = videoPlayer?.currentTime ?? 0;
        const deltaSeconds = targetSeconds - currentSeconds;

        // Use seekBy for better Android compatibility
        videoPlayer?.seekBy(deltaSeconds);

        // Resume playback after seek on Android with a small delay
        if (isVideoPlaying && videoPlayer) {
          if (Platform.OS === "android") {
            setTimeout(() => {
              safePlay(videoPlayer as any, "slider-seek");
            }, 50);
          } else {
            safePlay(videoPlayer as any, "slider-seek");
          }
        }
      } catch (e) {
        console.log("SLIDER SEEK ERROR", e);
      }
    },
    [videoPlayer, isVideoPlaying, safePlay]
  );

  const load = useCallback(
    async (opts?: { refresh?: boolean }) => {
      const isRefresh = Boolean(opts?.refresh);
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setFetchError(null);

        const next = await fetchAll();
        setItems(next);
      } catch (err: any) {
        setItems([]);
        const normalized = normalizeApiError(err);
        setFetchError(normalized.message || "Couldn't load videos");
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

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(REPORTED_CONTENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const ids = Array.isArray(parsed)
          ? (parsed as any[]).map((x) => String(x))
          : [];
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

  const trending = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
      const tb = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
      return tb - ta;
    });
  }, [items]);

  const visibleItems = useMemo(() => {
    if (normalizedQuery) return searchResults ?? [];
    return trending;
  }, [normalizedQuery, searchResults, trending]);

  const pauseGlobalAudioIfNeeded = useCallback(async () => {
    if (currentItem?.mediaType !== "audio") return;
    if (!playerState.isPlaying) return;
    try {
      await togglePlayPause();
    } catch {
      // ignore
    }
  }, [currentItem?.mediaType, playerState.isPlaying, togglePlayPause]);

  const pauseGlobalPlaybackIfNeeded = useCallback(async () => {
    if (!playerState.isPlaying) return;
    try {
      await togglePlayPause();
    } catch {
      // ignore
    }
  }, [playerState.isPlaying, togglePlayPause]);

  const pauseInlineVideoIfNeeded = useCallback(async () => {
    try {
      if (videoPlayer?.playing) {
        videoPlayer.pause();
      }
    } catch {
      // ignore
    }
  }, [videoPlayer]);

  // ─── Native event: status change ───────────────────────────────────────────
  // This fires as soon as the player's native layer transitions state.
  // We use it for the quality-switch seek so it is truly atomic — no setTimeout.
  useEffect(() => {
    if (!videoPlayer) return;

    const statusSub = videoPlayer.addListener(
      "statusChange",
      (event: any) => {
        const status = event.status;
        const error = event.error;
        console.log(
          `[VideoPlayer:NATIVE] statusChange: status=${status}, playing=${videoPlayer.playing}, currentTime=${videoPlayer.currentTime}, duration=${videoPlayer.duration}`,
          error ? `error=${JSON.stringify(error)}` : ""
        );
        setIsVideoReady(status === "readyToPlay");
        setIsBuffering(status === "loading");

        if (status === "readyToPlay") {
          console.log("[VideoPlayer:NATIVE] Status is readyToPlay, checking auto-play intent. userPaused:", userPausedRef.current, "playing:", videoPlayer.playing);
          if (qualityResumePositionRef.current !== null) {
            const targetSeconds = qualityResumePositionRef.current;
            qualityResumePositionRef.current = null;
            try {
              videoPlayer.currentTime = targetSeconds;
              console.log("[VideoPlayer:NATIVE] Quality resume seek to", targetSeconds);
              safePlay(videoPlayer as any, "status-ready-quality");
            } catch (e) {
              console.error("[VideoPlayer:NATIVE] Quality resume seek failed", e);
            }
          } else if (!userPausedRef.current && !videoPlayer.playing) {
            console.log("[VideoPlayer:NATIVE] Calling safePlay for readyToPlay");
            safePlay(videoPlayer as any, "status-readyToPlay");
          }
        } else if (status === "error" || status === "failed") {
          console.error("[VideoPlayer:NATIVE] Playback failed with error:", error);
          setPlaybackError(error?.message || "Playback failed");
        }
      }
    );

    const playingSub = videoPlayer.addListener(
      "playingChange",
      (event: any) => {
        const isPlaying = Boolean(event.isPlaying);
        console.log(`[VideoPlayer:NATIVE] playingChange: isPlaying=${isPlaying}, currentTime=${videoPlayer.currentTime}`);
        setIsVideoPlaying(isPlaying);
      }
    );

    const timeSub = videoPlayer.addListener(
      "timeUpdate",
      (event: any) => {
        const curMs = Math.round(Number(event.currentTime || 0) * 1000);
        console.log(`[VideoPlayer:NATIVE] timeUpdate: currentTime=${event.currentTime}s, duration=${videoPlayer.duration}s`);
        if (!isSeeking) {
          setPositionMs(curMs);
        }
        if (videoPlayer.duration && videoPlayer.duration > 0) {
          setDurationMs(Math.round(videoPlayer.duration * 1000));
        }
      }
    );

    return () => {
      statusSub.remove();
      playingSub.remove();
      timeSub.remove();
    };
  }, [
    videoPlayer,
    activePlaybackUrl,
    activeVideoMeta?.id,
    isStreamingHdAllowed,
    selectedQuality,
    safePlay,
    isSeeking,
  ]);

  // ─── 500ms polling for position / duration / sync ───────────────────────────
  useEffect(() => {
    if (!videoPlayer) {
      setIsVideoPlaying(false);
      setIsBuffering(false);
      setIsVideoReady(false);
      return;
    }
    const interval = setInterval(() => {
      if (!isSeeking) {
        const curMs = toFiniteDurationMs(videoPlayer.currentTime * 1000);
        setPositionMs(curMs);
        if (activeVideoMeta) {
          syncActiveMediaItem?.(
            {
              id: String(activeVideoMeta.id),
              contentId: String(activeVideoMeta.id),
              title: activeVideoMeta.title,
              artistName: activeVideoMeta.artistName,
              artistId: activeVideoMeta.artistId,
              mediaType: "video",
              artworkUrl: activeVideoMeta.artworkUrl,
              mediaUrl: activePlaybackUrl,
              useStreamAccess: activeVideoMeta.useStreamAccess,
              duration: videoPlayer.duration
                ? Math.round(videoPlayer.duration * 1000)
                : undefined,
            },
            videoPlayer.playing,
            curMs,
            toFiniteDurationMs(videoPlayer.duration * 1000)
          );
        }
      }
      setDurationMs(toFiniteDurationMs(videoPlayer.duration * 1000));
      setIsBuffering(videoPlayer.status === "loading");
      setIsVideoReady(videoPlayer.status === "readyToPlay");

      // Handle finished with autoplay check
      if (
        isAutoplayEnabled &&
        videoPlayer.duration > 0 &&
        videoPlayer.currentTime >= videoPlayer.duration - 0.2 &&
        videoPlayer.playing === false &&
        isVideoPlaying
      ) {
        setShowUpNext(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [
    videoPlayer,
    isSeeking,
    isAutoplayEnabled,
    activeVideoMeta,
    activePlaybackUrl,
    syncActiveMediaItem,
    isVideoPlaying,
  ]);

  useEffect(() => {
    // Pause inline video if global audio starts playing.
    if (currentItem?.mediaType === "audio" && playerState.isPlaying) {
      pauseInlineVideoIfNeeded().catch(() => undefined);
    }
  }, [currentItem?.mediaType, pauseInlineVideoIfNeeded, playerState.isPlaying]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      // Avoid fighting with the background audio-only handler for active video sessions.
      if (s !== "active" && !activePlaybackUrl) {
        pauseInlineVideoIfNeeded().catch(() => undefined);
      }
    });
    return () => {
      sub.remove();
    };
  }, [activePlaybackUrl, pauseInlineVideoIfNeeded]);

  const resolvePlaybackUrl = useCallback(
    async (video: VideoCard, sessionId: number) => {
      try {
        const q: streamService.VideoQuality =
          selectedQuality && selectedQuality !== "Auto"
            ? selectedQuality
            : "Auto";
        const isStillRelevant = () =>
          sessionId === playbackSessionRef.current;
        return await streamService.getPlaybackUrl(
          video.id,
          "video",
          q,
          { isStillRelevant }
        );
      } catch (err: any) {
        if (err?.code === "PLAYBACK_REQUEST_SUPERSEDED") {
          throw err;
        }
        if (
          err?.message &&
          (err.message.toLowerCase().includes("subscription") ||
            err.message.toLowerCase().includes("access denied"))
        ) {
          throw err; // Propagate subscription errors for UI handling
        }
        const fallback = video.mediaUrl
          ? streamService.normalizePlaybackUrl(video.mediaUrl)
          : "";
        if (!fallback) return "";
        return streamService.validatePlaybackUrl(fallback, "video")
          ? fallback
          : "";
      }
    },
    [isStreamingHdAllowed]
  );

  const onPressVideo = useCallback(
    (video: VideoCard) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      (async () => {
        const sessionId = (playbackSessionRef.current += 1);

        setShowUpNext(false);
        setUpNextSeconds(5);
        if (upNextTimerRef.current) {
          clearInterval(upNextTimerRef.current);
          upNextTimerRef.current = null;
        }

        // Ensure a new selection always starts from 0:00
        lastStatusPositionRef.current = 0;
        lastStatusDurationRef.current = 0;
        durationSetForUrlRef.current = null;
        setPositionMs(0);
        setDurationMs(0);
        seekValueRef.current = 0;
        setIsVideoReady(false);
        setIsBuffering(true);

        setActiveVideoId(video.id);
        setActiveVideoMeta(video);

        userPausedRef.current = false; // Reset for new video
        playedOnceRef.current = false;
        setShowControls(true);
        setPlaybackError(null);

        // Stop/unload any previous inline video
        await pauseGlobalPlaybackIfNeeded();
        if (playerRef.current) {
          try {
            playerRef.current.pause();
          } catch {}
        }

        setLoadingPlaybackUrl(true);
        try {
          // PROACTIVE CHECK: Check if content is locked before even hitting the stream service
          const accessRes = await userService.checkContentAccess(
            Number(video.id),
            video.artistId || ""
          );

          if (!accessRes.allowed) {
            setLastAttemptedVideo(video);
            setShowArtistLockModal({ visible: true, video });
            setPlaybackError("Subscription Required");
            setActivePlaybackUrl(null);
            setLoadingPlaybackUrl(false);
            return;
          }

          const rawPlaybackUrl = await resolvePlaybackUrl(video, sessionId);
          const playbackUrl = streamService.normalizePlaybackUrl(rawPlaybackUrl);

          if (sessionId !== playbackSessionRef.current) return;
          if (!streamService.validatePlaybackUrl(playbackUrl, "video")) {
            setPlaybackError("Invalid playback source");
            setActivePlaybackUrl(null);
            return;
          }

          setActivePlaybackUrl(playbackUrl);
          setIsVideoReady(false);
          setIsVideoPlaying(true);

          syncActiveMediaItem?.(
            {
              id: String(video.id),
              contentId: String(video.id),
              title: video.title,
              artistName: video.artistName,
              artistId: video.artistId,
              mediaType: "video",
              artworkUrl: video.artworkUrl,
              mediaUrl: playbackUrl,
              useStreamAccess: video.useStreamAccess,
              duration: durationMs || undefined,
            },
            true,
            0,
            durationMs
          );
          setInlineVideoHostActive(true);

          await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: true,
            interruptionMode: "doNotMix",
          });

          console.log("[VideoScreen] Playback URL set, attempting to play (token redacted):", playbackUrl ? `${new URL(playbackUrl).origin}${new URL(playbackUrl).pathname}?kind=...&quality=...` : "null");

          // Explicitly start playback after URL is set
          setTimeout(() => {
            const targetPlayer = playerRef.current || videoPlayer;
            if (targetPlayer && sessionId === playbackSessionRef.current) {
              console.log("[VideoScreen] Calling safePlay after URL set");
              safePlay(targetPlayer as any, "onPressVideo");
            } else {
              console.log("[VideoScreen] safePlay skipped - session mismatch or no player");
            }
          }, 100);
        } catch (err: any) {
          if (
            sessionId !== playbackSessionRef.current ||
            err?.code === "PLAYBACK_REQUEST_SUPERSEDED"
          ) {
            return;
          }
          const msg = (err?.message || "").toLowerCase();
          if (msg.includes("subscription") || msg.includes("access denied")) {
            setLastAttemptedVideo(video);
            setShowArtistLockModal({ visible: true, video });
            setPlaybackError("Subscription Required");
            setActivePlaybackUrl(null);
            return;
          }
          console.warn("[VideoPlayer] Playback error", err);
          setPlaybackError("Could not load playback URL");
          setActivePlaybackUrl(null);
        } finally {
          if (sessionId === playbackSessionRef.current) {
            setLoadingPlaybackUrl(false);
          }
        }
      })().catch(() => undefined);
    },
    [
      durationMs,
      pauseGlobalPlaybackIfNeeded,
      resolvePlaybackUrl,
      safePlay,
      setInlineVideoHostActive,
      syncActiveMediaItem,
      videoPlayer,
    ]
  );

  const refreshSubscriptionAndRetry = useCallback(async () => {
    try {
      const res = await userService.checkStreamingQuality();
      const maxRes = (
        res?.maxResolution ?? "240p"
      ).toString() as streamService.VideoQuality;
      const isAllowedHD = res?.quality === "HD";

      setMaxAllowedResolution(maxRes);
      setIsStreamingHdAllowed(isAllowedHD);

      // If we just got unlocked (e.g. from Platform purchase)
      if (route.params?.unlocked) {
        // Clear the param so we don't loop
        navigation.setParams({ unlocked: false });

        // 1. Dismiss all lock modals
        setShowHdLockModal(false);
        setShowArtistLockModal({ visible: false, video: null });

        // 2. Resolve 'HD' upgrade if it was pending
        if (isAllowedHD && lastAttemptedHdQuality) {
          const q = lastAttemptedHdQuality;
          setLastAttemptedHdQuality(null);
          // Auto-apply the quality
          setSelectedQuality(q as streamService.VideoQuality);
          const pos = Math.max(0, Math.round(videoPlayer.currentTime * 1000));
          if (activeVideoMeta?.id) {
            const sessionId = playbackSessionRef.current;
            const qualityGeneration =
              qualityAccessGenerationRef.current + 1;
            qualityAccessGenerationRef.current = qualityGeneration;
            const isStillRelevant = () =>
              sessionId === playbackSessionRef.current &&
              qualityGeneration === qualityAccessGenerationRef.current;

            setLoadingPlaybackUrl(true);
            try {
              // Use the pending quality directly - backend will enforce subscription
              const qParam: streamService.VideoQuality =
                getStreamQualityParam(q);
              const nextUrl = await streamService.getPlaybackUrl(
                activeVideoMeta.id,
                "video",
                qParam,
                { isStillRelevant }
              );
              if (!isStillRelevant()) return;
              isQualitySwitchRef.current = true;
              qualityResumePositionRef.current = pos / 1000;
              setActivePlaybackUrl(nextUrl);
            } catch (e: any) {
              if (
                isStillRelevant() &&
                e?.code !== "PLAYBACK_REQUEST_SUPERSEDED"
              ) {
                console.warn("[VideoScreen] Auto-retry quality switch failed", e);
              }
            } finally {
              if (isStillRelevant()) {
                setLoadingPlaybackUrl(false);
              }
            }
          }
        }

        // 3. Resolve 'Artist' content if it was blocked
        if (lastAttemptedVideo) {
          const v = lastAttemptedVideo;
          setLastAttemptedVideo(null);
          onPressVideo(v);
        }
      }
    } catch (e) {
      console.warn("[VideoScreen] Failed to refresh subscription status", e);
    }
  }, [
    route.params?.unlocked,
    navigation,
    lastAttemptedHdQuality,
    lastAttemptedVideo,
    videoPlayer,
    activeVideoMeta,
    onPressVideo,
  ]);

  useFocusEffect(
    useCallback(() => {
      setInlineVideoHostActive(true);
      refreshSubscriptionAndRetry();
      load().catch(() => undefined);

      return () => {
        setInlineVideoHostActive(false);
      };
    }, [load, refreshSubscriptionAndRetry, setInlineVideoHostActive])
  );

  useEffect(() => {
    if (route.params?.resumeVideoId) {
      const resumeId = String(route.params.resumeVideoId);
      navigation.setParams({ resumeVideoId: undefined });
      if (currentItem && String(currentItem.id) === resumeId) {
        if (activeVideoId !== resumeId && currentItem.mediaUrl) {
          setActiveVideoId(resumeId);
          setActiveVideoMeta({
            id: resumeId,
            title: currentItem.title,
            artistName: currentItem.artistName ?? "Artist",
            artistId: currentItem.artistId ? String(currentItem.artistId) : undefined,
            artworkUrl: currentItem.artworkUrl ?? FALLBACK_ARTWORK,
            mediaUrl: currentItem.mediaUrl,
            category: "Trending",
          });
          setActivePlaybackUrl(currentItem.mediaUrl);
          if (playerState.positionMs > 0) {
            qualityResumePositionRef.current = playerState.positionMs / 1000;
          }
        }
      }
    }
  }, [
    route.params?.resumeVideoId,
    currentItem,
    activeVideoId,
    navigation,
    playerState.positionMs,
  ]);

  useEffect(() => {
    if (route.params?.autoplayVideo) {
      const vid = route.params.autoplayVideo;
      if (activeVideoId !== String(vid.id)) {
        onPressVideo(vid);
        navigation.setParams({ autoplayVideo: undefined });
      }
    }
  }, [route.params?.autoplayVideo, activeVideoId, navigation, onPressVideo]);

  const currentIndex = useMemo(() => {
    if (!activeVideoId) return -1;
    return visibleItems.findIndex((x) => x.id === activeVideoId);
  }, [activeVideoId, visibleItems]);

  const playNextPrev = useCallback(
    (dir: "next" | "prev") => {
      if (!visibleItems.length) return;
      const idx = currentIndex;
      if (idx < 0) return;
      const nextIdx = dir === "next" ? idx + 1 : idx - 1;
      const next = visibleItems[clamp(nextIdx, 0, visibleItems.length - 1)];
      if (next && next.id !== activeVideoId) onPressVideo(next);
    },
    [activeVideoId, currentIndex, onPressVideo, visibleItems]
  );

  const panResponder = useMemo(() => {
    return PanResponder.create({
      // Swipe gestures no longer change video — double-tap left/right seeks ±10s instead.
      onMoveShouldSetPanResponder: () => false,
      onPanResponderRelease: () => {},
    });
  }, []);

  useEffect(() => {
    if (!activePlaybackUrl) return;
    if (controlsHideTimerRef.current) {
      clearTimeout(controlsHideTimerRef.current);
      controlsHideTimerRef.current = null;
    }
  }, [activePlaybackUrl]);

  useEffect(() => {
    return () => {
      if (controlsHideTimerRef.current) {
        clearTimeout(controlsHideTimerRef.current);
        controlsHideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    ).start();
  }, [shimmerX]);

  const onListScroll = useCallback((e: any) => {
    const y = Math.max(0, e?.nativeEvent?.contentOffset?.y ?? 0);
    scrollYRef.current = y;
    // Player stays fixed at the top — no mini/PiP mode on scroll.
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    const tabParent: any =
      navigation.getParent?.("fan-tabs") ??
      navigation.getParent?.()?.getParent?.();
    if (!tabParent?.setOptions) return;

    tabParent.setOptions({
      tabBarStyle: { display: "none" },
    });

    return () => {
      tabParent.setOptions({ tabBarStyle: undefined });
    };
  }, [isFullscreen, navigation]);

  useEffect(() => {
    Animated.timing(miniAnim, {
      toValue: showMini ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [miniAnim, showMini]);

  const onPlaybackStatusUpdate = useCallback((status: any) => {
    if (!status.isLoaded) return;
    const pos = status.positionMillis || 0;
    setPositionMs(pos);
  }, []);

  useEffect(() => {
    if (!showUpNext) return;
    if (!activeVideoId) return;
    if (!visibleItems.length) return;

    if (upNextTimerRef.current) {
      clearInterval(upNextTimerRef.current);
      upNextTimerRef.current = null;
    }

    upNextTimerRef.current = setInterval(() => {
      setUpNextSeconds((s) => {
        const next = s - 1;
        if (next <= 0) {
          if (upNextTimerRef.current) {
            clearInterval(upNextTimerRef.current);
            upNextTimerRef.current = null;
          }

          const idx = visibleItems.findIndex((x) => x.id === activeVideoId);
          const nextItem =
            visibleItems[
              clamp(idx + 1, 0, Math.max(0, visibleItems.length - 1))
            ];
          if (nextItem && nextItem.id !== activeVideoId) {
            onPressVideo(nextItem);
          }
          return 5;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (upNextTimerRef.current) {
        clearInterval(upNextTimerRef.current);
        upNextTimerRef.current = null;
      }
    };
  }, [activeVideoId, onPressVideo, showUpNext, visibleItems]);

  const ambientColor = useMemo(() => {
    const key = `${activeVideoMeta?.id ?? ""}|${
      activeVideoMeta?.artworkUrl ?? ""
    }`;
    return hashColor(key);
  }, [activeVideoMeta?.artworkUrl, activeVideoMeta?.id]);

  // Full quality ladder — ascending order, Auto sits at the bottom.
  // These match the HLS renditions triggered in the backend eager transforms.
  const QUALITY_LADDER = [
    "144p",
    "240p",
    "360p",
    "480p",
    "720p",
    "1080p",
    "Auto",
  ] as const;

  const qualityRank = useCallback(
    (q: string) => {
      const idx = QUALITY_LADDER.findIndex((x) => x === (q as any));
      return idx >= 0 ? idx : QUALITY_LADDER.length - 1;
    },
    [QUALITY_LADDER]
  );

  const isSelectionAllowed = useCallback(
    (q: string) => {
      if (isStreamingHdAllowed) return true;
      // If user can't stream HD, only 144p and 240p are allowed.
      return q === "144p" || q === "240p";
    },
    [isStreamingHdAllowed, maxAllowedResolution, qualityRank]
  );

  const getStreamQualityParam = useCallback(
    (q: string): streamService.VideoQuality => {
      // Free users: max 240p
      if (!isStreamingHdAllowed) {
        const freeQualities: streamService.VideoQuality[] = ["144p", "240p"];
        const normalized = freeQualities.find(
          (fq) => fq.toLowerCase() === q.toLowerCase()
        );
        return normalized || "240p";
      }
      // Paid users: full access (144p-1080p + Auto)
      const validQualities: streamService.VideoQuality[] = [
        "144p",
        "240p",
        "360p",
        "480p",
        "720p",
        "1080p",
        "Auto",
      ];
      const normalized = validQualities.find(
        (vq) => vq.toLowerCase() === q.toLowerCase()
      );
      return normalized || "Auto";
    },
    [isStreamingHdAllowed]
  );

  const availableQualities = useMemo(() => {
    // Always expose the full ladder so users can always see options.
    // The HLS adaptive stream handles serving the closest available rendition.
    return [...QUALITY_LADDER];
  }, []);

  const applyQualitySelection = useCallback(
    async (q: string) => {
      if (q === selectedQuality) {
        setShowQualitySheet(false);
        return;
      }

      const isLockedQuality = q !== "144p" && q !== "240p";
      if (isLockedQuality && !isStreamingHdAllowed) {
        setLastAttemptedHdQuality(q as streamService.VideoQuality);
        setShowQualitySheet(false);
        setShowHdLockModal(true);
      } else {
        setSelectedQuality(q as streamService.VideoQuality);
        setShowQualitySheet(false);
        // Update HD badge state
        setIsHD(q === "720p" || q === "1080p");
      }
      if (!activeVideoMeta) return;

      // ── Step 1: Pause immediately & capture exact position ──────────────────
      try {
        if (playerRef.current) playerRef.current.pause();
        else if (videoPlayer) videoPlayer.pause();
      } catch {
        /* ignore */
      }
      let savedPositionSeconds = 0;
      try {
        const t = playerRef.current?.currentTime ?? videoPlayer?.currentTime ?? 0;
        if (Number.isFinite(t) && t > 0) savedPositionSeconds = t;
      } catch {
        /* player not ready — resume from 0 */
      }

      // ── Step 2: Store resume target for useEventListener to pick up ─────────
      qualityResumePositionRef.current = savedPositionSeconds;

      // ── Step 3: Flag as quality-only switch so the URL-change effect
      //           does NOT reset positionMs to 0 ──────────────────────────────
      isQualitySwitchRef.current = true;

      // ── Step 4: Show spinner while fetching the new signed URL ──────────────
      setLoadingPlaybackUrl(true);
      setIsVideoReady(false);
      setIsBuffering(true);

      const sessionId = playbackSessionRef.current;
      const qualityGeneration =
        qualityAccessGenerationRef.current + 1;
      qualityAccessGenerationRef.current = qualityGeneration;
      const isStillRelevant = () =>
        sessionId === playbackSessionRef.current &&
        qualityGeneration === qualityAccessGenerationRef.current;

      try {
        const qualityParam = getStreamQualityParam(q);
        console.log(`[VideoScreen] Quality selection: ${q} => ${qualityParam}`);
        const url = await streamService.getPlaybackUrl(
          activeVideoMeta.id,
          "video",
          qualityParam,
          { isStillRelevant }
        );
        if (!isStillRelevant()) return;
        // Setting the URL causes useVideoPlayer to reload the source.
        // useEventListener('statusChange') above will fire seek+play atomically
        // as soon as status === 'readyToPlay' — no setTimeout needed.
        setActivePlaybackUrl(url);
        setIsVideoPlaying(true);
      } catch (error: any) {
        if (
          isStillRelevant() &&
          error?.code !== "PLAYBACK_REQUEST_SUPERSEDED"
        ) {
          // Clear the pending seek only for the request that actually failed.
          qualityResumePositionRef.current = null;
          isQualitySwitchRef.current = false;
        }
      } finally {
        if (isStillRelevant()) {
          setLoadingPlaybackUrl(false);
        }
      }
    },
    [
      activeVideoMeta,
      getStreamQualityParam,
      isSelectionAllowed,
      maxAllowedResolution,
      videoPlayer,
    ]
  );

  const onDoubleTap = useCallback(
    async (dir: "back" | "forward") => {
      try {
        const v = videoPlayer;
        if (!v) return;

        triggerSeekFeedback(dir);

        const wasPlaying = v.playing;
        const current = toFiniteDurationMs(v.currentTime * 1000);
        const dur = toFiniteDurationMs(v.duration * 1000);

        const next =
          dir === "back" ? current - SEEK_DELTA_MS : current + SEEK_DELTA_MS;

        const target = clamp(next, 0, dur > 0 ? dur : Number.MAX_SAFE_INTEGER);

        // Use seekBy for better Android compatibility
        const deltaSeconds = target / 1000 - v.currentTime;
        v.seekBy(deltaSeconds);

        // Resume playback after a small delay on Android to ensure seek completes
        if (wasPlaying) {
          if (Platform.OS === "android") {
            setTimeout(() => {
              safePlay(v as any, "double-tap-seek");
            }, 50);
          } else {
            safePlay(v as any, "double-tap-seek");
          }
        }
      } catch (e) {
        console.log("SEEK ERROR", e);
      }
    },
    [safePlay, triggerSeekFeedback]
  );

  const onPressPlayerSurface = useCallback(
    async (evt: any) => {
      const x = Number(evt?.nativeEvent?.locationX ?? 0);
      const now = Date.now();
      const delta = now - lastTapRef.current;
      const lastX = lastTapXRef.current;
      lastTapRef.current = now;
      lastTapXRef.current = x;

      if (delta < DOUBLE_TAP_MS && Math.abs(x - lastX) < 50) {
        const dir = x < SCREEN_WIDTH / 2 ? "back" : "forward";
        await onDoubleTap(dir);
        setShowControls(true);
        if (controlsHideTimerRef.current) {
          clearTimeout(controlsHideTimerRef.current);
          controlsHideTimerRef.current = null;
        }
        return;
      }

      setShowControls((s) => {
        const next = !s;
        if (controlsHideTimerRef.current) {
          clearTimeout(controlsHideTimerRef.current);
          controlsHideTimerRef.current = null;
        }
        if (!next) {
          setShowQualitySheet(false);
        }
        return next;
      });
    },
    [onDoubleTap]
  );

  const toggleInlinePlayPause = useCallback(async () => {
    console.log("[VideoScreen] toggleInlinePlayPause entered");
    try {
      const v = playerRef.current || videoPlayer;
      console.log("[VideoScreen] toggleInlinePlayPause: player exists:", Boolean(v));
      if (!v) {
        console.log("[VideoScreen] toggleInlinePlayPause: No video player");
        return;
      }
      console.log(
        `[VideoScreen] toggleInlinePlayPause: Current playing state: ${v.playing}, status: ${v.status}, currentTime: ${v.currentTime}`
      );
      if (v.playing) {
        userPausedRef.current = true;
        console.log("[VideoScreen] Calling player.pause()...");
        v.pause();
        setIsVideoPlaying(false);
        console.log("[VideoScreen] isPlaying updated to false");
      } else {
        userPausedRef.current = false;
        console.log("[VideoScreen] Calling safePlay from toggleInlinePlayPause...");
        safePlay(v as any, "toggleInlinePlayPause");
        setIsVideoPlaying(true);
        console.log("[VideoScreen] isPlaying updated to true");
      }
    } catch (e: any) {
      console.error("[VideoScreen] toggleInlinePlayPause error:", {
        name: e?.name,
        message: e?.message,
        stack: e?.stack,
        cause: e?.cause,
      });
    }
  }, [videoPlayer, safePlay]);

  const showThankYou = useCallback(() => {
    const message = "Thank you for reporting.";
    if (Platform.OS === "android") {
      const ToastAndroid = require("react-native")
        .ToastAndroid as typeof import("react-native").ToastAndroid;
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert("Reported", message);
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

  const submitReport = useCallback(
    async (reason: "Spam" | "Inappropriate" | "Copyright") => {
      if (!activeVideoMeta?.id) return;
      const id = String(activeVideoMeta.id);
      if (reportedContentIds[id]) return;

      setReportSubmitting(true);
      try {
        const res = await contentApi.post("/report", {
          contentId: activeVideoMeta.id,
          reason,
        });

        if (!res?.data?.success) {
          throw new Error(res?.data?.message || "Failed to submit report");
        }

        setReportedContentIds((prev) => {
          const next = { ...prev, [id]: true };
          persistReported(next).catch(() => undefined);
          return next;
        });
        setReportModalOpen(false);
        showThankYou();
      } catch (e: any) {
        Alert.alert(
          "Report Failed",
          e?.message || "Failed to submit report. Please try again."
        );
      } finally {
        setReportSubmitting(false);
      }
    },
    [
      activeVideoMeta?.id,
      activeVideoMeta,
      persistReported,
      reportedContentIds,
      showThankYou,
    ]
  );

  const onPressLike = useCallback(() => {
    if (!activeVideoMeta?.id) return;
    const id = activeVideoMeta.id;

    setReactionStateById((prev) => {
      const cur = prev[String(id)] ?? {
        reaction: activeVideoMeta.userReaction ?? null,
        likeDelta: 0,
        dislikeDelta: 0,
      };
      const currentReaction = cur.reaction;
      const nextReaction: "like" | "dislike" | null =
        currentReaction === "like" ? null : "like";

      contentApi
        .post("/reaction", { contentId: id, reaction: nextReaction })
        .catch((e) => {
          console.warn("[VideoScreen] Failed to like content", e);
        });

      if (currentReaction === "like") {
        return {
          ...prev,
          [String(id)]: {
            reaction: nextReaction,
            likeDelta: cur.likeDelta - 1,
            dislikeDelta: cur.dislikeDelta,
          },
        };
      }

      if (currentReaction === "dislike") {
        return {
          ...prev,
          [String(id)]: {
            reaction: nextReaction,
            likeDelta: cur.likeDelta + 1,
            dislikeDelta: cur.dislikeDelta - 1,
          },
        };
      }

      return {
        ...prev,
        [String(id)]: {
          reaction: nextReaction,
          likeDelta: cur.likeDelta + 1,
          dislikeDelta: cur.dislikeDelta,
        },
      };
    });
  }, [activeVideoMeta]);

  const onPressDislike = useCallback(() => {
    if (!activeVideoMeta?.id) return;
    const id = activeVideoMeta.id;

    setReactionStateById((prev) => {
      const cur = prev[String(id)] ?? {
        reaction: activeVideoMeta.userReaction ?? null,
        likeDelta: 0,
        dislikeDelta: 0,
      };
      const currentReaction = cur.reaction;
      const nextReaction: "like" | "dislike" | null =
        currentReaction === "dislike" ? null : "dislike";

      contentApi
        .post("/reaction", { contentId: id, reaction: nextReaction })
        .catch((e) => {
          console.warn("[VideoScreen] Failed to dislike content", e);
        });

      if (currentReaction === "dislike") {
        return {
          ...prev,
          [String(id)]: {
            reaction: nextReaction,
            likeDelta: cur.likeDelta,
            dislikeDelta: cur.dislikeDelta - 1,
          },
        };
      }

      if (currentReaction === "like") {
        return {
          ...prev,
          [String(id)]: {
            reaction: nextReaction,
            likeDelta: cur.likeDelta - 1,
            dislikeDelta: cur.dislikeDelta + 1,
          },
        };
      }

      return {
        ...prev,
        [String(id)]: {
          reaction: nextReaction,
          likeDelta: cur.likeDelta,
          dislikeDelta: cur.dislikeDelta + 1,
        },
      };
    });
  }, [activeVideoMeta]);

  const onPressArtist = useCallback(() => {
    const artistId = activeVideoMeta?.artistId;
    if (!artistId) return;
    navigation.navigate("Artist", { artistId });
  }, [activeVideoMeta?.artistId, navigation]);

  const renderSkeletonRow = useCallback(
    (_: any, idx: number) => {
      const translateX = shimmerX.interpolate({
        inputRange: [0, 1],
        outputRange: [-160, 260],
      });
      return (
        <View style={styles.skelRow} key={`sk-${idx}`}>
          <View style={styles.skelThumb}>
            <Animated.View
              style={[styles.skelShimmer, { transform: [{ translateX }] }]}
            />
          </View>
          <View style={styles.skelMeta}>
            <View style={styles.skelLineLg}>
              <Animated.View
                style={[styles.skelShimmer, { transform: [{ translateX }] }]}
              />
            </View>
            <View style={styles.skelLineSm}>
              <Animated.View
                style={[styles.skelShimmer, { transform: [{ translateX }] }]}
              />
            </View>
            <View style={styles.skelLineXs}>
              <Animated.View
                style={[styles.skelShimmer, { transform: [{ translateX }] }]}
              />
            </View>
          </View>
        </View>
      );
    },
    [shimmerX]
  );

  const renderVideoItem = useCallback(
    ({ item }: { item: VideoCard }) => {
      const isActive =
        activeVideoId != null && String(item.id) === String(activeVideoId);
      return (
        <Pressable style={styles.rowItem} onPress={() => onPressVideo(item)}>
          <View
            style={[
              styles.rowThumbWrap,
              isActive ? styles.rowThumbWrapActive : null,
            ]}>
            <AppImage
              uri={item.artworkUrl}
              fallbackType="video"
              style={styles.rowThumb}
              resizeMode="cover"
            />
            {item.isLocked && (
              <View style={styles.lockBadgeMini}>
                <Lock size={12} color="#fff" />
              </View>
            )}
            <View style={styles.rowThumbOverlay}>
              <View style={styles.rowPlayBadge}>
                <Image
                  source={PlayButtonImg}
                  style={styles.rowPlayImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>

          <View style={styles.rowMeta}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.rowArtist} numberOfLines={1}>
              {item.artistName}
            </Text>
            <Text style={styles.rowSub} numberOfLines={1}>
              {formatDateLabel(item.createdAt) || ""}
            </Text>
          </View>
        </Pressable>
      );
    },
    [activeVideoId, onPressVideo]
  );

  const related = useMemo(() => {
    if (!activeVideoMeta) return [] as VideoCard[];
    const sameArtist = trending.filter(
      (x) =>
        x.id !== activeVideoMeta.id &&
        x.artistId &&
        x.artistId === activeVideoMeta.artistId
    );
    const sameGenre = trending.filter(
      (x) =>
        x.id !== activeVideoMeta.id &&
        normalizeCategory(x.category) ===
          normalizeCategory(activeVideoMeta.category)
    );
    const merged = [...sameArtist, ...sameGenre];
    const seen = new Set<string>();
    const out: VideoCard[] = [];
    for (const it of merged) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
      if (out.length >= 4) break;
    }
    return out;
  }, [activeVideoMeta, trending]);

  const listHeader = useMemo(() => {
    if (normalizedQuery) return null;
    if (!activeVideoMeta) return null;
    if (!hasPlaybackStarted) return null;
    if (!related.length) return null;

    return (
      <View style={styles.relatedWrap}>
        <Text style={styles.relatedTitle}>Related Videos</Text>
        {related.map((v) => (
          <Pressable
            key={v.id}
            style={styles.relatedRow}
            onPress={() => onPressVideo(v)}>
            <View>
              <AppImage
                uri={v.artworkUrl}
                fallbackType="video"
                style={styles.relatedThumb}
                resizeMode="cover"
              />
              {v.isLocked && (
                <View style={[styles.lockBadgeMini, { top: 4, right: 4 }]}>
                  <Lock size={10} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.relatedMeta}>
              <Text style={styles.relatedRowTitle} numberOfLines={2}>
                {v.title}
              </Text>
              <Text style={styles.relatedRowSub} numberOfLines={1}>
                {v.artistName}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    );
  }, [
    activeVideoMeta,
    hasPlaybackStarted,
    normalizedQuery,
    onPressVideo,
    related,
  ]);

  const listEmpty = useMemo(() => {
    if (normalizedQuery && searchLoading) {
      return (
        <View style={styles.centerStateWrap}>
          <ActivityIndicator size="large" color="#fff" style={{ marginBottom: 16 }} />
          <Text style={styles.centerStateTitle}>Searching videos...</Text>
          <Text style={styles.centerStateSub}>Please wait</Text>
        </View>
      );
    }
    return (
      <View style={styles.centerStateWrap}>
        <View style={styles.emptyVideoWrap}>
          <Video size={36} color="#888" />
        </View>
        <Text style={styles.centerStateTitle}>No videos available</Text>
        <Text style={styles.centerStateSub}>
          {normalizedQuery
            ? "No videos found matching your search"
            : "Tap a video below to start playing"}
        </Text>
      </View>
    );
  }, [normalizedQuery, searchLoading]);

  // Refined Lock Modal for Artist Subscriptions
  const renderArtistLockModal = () => (
    <Modal
      visible={showArtistLockModal.visible}
      transparent
      animationType="fade"
      onRequestClose={() =>
        setShowArtistLockModal({ visible: false, video: null })
      }>
      <View style={styles.modalBackdrop}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.modalContainer}>
          <View
            style={[
              styles.modalIconWrap,
              {
                backgroundColor: "rgba(255,122,24,0.15)",
                borderColor: "rgba(255,122,24,0.3)",
              },
            ]}>
            <Lock color="#FF7A18" size={32} />
          </View>

          <Text style={styles.modalTitle}>Exclusive Content</Text>

          <Text style={styles.modalMessage}>
            Support{" "}
            <Text style={{ color: "#fff", fontWeight: "900" }}>
              {showArtistLockModal.video?.artistName || "this artist"}
            </Text>{" "}
            to unlock full access and premium benefits.
          </Text>

          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <BadgeCheck color="#10B981" size={16} />
              <Text style={styles.benefitText}>
                Watch full exclusive releases
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <BadgeCheck color="#10B981" size={16} />
              <Text style={styles.benefitText}>
                Support the artist directly
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <BadgeCheck color="#10B981" size={16} />
              <Text style={styles.benefitText}>Instant activation</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.modalPrimaryBtn}
            onPress={() => {
              const video = showArtistLockModal.video;
              setShowArtistLockModal({ visible: false, video: null });
              navigation.navigate("SubscriptionFlow", {
                artistId: video?.artistId,
                artistName: video?.artistName,
                defaultPlan: "ARTIST",
                contentId: video?.id,
              });
            }}>
            <LinearGradient
              colors={["#FF7A18", "#FF3D00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.modalBtnGradient}>
              <Text style={styles.modalPrimaryBtnText}>Subscribe Now</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.trustBox}>
            <ShieldCheck color="rgba(255,255,255,0.4)" size={14} />
            <Text style={styles.trustText}>
              Secure payment via Razorpay • Cancel anytime
            </Text>
          </View>

          <TouchableOpacity
            style={styles.modalSecondaryBtn}
            onPress={() =>
              setShowArtistLockModal({ visible: false, video: null })
            }>
            <Text style={styles.modalSecondaryBtnText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={Colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          `${ambientColor.replace("rgb", "rgba").replace(")", ",0.20)")}`,
          "rgba(0,0,0,0)",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        {loading && items.length === 0 ? (
          <View
            style={[
              styles.centerStateWrap,
              { paddingTop: measuredHeaderHeight + 8 },
            ]}>
            <ActivityIndicator size="large" color="#fff" style={{ marginBottom: 16 }} />
            <Text style={styles.centerStateTitle}>Loading videos...</Text>
            <Text style={styles.centerStateSub}>Please wait</Text>
          </View>
        ) : fetchError && visibleItems.length === 0 ? (
          <ScrollView
            contentContainerStyle={[
              styles.centerStateWrap,
              { paddingTop: measuredHeaderHeight + 8, flexGrow: 1 },
            ]}
            refreshControl={
              <RefreshControl
                tintColor="#fff"
                refreshing={refreshing}
                onRefresh={() => load({ refresh: true })}
              />
            }>
            <View style={styles.errorWifiWrap}>
              <Wifi size={40} color="#FF3366" />
            </View>
            <Text style={styles.centerStateTitle}>Couldn't load videos</Text>
            <Text style={styles.centerStateSub}>
              Please check{" "}
              <Text style={{ color: "#FF3366" }}>your internet connection</Text>
              {"\n"}and try again.
            </Text>
            <TouchableOpacity
              style={styles.errorRetryBtn}
              onPress={() => load({ refresh: true })}
              activeOpacity={0.85}>
              <Text style={styles.errorRetryBtnText}>Retry</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <FlatList<VideoCard>
            ref={(r) => {
              listRef.current = r;
            }}
            data={visibleItems}
            keyExtractor={(it) => it.id}
            initialNumToRender={5}
            windowSize={5}
            removeClippedSubviews={true}
            renderItem={renderVideoItem}
            showsVerticalScrollIndicator={false}
            onScroll={onListScroll}
            scrollEventThrottle={16}
            contentContainerStyle={{
              paddingTop: measuredHeaderHeight + 8,
              paddingBottom: tabBarHeight + 120,
              flexGrow: 1,
            }}
            refreshControl={
              <RefreshControl
                tintColor="#fff"
                refreshing={refreshing}
                onRefresh={() => load({ refresh: true })}
              />
            }
            ListEmptyComponent={listEmpty}
            ListHeaderComponent={listHeader}
            ListHeaderComponentStyle={
              listHeader ? { marginTop: 24, marginBottom: 14 } : undefined
            }
          />
        )}

        <View
          style={[
            styles.stickyHeader,
            isFullscreen ? styles.stickyHeaderFullscreen : null,
          ]}
          pointerEvents="box-none">
          <View onLayout={onHeaderLayout}>
            {!isFullscreen ? (
              <View
                style={[
                  styles.headerTopRow,
                  {
                    paddingTop: Math.max(
                      insets.top,
                      Platform.OS === "android" ? 10 : 6
                    ),
                  },
                ]}>
                <Text style={styles.title}>Video</Text>
              </View>
            ) : null}

            {activeVideoId || loadingPlaybackUrl ? (
              <Animated.View
                style={[
                  styles.playerFrame,
                  isFullscreen
                    ? [{ width: windowWidth, height: windowHeight } as any]
                    : null,
                ]}
                pointerEvents="box-none">
                <View
                  style={styles.playerInner}
                  pointerEvents="box-none"
                  {...panResponder.panHandlers}>
                  {activePlaybackUrl && videoPlayer ? (
                    <Pressable
                      style={[
                        StyleSheet.absoluteFill,
                        styles.playerSurfacePressable,
                      ]}
                      pointerEvents="auto"
                      onPress={onPressPlayerSurface}
                      onPressIn={handlePlayerPressIn}
                      onPressOut={handlePlayerPressOut}>
                      <VideoView
                        player={videoPlayer}
                        style={[
                          styles.video,
                          {
                            width: isFullscreen ? windowWidth : SCREEN_WIDTH,
                            height: isFullscreen ? windowHeight : HEADER_HEIGHT,
                          },
                        ]}
                        contentFit="contain"
                        nativeControls={false}
                        allowsVideoFrameAnalysis={false}
                      />
                    </Pressable>
                  ) : (
                    <View style={StyleSheet.absoluteFill}>
                      <View style={styles.playerBlank} />
                      <View style={styles.heroOverlay}>
                        {loadingPlaybackUrl ? (
                          <ActivityIndicator color="#fff" />
                        ) : null}
                        <Text style={styles.selectText}>
                          Select a video to play
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* 2X Long-Press Speed Badge Overlay */}
                  {isHolding2x ? (
                    <View style={styles.holding2xBadge} pointerEvents="none">
                      <Zap size={14} color="#FFF" />
                      <Text style={styles.holding2xText}>2X Speed</Text>
                    </View>
                  ) : null}

                  {/* Double-Tap Seek Visual Feedback Animations */}
                  {seekFeedback ? (
                    <Animated.View
                      style={[
                        seekFeedback.dir === "back"
                          ? styles.seekRippleLeft
                          : styles.seekRippleRight,
                        { opacity: seekFeedbackAnim },
                      ]}
                      pointerEvents="none">
                      <Text style={styles.seekRippleText}>
                        {seekFeedback.dir === "back" ? "⏪ -10s" : "+10s ⏩"}
                      </Text>
                    </Animated.View>
                  ) : null}

                  {/* Single Clean Responsive Player Controls Bar Overlay */}
                  {activePlaybackUrl && showControls ? (
                    <View
                      style={[
                        styles.playerTopBar,
                        isFullscreen && {
                          paddingTop: Math.max(insets.top, 12),
                          paddingLeft: Math.max(insets.left, 12),
                          paddingRight: Math.max(insets.right, 12),
                        },
                      ]}
                      pointerEvents="box-none">
                      <LinearGradient
                        colors={[
                          "rgba(0,0,0,0.72)",
                          "rgba(0,0,0,0.30)",
                          "transparent",
                        ]}
                        style={StyleSheet.absoluteFill}
                        pointerEvents="none"
                      />
                      <View
                        style={styles.playerControlsRow}
                        pointerEvents="box-none">
                        {/* Left: Back / Minimize Button */}
                        <Pressable
                          style={styles.playerControlBtn}
                          hitSlop={6}
                          onPress={() => {
                            if (isFullscreen) {
                              exitFullscreen();
                            } else {
                              stopAndReset();
                            }
                          }}>
                          <ArrowLeft size={18} color="#fff" />
                        </Pressable>

                        {/* Right: Mute, Speed, More Options, Fullscreen */}
                        <View
                          style={styles.playerRightControlsGroup}
                          pointerEvents="box-none">
                          <Pressable
                            style={styles.playerControlBtn}
                            hitSlop={6}
                            onPress={toggleMute}>
                            {isMuted ? (
                              <VolumeX size={18} color="#FF5555" />
                            ) : (
                              <Volume2 size={18} color="#fff" />
                            )}
                          </Pressable>

                          <Pressable
                            style={[
                              styles.playerControlBtn,
                              styles.playerSpeedControlBtn,
                            ]}
                            hitSlop={6}
                            onPress={() => setShowSpeedSheet(true)}>
                            <Text style={styles.playerSpeedBtnText}>
                              {selectedSpeed === 1
                                ? "1.0x"
                                : `${selectedSpeed}x`}
                            </Text>
                          </Pressable>

                          <Pressable
                            style={styles.playerControlBtn}
                            hitSlop={6}
                            onPress={() => setShowMoreOptionsSheet(true)}>
                            <MoreVertical size={18} color="#fff" />
                          </Pressable>

                          <Pressable
                            style={styles.playerControlBtn}
                            hitSlop={6}
                            onPress={() => {
                              if (isFullscreen) {
                                exitFullscreen();
                              } else {
                                enterFullscreen();
                              }
                            }}>
                            {isFullscreen ? (
                              <Minimize size={18} color="#fff" />
                            ) : (
                              <Maximize size={18} color="#fff" />
                            )}
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ) : null}

                  {showQualitySheet && activePlaybackUrl && showControls ? (
                    <BlurView
                      intensity={70}
                      tint="dark"
                      style={styles.qualitySheet}>
                      <Text style={styles.qualitySheetTitle}>Quality</Text>
                      <ScrollView
                        bounces={false}
                        showsVerticalScrollIndicator={false}
                        style={styles.qualityScrollView}
                        contentContainerStyle={styles.qualityScrollContent}>
                        {availableQualities.map((q) => {
                          const active = q === selectedQuality;
                          const isLockedForFree =
                            !isStreamingHdAllowed &&
                            q !== "144p" &&
                            q !== "240p";
                          return (
                            <Pressable
                              key={q}
                              style={[
                                styles.qualityPill,
                                active ? styles.qualityPillActive : null,
                              ]}
                              onPress={() => {
                                applyQualitySelection(q).catch(() => undefined);
                              }}>
                              <Text
                                style={[
                                  styles.qualityText,
                                  active ? styles.qualityTextActive : null,
                                ]}>
                                {q}
                              </Text>
                              {isLockedForFree ? (
                                <View
                                  style={[
                                    styles.qualityHdTag,
                                    { backgroundColor: "rgba(0,0,0,0.5)" },
                                  ]}>
                                  <Lock color="#FFA500" size={12} />
                                </View>
                              ) : null}
                              {active ? (
                                <View style={styles.qualityActiveDot} />
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </BlurView>
                  ) : null}

                  {activePlaybackUrl && showControls ? (
                    <View
                      style={[
                        styles.controlsOverlay,
                        { flexDirection: "row", gap: 20 },
                      ]}
                      pointerEvents="box-none">
                      {/* BACKWARD 10 SEC BUTTON */}
                      <Pressable
                        style={({ pressed }) => [
                          styles.seekBtn,
                          pressed ? styles.seekBtnPressed : null,
                        ]}
                        onPress={async () => {
                          try {
                            const p = playerRef.current || videoPlayer;
                            if (!p) return;
                            const wasPlaying = p.playing;
                            triggerSeekFeedback("back");
                            p.seekBy(-10);
                            if (wasPlaying) {
                              if (Platform.OS === "android") {
                                setTimeout(() => {
                                  safePlay(p as any, "backward-seek");
                                }, 50);
                              } else {
                                safePlay(p as any, "backward-seek");
                              }
                            }
                          } catch (e) {
                            console.log("BACKWARD SEEK ERROR", e);
                          }
                        }}>
                        <Text style={styles.seekBtnText}>⏪ 10</Text>
                      </Pressable>

                      {/* PLAY/PAUSE BUTTON */}
                      <Pressable
                        style={({ pressed }) => [
                          styles.playPauseBtn,
                          pressed ? styles.playPauseBtnPressed : null,
                        ]}
                        onPress={toggleInlinePlayPause}>
                        <Image
                          source={
                            isVideoPlaying ? PauseButtonImg : PlayButtonImg
                          }
                          style={styles.playPauseImg}
                          resizeMode="contain"
                        />
                      </Pressable>

                      {/* FORWARD 10 SEC BUTTON */}
                      <Pressable
                        style={({ pressed }) => [
                          styles.seekBtn,
                          pressed ? styles.seekBtnPressed : null,
                        ]}
                        onPress={async () => {
                          try {
                            const p = playerRef.current || videoPlayer;
                            if (!p) return;
                            const wasPlaying = p.playing;
                            const dur = p.duration;
                            const currentTime = p.currentTime;
                            const remaining = dur - currentTime;
                            const seekAmount = Math.min(10, remaining);
                            triggerSeekFeedback("forward");
                            p.seekBy(seekAmount);
                            if (wasPlaying) {
                              if (Platform.OS === "android") {
                                setTimeout(() => {
                                  safePlay(p as any, "forward-seek");
                                }, 50);
                              } else {
                                safePlay(p as any, "forward-seek");
                              }
                            }
                          } catch (e) {
                            console.log("FORWARD SEEK ERROR", e);
                          }
                        }}>
                        <Text style={styles.seekBtnText}>10 ⏩</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {showUpNext ? (
                    <View style={styles.upNextOverlay}>
                      <Text style={styles.upNextTitle}>Up Next</Text>
                      <Text style={styles.upNextSub}>
                        Playing next in {upNextSeconds}s
                      </Text>
                    </View>
                  ) : null}

                  {activePlaybackUrl && showControls ? (
                    <View style={styles.seekWrap} pointerEvents="box-none">
                      <View style={styles.seekTimesRow}>
                        <Text style={styles.seekTime}>
                          {formatDurationLabel(positionMs, "00:00")}
                        </Text>
                        <Text style={styles.seekTime}>
                          {formatDurationLabel(durationMs, "--:--")}
                        </Text>
                      </View>
                      <View style={styles.sliderContainer}>
                        {/* Buffered Progress Bar Track */}
                        <View style={styles.bufferedTrackWrap} pointerEvents="none">
                          <View
                            style={[
                              styles.bufferedTrack,
                              {
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    durationMs > 0
                                      ? (((videoPlayer?.bufferedPosition || 0) *
                                          1000) /
                                          durationMs) *
                                          100
                                      : 0
                                  )
                                )}%`,
                              },
                            ]}
                          />
                        </View>
                        <Slider
                          style={styles.slider}
                          minimumValue={0}
                          maximumValue={Math.max(1, durationMs || 1)}
                          value={Math.min(positionMs, durationMs || 1)}
                          disabled={!hasFiniteDuration(durationMs)}
                          minimumTrackTintColor="#FF0033"
                          maximumTrackTintColor="rgba(255,255,255,0.22)"
                          thumbTintColor="#FF0033"
                          onSlidingStart={onSeekStart}
                          onValueChange={onSeekChange}
                          onSlidingComplete={onSeekComplete}
                        />
                      </View>
                    </View>
                  ) : null}

                  {playbackError ? (
                    <Text style={styles.heroHintText}>{playbackError}</Text>
                  ) : null}

                  {!activePlaybackUrl ? (
                    <View style={styles.heroHint}>
                      <Text style={styles.heroHintText}>
                        Tap a video below to start playing
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Animated.View>
            ) : null}

            {activeVideoId ? (
              <View style={styles.metaBlock}>
                {hasPlaybackStarted && activeVideoMeta ? (
                  <>
                    <Text style={styles.nowTitle} numberOfLines={1}>
                      {activeVideoMeta.title}
                    </Text>

                    <View style={styles.artistRowContainer}>
                      <Pressable
                        style={styles.artistRow}
                        onPress={onPressArtist}>
                        <AppImage
                          uri={activeVideoMeta.artistProfileImage}
                          fallbackType="artist"
                          style={styles.artistAvatar}
                          resizeMode="cover"
                        />
                        <View style={styles.artistNameCol}>
                          <Text style={styles.artistRowName} numberOfLines={1}>
                            {activeVideoMeta.artistName}
                          </Text>
                          <Text style={styles.artistRowSub} numberOfLines={1}>
                            {formatDateLabel(activeVideoMeta.createdAt)}
                          </Text>
                        </View>
                      </Pressable>

                      {(() => {
                        const id = activeVideoMeta.id;
                        const state = reactionStateById[String(id)] ?? {
                          reaction: activeVideoMeta.userReaction ?? null,
                          likeDelta: 0,
                          dislikeDelta: 0,
                        };
                        const reaction = state.reaction;
                        const likeBase =
                          typeof activeVideoMeta.likeCount === "number"
                            ? activeVideoMeta.likeCount
                            : 0;
                        const dislikeBase =
                          typeof activeVideoMeta.dislikeCount === "number"
                            ? activeVideoMeta.dislikeCount
                            : 0;
                        const likeCount = Math.max(
                          0,
                          likeBase + state.likeDelta
                        );
                        const dislikeCount = Math.max(
                          0,
                          dislikeBase + state.dislikeDelta
                        );

                        const likeActive = reaction === "like";
                        const dislikeActive = reaction === "dislike";

                        return (
                          <View style={styles.engagementIconsRow}>
                            <Pressable
                              style={[
                                styles.engagementIconBtn,
                                likeActive
                                  ? styles.engagementIconBtnActive
                                  : null,
                              ]}
                              onPress={onPressLike}
                              hitSlop={8}>
                              <EngagementIcon
                                name="like"
                                color={likeActive ? Colors.accent : "#fff"}
                              />
                              {typeof likeCount === "number" ? (
                                <Text
                                  style={[
                                    styles.engagementIconCount,
                                    likeActive
                                      ? styles.engagementIconCountActive
                                      : null,
                                  ]}>
                                  {formatCompactViews(likeCount).replace(
                                    " views",
                                    ""
                                  )}
                                </Text>
                              ) : null}
                            </Pressable>
                            <Pressable
                              style={[
                                styles.engagementIconBtn,
                                dislikeActive
                                  ? styles.engagementIconBtnActive
                                  : null,
                              ]}
                              onPress={onPressDislike}
                              hitSlop={8}>
                              <EngagementIcon
                                name="dislike"
                                color={dislikeActive ? Colors.accent : "#fff"}
                              />
                              {typeof dislikeCount === "number" ? (
                                <Text
                                  style={[
                                    styles.engagementIconCount,
                                    dislikeActive
                                      ? styles.engagementIconCountActive
                                      : null,
                                  ]}>
                                  {formatCompactViews(dislikeCount).replace(
                                    " views",
                                    ""
                                  )}
                                </Text>
                              ) : null}
                            </Pressable>
                            <Pressable
                              style={[
                                styles.engagementIconBtn,
                                activeVideoMeta?.id &&
                                reportedContentIds[String(activeVideoMeta.id)]
                                  ? styles.reportIconBtnDisabled
                                  : null,
                              ]}
                              onPress={() => {
                                if (!activeVideoMeta?.id) return;
                                if (
                                  reportedContentIds[String(activeVideoMeta.id)]
                                )
                                  return;
                                setReportModalOpen(true);
                              }}
                              hitSlop={8}>
                              <AlertTriangle
                                size={18}
                                color={
                                  activeVideoMeta?.id &&
                                  reportedContentIds[String(activeVideoMeta.id)]
                                    ? "rgba(255,255,255,0.35)"
                                    : "#fff"
                                }
                              />
                              <Text
                                style={[
                                  styles.engagementIconCount,
                                  activeVideoMeta?.id &&
                                  reportedContentIds[String(activeVideoMeta.id)]
                                    ? styles.reportTextDisabled
                                    : null,
                                ]}>
                                Report
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })()}
                    </View>
                  </>
                ) : null}
              </View>
            ) : null}

            <View style={styles.searchWrap}>
              <BlurView intensity={24} tint="dark" style={styles.searchBlur}>
                <Search size={18} color="rgba(255,255,255,0.7)" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search videos"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={styles.searchInput}
                />
                {searchQuery.trim().length ? (
                  <Pressable
                    style={styles.searchClearBtn}
                    onPress={() => {
                      setSearchQuery("");
                      setSearchResults(null);
                    }}
                    hitSlop={10}>
                    <X size={18} color="rgba(255,255,255,0.70)" />
                  </Pressable>
                ) : null}
                {searchLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : null}
              </BlurView>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={reportModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!reportSubmitting) setReportModalOpen(false);
        }}>
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
            style={({ pressed }) => [
              styles.reportReasonBtn,
              pressed ? styles.reportReasonBtnPressed : null,
            ]}
            disabled={reportSubmitting}
            onPress={() => submitReport("Spam")}>
            <Text style={styles.reportReasonText}>Spam</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.reportReasonBtn,
              pressed ? styles.reportReasonBtnPressed : null,
            ]}
            disabled={reportSubmitting}
            onPress={() => submitReport("Inappropriate")}>
            <Text style={styles.reportReasonText}>Inappropriate</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.reportReasonBtn,
              pressed ? styles.reportReasonBtnPressed : null,
            ]}
            disabled={reportSubmitting}
            onPress={() => submitReport("Copyright")}>
            <Text style={styles.reportReasonText}>Copyright</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.reportCancelBtn,
              pressed ? styles.reportCancelBtnPressed : null,
            ]}
            disabled={reportSubmitting}
            onPress={() => setReportModalOpen(false)}>
            <Text style={styles.reportCancelText}>
              {reportSubmitting ? "Submitting..." : "Cancel"}
            </Text>
          </Pressable>
        </View>
      </Modal>

      {/* ── HD Quality Lock Modal ─────────────────────────────────────── */}
      <Modal
        visible={showHdLockModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHdLockModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconWrap}>
              <Crown color="#4AA3FF" size={28} />
            </View>
            <Text style={styles.modalTitle}>HD Quality Locked</Text>
            <Text style={styles.modalMessage}>
              Upgrade to Premium to watch in high quality (720p/1080p).
            </Text>
            <Pressable
              style={styles.modalPrimaryBtn}
              onPress={() => {
                setShowHdLockModal(false);
                navigation.navigate("SubscriptionFlow", {
                  defaultPlan: "PLATFORM",
                });
              }}>
              <LinearGradient
                colors={["#4AA3FF", "#0B7EE8"]}
                style={styles.modalBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}>
                <Text style={styles.modalPrimaryBtnText}>Upgrade Now</Text>
              </LinearGradient>
            </Pressable>
            <Pressable
              style={styles.modalSecondaryBtn}
              onPress={() => setShowHdLockModal(false)}>
              <Text style={styles.modalSecondaryBtnText}>
                Continue with {maxAllowedResolution}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ── Playback Speed Modal ──────────────────────────────────────── */}
      <Modal
        visible={showSpeedSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSpeedSheet(false)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowSpeedSheet(false)}
        />
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Playback speed</Text>
            <Pressable onPress={() => setShowSpeedSheet(false)} hitSlop={10}>
              <X size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
          <ScrollView
            bounces={false}
            style={{ maxHeight: 320 }}
            showsVerticalScrollIndicator={false}>
            {PLAYBACK_SPEEDS.map((spd) => {
              const active = selectedSpeed === spd;
              return (
                <Pressable
                  key={spd}
                  style={[
                    styles.sheetOptionRow,
                    active ? styles.sheetOptionRowActive : null,
                  ]}
                  onPress={() => {
                    applyPlaybackSpeed(spd);
                    setShowSpeedSheet(false);
                  }}>
                  <Text
                    style={[
                      styles.sheetOptionText,
                      active ? styles.sheetOptionTextActive : null,
                    ]}>
                    {spd === 1 ? "Normal (1x)" : `${spd}x`}
                  </Text>
                  {active ? <Check size={18} color="#FF5500" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* ── More Options Modal ────────────────────────────────────────── */}
      <Modal
        visible={showMoreOptionsSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreOptionsSheet(false)}>
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowMoreOptionsSheet(false)}
        />
        <View style={styles.sheetCard}>
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>More options</Text>
            <Pressable
              onPress={() => setShowMoreOptionsSheet(false)}
              hitSlop={10}>
              <X size={20} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          {/* Quality Item */}
          <Pressable
            style={styles.sheetOptionRow}
            onPress={() => {
              setShowMoreOptionsSheet(false);
              setShowQualitySheet(true);
            }}>
            <View style={styles.sheetOptionLeft}>
              <Settings size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.sheetOptionText}>Quality</Text>
            </View>
            <Text style={styles.sheetOptionSubText}>
              {selectedQuality || "Auto"}
            </Text>
          </Pressable>

          {/* Playback Speed Item */}
          <Pressable
            style={styles.sheetOptionRow}
            onPress={() => {
              setShowMoreOptionsSheet(false);
              setShowSpeedSheet(true);
            }}>
            <View style={styles.sheetOptionLeft}>
              <Settings size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.sheetOptionText}>Playback speed</Text>
            </View>
            <Text style={styles.sheetOptionSubText}>
              {selectedSpeed === 1 ? "Normal" : `${selectedSpeed}x`}
            </Text>
          </Pressable>

          {/* Autoplay Next Switch */}
          <View style={styles.sheetOptionRow}>
            <View style={styles.sheetOptionLeft}>
              <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.sheetOptionText}>Autoplay next video</Text>
            </View>
            <Switch
              value={isAutoplayEnabled}
              onValueChange={(val) => setIsAutoplayEnabled(val)}
              thumbColor={isAutoplayEnabled ? "#FF5500" : "#888"}
              trackColor={{ false: "#333", true: "rgba(255,85,0,0.4)" }}
            />
          </View>

          {/* Picture in Picture / Minimize */}
          <Pressable
            style={styles.sheetOptionRow}
            onPress={() => {
              setShowMoreOptionsSheet(false);
              if (isFullscreen) {
                exitFullscreen();
              }
              setInlineVideoHostActive(false);
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate("HomeTab" as any);
              }
            }}>
            <View style={styles.sheetOptionLeft}>
              <Minimize size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.sheetOptionText}>
                Picture-in-Picture / Mini Player
              </Text>
            </View>
            <Text style={styles.sheetOptionSubText}>Floating</Text>
          </Pressable>

          {/* Report Content */}
          <Pressable
            style={styles.sheetOptionRow}
            onPress={() => {
              setShowMoreOptionsSheet(false);
              setReportModalOpen(true);
            }}>
            <View style={styles.sheetOptionLeft}>
              <AlertTriangle size={18} color="rgba(255,255,255,0.8)" />
              <Text style={styles.sheetOptionText}>Report content</Text>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* ── Artist Lock Modal ─────────────────────────────────────────── */}
      {renderArtistLockModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  safe: { flex: 1 },
  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.3,
    lineHeight: 28,
  },

  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 4,
    backgroundColor: "#000",
    zIndex: 100,
    elevation: 20,
  },
  stickyHeaderFullscreen: {
    bottom: 0,
    paddingBottom: 0,
    backgroundColor: "#000",
    zIndex: 999,
    elevation: 999,
  },
  headerTopRow: {
    paddingBottom: 4,
    paddingHorizontal: 16,
  },

  playerFrame: {
    width: "100%",
    height: HEADER_HEIGHT,
    backgroundColor: "#000",
  },
  playerFrameFullscreen: {
    height: Dimensions.get("window").height,
  },
  playerFrameMini: {
    position: "absolute",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  playerInner: {
    flex: 1,
  },
  playerBlank: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  selectText: {
    marginTop: 10,
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  video: {
    width: "100%",
    height: "100%",
  },
  videoOffscreen: {
    position: "absolute",
    left: -9999,
    top: 0,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  heroHint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  heroHintText: {
    color: "rgba(255,255,255,0.80)",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  playerTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 8,
    paddingBottom: 16,
    paddingHorizontal: 12,
    zIndex: 30,
    elevation: 30,
  },
  playerControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  playerRightControlsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playerControlBtn: {
    width: 36,
    height: 36,
    minWidth: 36,
    minHeight: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  playerSpeedControlBtn: {
    width: undefined,
    minWidth: 38,
    paddingHorizontal: 8,
  },
  playerSpeedBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    elevation: 10,
    backgroundColor: "rgba(0,0,0,0.10)",
  },

  playerSurfacePressable: {
    zIndex: -1,
    elevation: -1,
  },
  playPauseBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
  },
  playPauseBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  playPauseImg: {
    width: 60,
    height: 60,
  },
  // ✅ YAHAN SE NEEECHE YEH ADD KARO
  seekBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  seekBtnPressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.8,
  },
  seekBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },

  speedBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  speedBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  holding2xBadge: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    zIndex: 40,
    elevation: 40,
  },
  holding2xText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  seekRippleLeft: {
    position: "absolute",
    left: 20,
    top: "38%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 35,
    elevation: 35,
  },
  seekRippleRight: {
    position: "absolute",
    right: 20,
    top: "38%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    zIndex: 35,
    elevation: 35,
  },
  seekRippleText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "900",
  },

  seekWrap: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 8,
    zIndex: 25,
    elevation: 25,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  seekTimesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  seekTime: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    fontWeight: "800",
  },
  sliderContainer: {
    width: "100%",
    position: "relative",
    justifyContent: "center",
  },
  bufferedTrackWrap: {
    position: "absolute",
    left: 2,
    right: 2,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  bufferedTrack: {
    height: "100%",
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 2,
  },
  slider: { width: "100%", height: 20 },

  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheetCard: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 24,
    borderRadius: 20,
    padding: 18,
    backgroundColor: "rgba(22,22,24,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 24,
  },
  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  sheetOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  sheetOptionRowActive: {
    backgroundColor: "rgba(255,85,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,85,0,0.35)",
  },
  sheetOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetOptionText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "700",
  },
  sheetOptionTextActive: {
    color: "#FF5500",
    fontWeight: "900",
  },
  sheetOptionSubText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
    fontWeight: "600",
  },

  upNextOverlay: {
    position: "absolute",
    left: 12,
    bottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.60)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  upNextTitle: { color: "#fff", fontSize: 13, fontWeight: "900" },
  upNextSub: {
    marginTop: 2,
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontWeight: "700",
  },

  metaBlock: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: "rgba(0,0,0,0.20)",
  },
  nowTitle: { color: "#fff", fontSize: 16, fontWeight: "900" },

  artistRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  artistRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    marginRight: 10,
  },
  artistNameCol: {
    flexDirection: "column",
    justifyContent: "center",
    flexShrink: 1,
  },
  artistAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  artistRowName: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  artistRowSub: {
    color: "rgba(255,255,255,0.60)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  engagementIconsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  engagementIconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  engagementIconBtnActive: {
    backgroundColor: "rgba(255,106,0,0.16)",
    borderColor: "rgba(255,106,0,0.55)",
  },
  engagementIconCount: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 12,
    fontWeight: "900",
  },
  engagementIconCountActive: {
    color: Colors.accent,
  },

  reportIconBtnDisabled: {
    opacity: 0.65,
  },
  reportTextDisabled: {
    color: "rgba(255,255,255,0.40)",
  },

  reportModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  reportModalCard: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 26,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(20,20,20,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  reportModalTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },
  reportModalSub: {
    marginTop: 6,
    marginBottom: 12,
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    fontWeight: "700",
  },
  reportReasonBtn: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    marginBottom: 10,
  },
  reportReasonBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  reportReasonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  reportCancelBtn: {
    marginTop: 4,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  reportCancelBtnPressed: {
    opacity: 0.85,
  },
  reportCancelText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "800",
  },

  actionRow: { marginTop: 12, flexDirection: "row", gap: 18 },

  qualitySheet: {
    position: "absolute",
    // Anchor to bottom-right — grows upward, never out of player bounds.
    right: 12,
    bottom: 48, // sits just above the seek bar
    zIndex: 999, // above everything (controls are z:30)
    elevation: 999,
    paddingHorizontal: 0,
    paddingTop: 10,
    paddingBottom: 8,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    minWidth: 160,
    maxWidth: 200,
  },
  qualityScrollView: {
    maxHeight: HEADER_HEIGHT - 80, // never taller than the player area
  },
  qualityScrollContent: {
    paddingHorizontal: 10,
    paddingBottom: 4,
    gap: 6,
  },
  qualitySheetTitle: {
    color: "rgba(255,255,255,0.50)",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  qualityPill: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  qualityPillActive: {
    borderColor: "rgba(255,106,0,0.70)",
    backgroundColor: "rgba(255,106,0,0.18)",
  },
  qualityText: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  qualityTextActive: { color: Colors.accent },
  qualityHdTag: {
    backgroundColor: "#FF0000",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  qualityHdTagText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  qualityActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },

  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 6,
  },
  searchBlur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    padding: 0,
  },
  searchClearBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },

  rowItem: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  rowThumbWrap: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  rowThumbWrapActive: {
    borderColor: "rgba(255,106,0,0.60)",
  },
  rowThumb: { width: "100%", height: "100%" },
  rowThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  rowPlayBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  rowPlayImg: {
    width: 60,
    height: 60,
  },
  rowMeta: { paddingTop: 10, paddingBottom: 2 },
  rowTitle: { color: "#fff", fontSize: 14, fontWeight: "900" },
  rowArtist: {
    marginTop: 4,
    color: "rgba(255,255,255,0.70)",
    fontSize: 12,
    fontWeight: "800",
  },
  rowSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "800",
  },

  relatedWrap: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 18,
    marginTop: 26,
  },
  relatedTitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 10,
  },
  relatedRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  relatedThumb: {
    width: 92,
    height: Math.round(92 * (9 / 16)),
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  relatedMeta: { flex: 1, justifyContent: "center" },
  relatedRowTitle: { color: "#fff", fontSize: 13, fontWeight: "900" },
  relatedRowSub: {
    marginTop: 4,
    color: "rgba(255,255,255,0.62)",
    fontSize: 11,
    fontWeight: "800",
  },

  skelRow: { paddingHorizontal: 16, paddingTop: 14 },
  skelThumb: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skelMeta: { paddingTop: 10 },
  skelLineLg: {
    height: 14,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skelLineSm: {
    marginTop: 8,
    height: 12,
    width: "70%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skelLineXs: {
    marginTop: 8,
    height: 11,
    width: "52%",
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  skelShimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: "rgba(255,255,255,0.06)",
    transform: [{ skewX: "-20deg" } as any],
  },

  emptyText: {
    marginTop: 16,
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  // Quality settings icon + HD badge wrapper
  qualityIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  hdBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    backgroundColor: "#FF0000",
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  hdBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  // Custom Modal Styles for Lock Flow
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5,5,15,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#1C1C24",
    borderRadius: 32,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 24,
  },
  modalIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.05)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: -0.5,
  },
  modalMessage: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 15,
    textAlign: "center",
    marginHorizontal: 4,
    marginBottom: 32,
    lineHeight: 24,
    fontWeight: "600",
  },
  modalPrimaryBtn: {
    width: "100%",
    height: 60,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#FF7A18",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modalBtnGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalPrimaryBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  modalSecondaryBtn: {
    width: "100%",
    height: 52,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  modalSecondaryBtnText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontWeight: "700",
  },
  benefitsList: {
    width: "100%",
    marginBottom: 24,
    gap: 12,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
  },
  trustBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    opacity: 0.6,
  },
  trustText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  lockBadgeMini: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  centerStateWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
    minHeight: 280,
  },
  centerStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 6,
  },
  centerStateSub: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    lineHeight: 18,
  },
  emptyVideoWrap: {
    width: 72,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorWifiWrap: {
    marginBottom: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  errorRetryBtn: {
    marginTop: 20,
    backgroundColor: "#FF3366",
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  errorRetryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

