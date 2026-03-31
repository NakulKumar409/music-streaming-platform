import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { navigationRef } from '../navigation/rootNavigation';
import { ArrowLeft, Pause, Play, SkipForward, X } from 'lucide-react-native';
import { VideoView, VideoPlayer } from 'expo-video';
import { AudioPlayer } from 'expo-audio';
import Slider from '@react-native-community/slider';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Removed AVPlaybackStatus as it is no longer used
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
  inlineAudioHostActive,
  onVideoPlaybackStatusUpdate,
  videoPlayer,
  audioPlayer,
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
  inlineAudioHostActive: boolean;
  onVideoPlaybackStatusUpdate: (status: any) => void;
  videoPlayer: VideoPlayer | null;
  audioPlayer: AudioPlayer | null;
}) {
  const insets = useSafeAreaInsets();

  const [expandedVideoAspectRatio, setExpandedVideoAspectRatio] = useState(16 / 9);
  const [currentRouteName, setCurrentRouteName] = useState<string | null>(null);

  useEffect(() => {
    const checkRoute = () => {
      const route = navigationRef.getCurrentRoute();
      if (route?.name) setCurrentRouteName(route.name);
    };

    // Initial check
    checkRoute();

    // Listen for state changes
    const unsub = navigationRef.addListener('state', checkRoute);
    return unsub;
  }, []);

  const isVisible = Boolean(currentItem) && currentRouteName !== 'FullPlayer';

  const bottomOffset = useMemo(() => {
    const extra = bottomSafeAreaPadding ?? 0;
    return Math.max(insets.bottom, 0) + 84 + extra;
  }, [bottomSafeAreaPadding, insets.bottom]);

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const audioPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => currentItem?.mediaType === 'audio',
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (currentItem?.mediaType !== 'audio') return false;
        return Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [
          null,
          { dx: pan.x, dy: pan.y }
        ],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const currentX = (pan.x as any)._value;
        const currentY = (pan.y as any)._value;
        
        const MIN_TOP_PADDING = Math.max(12, insets.top + 12);
        const ESTIMATED_PLAYER_HEIGHT = 68;
        const maxUp = -Math.max(0, Dimensions.get('window').height - bottomOffset - MIN_TOP_PADDING - ESTIMATED_PLAYER_HEIGHT);
        const minTop = maxUp; 
        const maxDown = 0; 
        
        const maxLeft = -14; 
        const maxRight = 14; 

        let nextX = Math.min(Math.max(maxLeft, currentX), maxRight);
        let nextY = Math.min(Math.max(minTop, currentY), maxDown);

        Animated.spring(pan, {
          toValue: { x: nextX, y: nextY },
          useNativeDriver: false,
          tension: 120,
          friction: 14,
        }).start();
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    });
  }, [pan, currentItem?.mediaType, bottomOffset, insets.top]);

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
            {videoPlayer && (
              <VideoView
                player={videoPlayer}
                style={{ width: '100%', height: undefined, aspectRatio: expandedVideoAspectRatio }}
                contentFit="contain"
                allowsFullscreen={true}
                allowsPictureInPicture={true}
              />
            )}

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

  if (inlineAudioHostActive) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <Animated.View
        style={[styles.miniWrap, { bottom: bottomOffset, transform: pan.getTranslateTransform() }]}
        {...(currentItem.mediaType === 'audio' ? audioPanResponder.panHandlers : {})}
      >
        <Pressable
          style={styles.miniPlayer}
          onPress={() => {
            if (currentItem.mediaType === 'video') {
              setExpanded(true);
              return;
            }

            if (!navigationRef.isReady()) return;

            const songId = String(currentItem.contentId ?? currentItem.id ?? '');

            (navigationRef as any).navigate('MainTabs', {
              screen: 'AudioTab',
              params: {
                screen: 'FullPlayer',
                params: {
                  songId,
                  title: currentItem.title,
                  artist: currentItem.artistName ?? 'Artist',
                  imageUrl: currentItem.artworkUrl ?? '',
                  audioUrl: currentItem.mediaUrl ?? '',
                  queueIndex: state.currentIndex,
                  queue: state.queue,
                },
              },
            });
          }}
        >
          <Image
            source={{ uri: currentItem.artworkUrl || 'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=400&q=80' }}
            style={styles.miniArt}
          />
          <View style={styles.miniMeta}>
            <Text style={styles.miniTitle} numberOfLines={1}>{currentItem.title}</Text>
            <Text style={styles.miniArtist} numberOfLines={1}>{currentItem.artistName ?? 'Artist'}</Text>
          </View>
          <Pressable
            style={styles.miniPlayBtn}
            onPress={() => togglePlayPause().catch(() => undefined)}
            hitSlop={8}
          >
            {state.isPlaying ? (
              <View style={styles.miniPauseIcon}>
                <View style={styles.miniPauseBar} />
                <View style={styles.miniPauseBar} />
              </View>
            ) : (
              <Play size={16} color="#000" />
            )}
          </Pressable>
        </Pressable>
      </Animated.View>
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
    zIndex: 9999,
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
    left: 14,
    right: 14,
  },
  miniPlayer: {
    height: 68,
    borderRadius: 18,
    backgroundColor: 'rgba(28,28,28,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 10,
  },
  miniArt: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  miniMeta: {
    flex: 1,
    minWidth: 0,
  },
  miniTitle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  miniArtist: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  miniPlayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniPauseIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniPauseBar: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#000',
  },
});
