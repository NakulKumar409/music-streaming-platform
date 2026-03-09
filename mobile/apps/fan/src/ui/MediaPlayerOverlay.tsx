import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Pause, Play, SkipForward, X } from 'lucide-react-native';
import { Video, ResizeMode } from 'expo-av';
import Slider from '@react-native-community/slider';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AVPlaybackStatus } from 'expo-av';
import type { MediaItem, PlayerState } from '../media.types';
import YouTubeVideoControlsOverlay from './YouTubeVideoControlsOverlay';
import { Colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MediaPlayerOverlay({
  bottomSafeAreaPadding,
  state,
  currentItem,
  togglePlayPause,
  skipNext,
  skipPrev,
  seekTo,
  toggleShuffle,
  cycleRepeatMode,
  setPlaybackRate,
  setVolume,
  close,
  setExpanded,
  inlineVideoHostActive,
  onVideoPlaybackStatusUpdate,
  videoRef,
}: {
  bottomSafeAreaPadding?: number;
  state: PlayerState;
  currentItem: MediaItem | null;
  togglePlayPause: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrev: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  setPlaybackRate: (rate: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  close: () => Promise<void>;
  setExpanded: (expanded: boolean) => void;
  inlineVideoHostActive: boolean;
  onVideoPlaybackStatusUpdate: (status: AVPlaybackStatus) => void;
  videoRef: React.RefObject<Video>;
}) {
  const insets = useSafeAreaInsets();

  const [expandedVideoAspectRatio, setExpandedVideoAspectRatio] = useState(16 / 9);

  const isVisible = Boolean(currentItem);

  const bottomOffset = useMemo(() => {
    const extra = bottomSafeAreaPadding ?? 0;
    return Math.max(insets.bottom, 0) + 84 + extra;
  }, [bottomSafeAreaPadding, insets.bottom]);

  const [isSeeking, setIsSeeking] = useState(false);
  const seekValueRef = useRef<number>(0);

  const positionForUi = isSeeking ? seekValueRef.current : state.positionMs;

  const onSeekStart = useCallback(() => {
    setIsSeeking(true);
    seekValueRef.current = state.positionMs;
  }, [state.positionMs]);

  const onSeekChange = useCallback((value: number) => {
    seekValueRef.current = value;
  }, []);

  const onSeekComplete = useCallback(
    (value: number) => {
      setIsSeeking(false);
      seekTo(value).catch(() => undefined);
    },
    [seekTo]
  );

  const cycleSpeed = useCallback(() => {
    const current = state.playbackRate;
    const next = current <= 0.5 ? 1 : current <= 1 ? 1.5 : current <= 1.5 ? 2 : 0.5;
    setPlaybackRate(next).catch(() => undefined);
  }, [setPlaybackRate, state.playbackRate]);

  if (!isVisible || !currentItem) return null;

  if (currentItem.mediaType === 'video' && state.isExpanded) {
    return (
      <View pointerEvents="box-none" style={styles.root}>
        <LinearGradient
          colors={Colors.backgroundGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[
            styles.videoContainer,
            {
              paddingTop: insets.top + 8,
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.9)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']}
            style={styles.videoTopGradient}
          />

          <View style={styles.videoTopRow}>
            <Pressable
              onPress={() => setExpanded(false)}
              style={[styles.videoTopBtn, { marginRight: 10 }]}
            >
              <Text style={styles.videoTopBtnText}>Minimize</Text>
            </Pressable>
            <Pressable onPress={close} style={styles.videoTopBtn}>
              <X color="#fff" size={18} />
            </Pressable>
          </View>

          <View style={[styles.videoFrame, { aspectRatio: expandedVideoAspectRatio }]}>
            <Video
              key={`${currentItem.mediaUrl}-${expandedVideoAspectRatio}`}
              ref={videoRef}
              style={{ width: '100%', height: undefined, aspectRatio: expandedVideoAspectRatio }}
              source={{ uri: currentItem.mediaUrl }}
              shouldPlay={state.isPlaying}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls={false}
              progressUpdateIntervalMillis={100}
              onPlaybackStatusUpdate={onVideoPlaybackStatusUpdate}
              onReadyForDisplay={(e) => {
                const size = (e as any)?.naturalSize;
                const w = Number(size?.width ?? 0);
                const h = Number(size?.height ?? 0);
                if (w > 0 && h > 0) {
                  const ratio = w / h;
                  if (Number.isFinite(ratio) && ratio > 0) setExpandedVideoAspectRatio(ratio);
                  return;
                }
                setExpandedVideoAspectRatio(16 / 9);
              }}
            />

            <YouTubeVideoControlsOverlay
              isPlaying={state.isPlaying}
              positionMs={state.positionMs}
              durationMs={state.durationMs}
              onTogglePlay={() => {
                togglePlayPause().catch(() => undefined);
              }}
              onSeek={(pos) => {
                seekTo(pos).catch(() => undefined);
              }}
              isFullscreen={true}
              onToggleFullscreen={() => setExpanded(false)}
            />
          </View>

          <View style={styles.videoMeta}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {currentItem.title}
            </Text>
            <Text style={styles.videoArtist} numberOfLines={1}>
              {currentItem.artistName ?? 'Artist'}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (currentItem.mediaType === 'video' && inlineVideoHostActive) {
    return null;
  }

  if (currentItem.mediaType === 'video') {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={[styles.miniWrap, { bottom: bottomOffset }]}>
        <BlurView intensity={26} tint="dark" style={styles.miniPlayer}>
          <Pressable onPress={() => setExpanded(currentItem.mediaType === 'video')}>
            <Image
              source={{ uri: currentItem.artworkUrl || undefined }}
              style={styles.miniThumb}
            />
          </Pressable>

          <Pressable
            style={styles.miniMeta}
            onPress={() => setExpanded(currentItem.mediaType === 'video')}
          >
            <Text style={styles.miniTitle} numberOfLines={1}>
              {currentItem.title}
            </Text>
            <Text style={styles.miniArtist} numberOfLines={1}>
              {currentItem.artistName ?? 'Artist'}
            </Text>
            <View style={styles.progressRow}>
              <Text style={styles.timeText}>{formatTime(positionForUi)}</Text>
              <Text style={styles.timeText}>{formatTime(state.durationMs)}</Text>
            </View>

            <View style={styles.sliderRow}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={Math.max(1, state.durationMs || 1)}
                value={Math.min(positionForUi, state.durationMs || 1)}
                minimumTrackTintColor="#FFFFFF"
                maximumTrackTintColor="rgba(255,255,255,0.18)"
                thumbTintColor="#FFFFFF"
                onSlidingStart={onSeekStart}
                onValueChange={onSeekChange}
                onSlidingComplete={onSeekComplete}
              />
            </View>

            <View style={styles.controlRow}>
              <Pressable
                onPress={toggleShuffle}
                style={[styles.pillBtn, state.isShuffle && styles.pillBtnActive]}
              >
                <Text style={[styles.pillText, state.isShuffle && styles.pillTextActive]}>Shuffle</Text>
              </Pressable>

              <Pressable
                onPress={cycleRepeatMode}
                style={[styles.pillBtn, state.repeatMode !== 'off' && styles.pillBtnActive]}
              >
                <Text
                  style={[styles.pillText, state.repeatMode !== 'off' && styles.pillTextActive]}
                >
                  {state.repeatMode === 'one' ? 'Repeat 1' : state.repeatMode === 'all' ? 'Repeat' : 'Repeat'}
                </Text>
              </Pressable>

              <Pressable onPress={cycleSpeed} style={styles.pillBtn}>
                <Text style={styles.pillText}>{state.playbackRate.toFixed(1)}x</Text>
              </Pressable>
            </View>

            <View style={styles.volumeRow}>
              <Text style={styles.volumeLabel}>Vol</Text>
              <Slider
                style={styles.volumeSlider}
                minimumValue={0}
                maximumValue={1}
                value={state.volume}
                step={0.01}
                minimumTrackTintColor="rgba(255,255,255,0.9)"
                maximumTrackTintColor="rgba(255,255,255,0.18)"
                thumbTintColor="rgba(255,255,255,0.9)"
                onValueChange={(v) => setVolume(v).catch(() => undefined)}
              />
            </View>
          </Pressable>

          <Pressable onPress={skipPrev} style={styles.miniBtn}>
            <ArrowLeft color="#fff" size={20} />
          </Pressable>

          <Pressable onPress={togglePlayPause} style={styles.miniBtn}>
            {state.isPlaying ? (
              <Pause color="#fff" fill="#fff" size={22} />
            ) : (
              <Play color="#fff" fill="#fff" size={22} />
            )}
          </Pressable>

          <Pressable onPress={skipNext} style={styles.miniBtn}>
            <SkipForward color="#fff" size={20} />
          </Pressable>

          <Pressable onPress={close} style={styles.miniBtn}>
            <X color="#fff" size={18} />
          </Pressable>
        </BlurView>
      </View>
    </View>
  );
}

function progressWidth(positionMs: number, durationMs: number) {
  const p = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0;
  return `${Math.round(p * 100)}%`;
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = Math.floor(totalSeconds / 60);
  const ss = totalSeconds % 60;
  const m = mm < 10 ? `0${mm}` : `${mm}`;
  const s = ss < 10 ? `0${ss}` : `${ss}`;
  return `${m}:${s}`;
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 9000,
  },

  videoContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  videoTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 2,
  },
  videoTopRow: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    zIndex: 3,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  videoTopBtn: {
    height: 36,
    minWidth: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTopBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  videoFrame: {
    width: '100%',
    backgroundColor: Colors.backgroundAlt,
    alignSelf: 'center',
  },
  videoMeta: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  videoArtist: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
  },

  miniWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  miniPlayer: {
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(10,10,10,0.35)',
  },
  miniThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  miniMeta: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  miniTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  miniArtist: {
    marginTop: 2,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },
  progressRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '700',
  },
  sliderRow: {
    marginTop: 6,
  },
  slider: {
    width: '100%',
    height: 18,
  },
  controlRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pillBtn: {
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  pillBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(255,255,255,0.0)',
  },
  pillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  pillTextActive: {
    color: '#000',
  },
  volumeRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeLabel: {
    width: 30,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '800',
  },
  volumeSlider: {
    flex: 1,
    height: 18,
  },
  miniBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
