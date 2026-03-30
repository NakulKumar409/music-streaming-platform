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
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Path, Rect, Circle } from 'react-native-svg';

import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import { Colors } from '../theme';
import type { MediaItem } from '../media.types';

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

  const {
    currentItem,
    state: playerState,
    playQueue,
    togglePlayPause,
    skipNext,
    skipPrev,
    seekTo,
    setVolume,
  } = useMediaPlayer();

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [isSeeking, setIsSeeking] = useState(false);
  const seekValueRef = useRef(0);
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
          toValue: 1.06,
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
    const queueIndex = params.queueIndex ?? 0;
    if (!queue || queue.length === 0) return;

    const currentKey =
      currentItem?.mediaType === 'audio'
        ? String(currentItem.contentId ?? currentItem.id ?? '')
        : '';
    const targetKey = params.songId ?? '';

    // Already playing the right song — don't restart
    if (currentKey && targetKey && currentKey === targetKey && playerState.isPlaying) {
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
  const displayImage = currentItem?.artworkUrl ?? params.imageUrl ?? FALLBACK_ARTWORK;

  const positionForUi = isSeeking ? seekValueRef.current : playerState.positionMs;

  const formatTime = useCallback((ms: number) => {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }, []);

  // ── Seek ───────────────────────────────────────────────────────────────────
  const onSeekStart = useCallback(() => {
    setIsSeeking(true);
    seekValueRef.current = playerState.positionMs;
  }, [playerState.positionMs]);

  const onSeekChange = useCallback((v: number) => {
    seekValueRef.current = v;
  }, []);

  const onSeekComplete = useCallback(
    (v: number) => {
      setIsSeeking(false);
      seekTo(v).catch(() => undefined);
    },
    [seekTo]
  );


  // ── Glow opacity ──────────────────────────────────────────────────────────
  const glowOpacity = pulseAnim.interpolate({
    inputRange: [1.0, 1.06],
    outputRange: [0.3, 0.55],
  });

  return (
    <View style={styles.root}>
      {/* Blurred background */}
      <ImageBackground
        source={{ uri: displayImage || FALLBACK_ARTWORK }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      >
        <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(0,0,0,0.30)', 'rgba(0,0,0,0.72)', 'rgba(0,0,0,0.97)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>

        {/* ── Top Bar ── */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.topIconBtn}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <ArrowLeft size={22} color="#fff" />
          </Pressable>

          <View style={styles.topCenter}>
            <Text style={styles.topLabel}>Now Playing</Text>
            <Text style={styles.topTitle} numberOfLines={1}>{displayTitle}</Text>
          </View>

          <Pressable
            style={styles.topIconBtn}
            onPress={() => setIsHearted((v) => !v)}
            hitSlop={10}
          >
            <HeartIcon
              size={22}
              filled={isHearted}
              color={isHearted ? Colors.accent : '#fff'}
            />
          </Pressable>
        </View>

        {/* ── Disc / Artwork ── */}
        <View style={styles.discContainer}>
          {/* Glow ring */}
          <Animated.View
            style={[
              styles.discGlow,
              { transform: [{ scale: pulseAnim }], opacity: glowOpacity },
            ]}
          />
          {/* Spinning disc */}
          <Animated.Image
            source={{ uri: displayImage || FALLBACK_ARTWORK }}
            style={[styles.disc, { transform: [{ rotate: spin }] }]}
            resizeMode="cover"
          />
          {/* Center hole */}
          <View style={styles.discHole} />
        </View>

        {/* ── Song Info ── */}
        <View style={styles.songInfo}>
          <Text style={styles.songTitle} numberOfLines={1}>{displayTitle}</Text>
          <Text style={styles.songArtist} numberOfLines={1}>{displayArtist}</Text>
        </View>


        {/* ── Seek Bar ── */}
        <View style={styles.seekSection}>
          <View style={styles.timesRow}>
            <Text style={styles.timeText}>{formatTime(positionForUi)}</Text>
            <Text style={styles.timeText}>{formatTime(playerState.durationMs)}</Text>
          </View>
          <Slider
            style={styles.seekSlider}
            minimumValue={0}
            maximumValue={Math.max(1, playerState.durationMs || 1)}
            value={Math.min(positionForUi, playerState.durationMs || 1)}
            minimumTrackTintColor={Colors.accent}
            maximumTrackTintColor="rgba(255,255,255,0.20)"
            thumbTintColor={Colors.accent}
            onSlidingStart={onSeekStart}
            onValueChange={onSeekChange}
            onSlidingComplete={onSeekComplete}
          />
        </View>

        {/* ── Playback Controls ── */}
        <View style={styles.controlsRow}>
          <Pressable
            style={styles.skipBtn}
            onPress={() => skipPrev().catch(() => undefined)}
            hitSlop={10}
          >
            <SkipPrevIcon size={24} color="#fff" />
          </Pressable>

          <Pressable
            style={[styles.playPauseBtn, playerState.isPlaying && styles.playPauseBtnActive]}
            onPress={() => togglePlayPause().catch(() => undefined)}
          >
            {playerState.isPlaying
              ? <PauseIcon size={30} color="#000" />
              : <PlayIcon size={30} color="#000" />}
          </Pressable>

          <Pressable
            style={styles.skipBtn}
            onPress={() => skipNext().catch(() => undefined)}
            hitSlop={10}
          >
            <SkipNextIcon size={24} color="#fff" />
          </Pressable>
        </View>


      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1, paddingHorizontal: 24 },

  // ── Top Bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 12,
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
    paddingHorizontal: 8,
  },
  topLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  topTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },

  // ── Disc ──
  discContainer: {
    alignSelf: 'center',
    width: DISC_SIZE,
    height: DISC_SIZE,
    marginTop: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discGlow: {
    position: 'absolute',
    width: DISC_SIZE + 44,
    height: DISC_SIZE + 44,
    borderRadius: (DISC_SIZE + 44) / 2,
    backgroundColor: Colors.accent,
  },
  disc: {
    width: DISC_SIZE,
    height: DISC_SIZE,
    borderRadius: DISC_SIZE / 2,
    borderWidth: 5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  discHole: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#111',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.20)',
  },

  songInfo: {
    alignItems: 'center',
    marginVertical: 32,
    paddingHorizontal: 8,
  },
  songTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  songArtist: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 5,
    textAlign: 'center',
  },


  // ── Seek ──
  seekSection: {
    marginTop: 24,
  },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  timeText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '800',
  },
  seekSlider: {
    width: '100%',
    height: 24,
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    marginTop: 32,
  },
  skipBtn: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  playPauseBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 10,
  },
  playPauseBtnActive: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.60,
  },


});
