import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { ArrowLeft, X } from 'lucide-react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import { Colors } from '../theme';
import { useTheme } from '../providers/ThemeProvider';
import { formatDurationLabel, hasFiniteDuration } from '../utils/mediaTime';
import type { MediaItem } from '../media.types';
import { navigationRef } from '../navigation/rootNavigation';
import { resolveAppImageUrl } from '../utils/imageUtils';
import { useToast } from '../ui/ToastProvider';

const { width: SCREEN_W } = Dimensions.get('window');
const DISC_SIZE = Math.min(SCREEN_W - 72, 270);

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function HeartIcon({ size = 22, filled = false, color = '#fff' }: { size?: number; filled?: boolean; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'}>
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}



function SkipPrevIcon({ size = 26, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19 20L9 12l10-8v16z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={color} />
      <Rect x="4" y="4" width="3" height="16" rx="1" fill={color} />
    </Svg>
  );
}

function SkipNextIcon({ size = 26, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 4l10 8-10 8V4z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill={color} />
      <Rect x="17" y="4" width="3" height="16" rx="1" fill={color} />
    </Svg>
  );
}

function PlayIcon({ size = 32, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M5 3l14 9-14 9V3z" fill={color} />
    </Svg>
  );
}

function PauseIcon({ size = 32, color = '#000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Rect x="6" y="4" width="4" height="16" rx="1" fill={color} />
      <Rect x="14" y="4" width="4" height="16" rx="1" fill={color} />
    </Svg>
  );
}

function ShuffleIcon({ size = 22, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 3h5v5M4 20l5.5-5.5M21 3l-7.5 7.5M4 4l17 17M16 21h5v-5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RepeatIcon({ size = 22, color = '#fff', one = false }: { size?: number; color?: string; one?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {one ? (
        <Path d="M12 9v6M10.5 10.5L12 9" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type FullPlayerRouteParams = {
  songId: string;
  title: string;
  artist: string;
  imageUrl: string;
  audioUrl: string;
  queueIndex: number;
  queue: MediaItem[];
};

export default function FullPlayerScreen({ navigation, route }: any) {
  const params = (route?.params ?? {}) as Partial<FullPlayerRouteParams>;

  const { showToast } = useToast();

  const {
    currentItem,
    state: playerState,
    playQueue,
    togglePlayPause,
    skipNext,
    skipPrev,
    seekTo,
    pendingSeekPositionMs,
    setVolume,
    close,
    toggleShuffle,
    cycleRepeatMode,
  } = useMediaPlayer();

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  // Dynamic layout metrics strictly preventing bottom navigation overlap
  const isShortScreen = windowHeight < 720;
  const isVeryShortScreen = windowHeight < 640;
  const bottomNavHeight = 66 + Math.max(insets.bottom, Platform.OS === 'ios' ? 14 : 10);
  const bottomSpacing = isShortScreen ? 14 : 20; // clearance above floating bottom nav
  const bottomPadding = bottomNavHeight + bottomSpacing;

  // Responsive artwork sizing: well-proportioned, leaving ample breathing room
  const artSize = isVeryShortScreen
    ? Math.min(windowWidth * 0.48, 160)
    : isShortScreen
    ? Math.min(windowWidth * 0.54, 185)
    : Math.min(windowWidth * 0.60, 230);

  const rimPadding = isShortScreen ? 14 : 18;
  const rimSize = artSize + rimPadding * 2;
  const artworkToTitleGap = isShortScreen ? 20 : 30;

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [scrubPosition, setScrubPosition] = useState<number | null>(null);
  const [isHearted, setIsHearted] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);

  // ── Rotation animation ─────────────────────────────────────────────────────
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const rotationRef = useRef<Animated.CompositeAnimation | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  const startRotation = useCallback(() => {
    if (rotationRef.current) return;
    const loop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotationRef.current = loop;
    loop.start();
  }, [rotateAnim]);

  const stopRotation = useCallback(() => {
    rotationRef.current?.stop();
    rotationRef.current = null;
  }, []);

  const startPulse = useCallback(() => {
    if (pulseRef.current) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseRef.current = loop;
    loop.start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseRef.current?.stop();
    pulseRef.current = null;
    Animated.timing(pulseAnim, {
      toValue: 1.0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (playerState.isPlaying) {
      startRotation();
      startPulse();
    } else {
      stopRotation();
      stopPulse();
    }
  }, [playerState.isPlaying, startRotation, stopRotation, startPulse, stopPulse]);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── Auto-play on mount ─────────────────────────────────────────────────────
  useEffect(() => {
    if (hasAutoPlayed) return;
    const queue = params.queue;
    const queueIndex = params.queueIndex;
    if (!queue || queue.length === 0) {
      setHasAutoPlayed(true);
      showToast({
        tone: 'error',
        title: "Couldn't open this song",
        message: 'The song list is unavailable. Please go back and try again.',
      });
      return;
    }

    if (
      !Number.isInteger(queueIndex) ||
      queueIndex === undefined ||
      queueIndex < 0 ||
      queueIndex >= queue.length
    ) {
      setHasAutoPlayed(true);
      showToast({
        tone: 'error',
        title: "Couldn't open this song",
        message: 'The song selection is no longer available. Please go back and try again.',
      });
      return;
    }

    const targetItem = queue[queueIndex];
    const sameTrack =
      currentItem?.mediaType === 'audio' &&
      targetItem?.mediaType === 'audio' &&
      (
        String(currentItem.id ?? '') === String(targetItem.id ?? '') ||
        String(currentItem.contentId ?? currentItem.id ?? '') ===
          String(targetItem.contentId ?? targetItem.id ?? '')
      );

    // Opening the full player for the already-active logical audio item must
    // not reset playback to 0 (notably for ids such as "123:audio").
    if (sameTrack) {
      setHasAutoPlayed(true);
      return;
    }

    setHasAutoPlayed(true);
    playQueue(queue, queueIndex).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────
  const displayTitle = currentItem?.title ?? params.title ?? 'Unknown';
  const displayArtist = currentItem?.artistName ?? params.artist ?? 'Unknown';
  const rawImage = currentItem?.artworkUrl ?? params.imageUrl;
  const resolvedImage = React.useMemo(
    () => (rawImage ? resolveAppImageUrl(rawImage, 'song') : FALLBACK_ARTWORK),
    [rawImage]
  );
  const [imageError, setImageError] = useState(false);
  const displayImage = imageError ? FALLBACK_ARTWORK : resolvedImage;

  useEffect(() => {
    setImageError(false);
  }, [resolvedImage]);

  const isDraggingRef = useRef(false);
  const lastScrubUpdateMsRef = useRef(0);
  const lastScrubSecondRef = useRef(-1);

  // Reset scrub and drag state whenever active track changes
  const activeTrackKey = currentItem?.id ?? currentItem?.contentId ?? null;
  useEffect(() => {
    setScrubPosition(null);
    isDraggingRef.current = false;
  }, [activeTrackKey]);

  const durationKnown = hasFiniteDuration(playerState.durationMs);
  const enginePositionForUi =
    pendingSeekPositionMs !== null
      ? pendingSeekPositionMs
      : playerState.positionMs;
  const positionForUi =
    scrubPosition !== null ? scrubPosition : enginePositionForUi;
  const sliderValue = durationKnown
    ? Math.min(Math.max(positionForUi, 0), playerState.durationMs)
    : 0;

  // ── Seek ───────────────────────────────────────────────────────────────────
  const onSeekStart = useCallback(() => {
    isDraggingRef.current = true;
    lastScrubSecondRef.current = Math.floor(enginePositionForUi / 1000);
    lastScrubUpdateMsRef.current = Date.now();
    setScrubPosition(enginePositionForUi);
  }, [enginePositionForUi]);

  const onSeekChange = useCallback((v: number) => {
    isDraggingRef.current = true;
    const bounded = Math.max(0, Math.min(Math.round(v), playerState.durationMs || 0));
    const now = Date.now();
    const currentSecond = Math.floor(bounded / 1000);
    if (
      currentSecond !== lastScrubSecondRef.current ||
      now - lastScrubUpdateMsRef.current >= 32
    ) {
      lastScrubSecondRef.current = currentSecond;
      lastScrubUpdateMsRef.current = now;
      setScrubPosition(bounded);
    }
  }, [playerState.durationMs]);

  const onSeekComplete = useCallback(
    (v: number) => {
      isDraggingRef.current = false;
      lastScrubSecondRef.current = -1;
      const target = Math.max(0, Math.min(Math.round(v), playerState.durationMs || 0));
      // Keep the user's scrub value visible until the provider has registered
      // the pending seek target. No fixed timing window is involved.
      setScrubPosition(target);
      seekTo(target)
        .catch(() => undefined)
        .finally(() => {
          setScrubPosition(null);
          isDraggingRef.current = false;
        });
    },
    [playerState.durationMs, seekTo]
  );

  const stopAndGoToAudio = useCallback(async () => {
    await close();
    if (!navigationRef.isReady()) return;
    (navigationRef as any).navigate('MainTabs', {
      screen: 'AudioTab',
      params: {
        screen: 'AudioIndex',
      },
    });
  }, [close]);

  // ── Glow opacity ──────────────────────────────────────────────────────────
  const glowOpacity = pulseAnim.interpolate({
    inputRange: [1.0, 1.05],
    outputRange: [0.25, 0.45],
  });

  return (
    <View style={styles.root}>
      {/* Blurred background */}
      <ImageBackground
        source={{ uri: displayImage }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onError={() => setImageError(true)}
      >
        <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(0,0,0,0.32)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.98)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <SafeAreaView
        style={[
          styles.safeArea,
          {
            paddingBottom: bottomPadding,
          },
        ]}
        edges={['top']}
      >
        <View style={styles.contentContainer}>
          {/* ── Top Bar ── */}
          <View style={styles.topBar}>
            <Pressable
              style={styles.topIconBtn}
              onPress={() => navigation.goBack()}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <ArrowLeft size={22} color="#fff" />
            </Pressable>

            <View style={styles.topCenter}>
              <Text style={styles.topHeading}>NOW PLAYING</Text>
            </View>

            <View style={styles.topRight}>
              <Pressable
                style={styles.topIconBtn}
                onPress={() => setIsHearted((v) => !v)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Favorite"
              >
                <HeartIcon
                  size={22}
                  filled={isHearted}
                  color={isHearted ? (theme?.primary || Colors.accent) : '#fff'}
                />
              </Pressable>
              <Pressable
                style={styles.topIconBtn}
                onPress={() => stopAndGoToAudio().catch(() => undefined)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close player"
              >
                <X size={22} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* ── Center Section: Disc & Song Info ── */}
          <View style={styles.centerSection}>
            {/* ── Disc / Artwork with amber rim ── */}
            <View style={[styles.discOuterRim, { width: rimSize, height: rimSize, borderRadius: rimSize / 2 }]}>
              {/* Glow ring */}
              <Animated.View
                style={[
                  styles.discGlow,
                  {
                    width: rimSize,
                    height: rimSize,
                    borderRadius: rimSize / 2,
                    backgroundColor: theme?.primary || Colors.accent,
                    transform: [{ scale: pulseAnim }],
                    opacity: glowOpacity,
                  },
                ]}
              />
              {/* Concentric platter rim */}
              <View
                style={[
                  styles.discRimLayer,
                  {
                    width: rimSize,
                    height: rimSize,
                    borderRadius: rimSize / 2,
                    borderColor: `${theme?.primary || Colors.accent}45`,
                  },
                ]}
              >
                {/* Circular album artwork */}
                <Animated.Image
                  source={{ uri: displayImage }}
                  style={[
                    styles.disc,
                    {
                      width: artSize,
                      height: artSize,
                      borderRadius: artSize / 2,
                      transform: [{ rotate: spin }],
                    },
                  ]}
                  resizeMode="cover"
                  onError={() => setImageError(true)}
                />
              </View>
            </View>

            {/* ── Song Info: Clearly separated from artwork ── */}
            <View style={[styles.songInfo, { marginTop: artworkToTitleGap }]}>
              <Text style={styles.songTitle} numberOfLines={1} ellipsizeMode="tail">
                {displayTitle}
              </Text>
              <Text style={styles.songArtist} numberOfLines={1} ellipsizeMode="tail">
                {displayArtist}
              </Text>
            </View>
          </View>

          {/* ── Bottom Section: Seek Bar & Controls ── */}
          <View style={[styles.bottomSection, { marginTop: isShortScreen ? 12 : 20 }]}>
            {/* ── Seek Bar (Slider above timestamps) ── */}
            <View style={styles.seekSection}>
              <Slider
                key={`audio-slider-${currentItem?.id ?? 'track'}-${durationKnown ? playerState.durationMs : 0}`}
                style={styles.seekSlider}
                minimumValue={0}
                maximumValue={durationKnown ? playerState.durationMs : 1}
                step={1}
                value={sliderValue}
                tapToSeek={true}
                disabled={!durationKnown}
                minimumTrackTintColor={theme?.primary || Colors.accent}
                maximumTrackTintColor="rgba(255,255,255,0.20)"
                thumbTintColor={theme?.primary || Colors.accent}
                onSlidingStart={onSeekStart}
                onValueChange={onSeekChange}
                onSlidingComplete={onSeekComplete}
              />
              <View style={styles.timesRow}>
                <Text style={styles.timeText}>{formatDurationLabel(positionForUi, '00:00')}</Text>
                <Text style={styles.timeText}>
                  {durationKnown ? formatDurationLabel(playerState.durationMs, '--:--') : '--:--'}
                </Text>
              </View>
            </View>

            {/* ── Playback Controls: Balanced 5-button row with clear gaps ── */}
            <View style={[styles.controlsRow, { marginTop: isShortScreen ? 14 : 22 }]}>
              <Pressable
                style={styles.auxControlBtn}
                onPress={() => toggleShuffle()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Shuffle"
              >
                <ShuffleIcon
                  size={17}
                  color={playerState.isShuffle ? (theme?.primary || Colors.accent) : 'rgba(255,255,255,0.65)'}
                />
              </Pressable>

              <Pressable
                style={styles.skipBtn}
                onPress={() => skipPrev().catch(() => undefined)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Previous track"
              >
                <SkipPrevIcon size={20} color="#fff" />
              </Pressable>

              <Pressable
                style={styles.playPauseBtn}
                onPress={() => togglePlayPause().catch(() => undefined)}
                accessibilityRole="button"
                accessibilityLabel={playerState.isPlaying ? "Pause" : "Play"}
              >
                {playerState.isPlaying
                  ? <PauseIcon size={25} color="#000" />
                  : <PlayIcon size={25} color="#000" />}
              </Pressable>

              <Pressable
                style={styles.skipBtn}
                onPress={() => skipNext().catch(() => undefined)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Next track"
              >
                <SkipNextIcon size={20} color="#fff" />
              </Pressable>

              <Pressable
                style={styles.auxControlBtn}
                onPress={() => cycleRepeatMode()}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Repeat mode"
              >
                <RepeatIcon
                  size={17}
                  color={playerState.repeatMode !== 'off' ? (theme?.primary || Colors.accent) : 'rgba(255,255,255,0.65)'}
                  one={playerState.repeatMode === 'one'}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  bottomSection: {
    width: '100%',
  },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 48,
  },
  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topHeading: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // ── Circular Artwork & Rim ──
  discOuterRim: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  discGlow: {
    position: 'absolute',
  },
  discRimLayer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(120, 53, 15, 0.32)',
    borderWidth: 1.5,
  },
  disc: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  // ── Song Info ──
  songInfo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '100%',
  },
  songTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  songArtist: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },

  // ── Seek ──
  seekSection: {
    width: '100%',
  },
  seekSlider: {
    width: '100%',
    height: 28,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 2,
  },
  timeText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Playback Controls ──
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    width: '100%',
  },
  auxControlBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
});

