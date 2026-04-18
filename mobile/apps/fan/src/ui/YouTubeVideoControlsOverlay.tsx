import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import Slider from '@react-native-community/slider';
import { Maximize, Minimize, Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';
import { hasFiniteDuration } from '../utils/mediaTime';

function formatTime(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '--:--';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;

  if (hh > 0) {
    const m = mm < 10 ? `0${mm}` : `${mm}`;
    const s = ss < 10 ? `0${ss}` : `${ss}`;
    return `${hh}:${m}:${s}`;
  }

  const m = `${mm}`;
  const s = ss < 10 ? `0${ss}` : `${ss}`;
  return `${m}:${s}`;
}

export default function YouTubeVideoControlsOverlay({
  isPlaying,
  positionMs,
  durationMs,
  onTogglePlay,
  onSeek,
  onToggleFullscreen,
  isFullscreen,
  isVisible,
  onToggleVisibility,
  onInteraction,
}: {
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
  onTogglePlay: () => void;
  onSeek: (positionMs: number) => void;
  onToggleFullscreen: () => void;
  isFullscreen: boolean;
  isVisible: boolean;
  onToggleVisibility: () => void;
  onInteraction?: () => void;
}) {
  const [isSeeking, setIsSeeking] = useState(false);
  const seekValueRef = useRef(0);

  const uiPositionMs = isSeeking ? seekValueRef.current : positionMs;

  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const overlayTranslateY = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    (visible: boolean) => {
      overlayOpacity.stopAnimation();
      overlayTranslateY.stopAnimation();
      
      Animated.parallel([
        Animated.timing(overlayOpacity, {
          toValue: visible ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayTranslateY, {
          toValue: visible ? 0 : 4,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    },
    [overlayOpacity, overlayTranslateY]
  );

  useEffect(() => {
    animateTo(isVisible);
  }, [animateTo, isVisible]);

  const onSeekStart = useCallback(() => {
    setIsSeeking(true);
    seekValueRef.current = positionMs;
    onInteraction?.();
  }, [positionMs, onInteraction]);

  const onSeekChange = useCallback((value: number) => {
    seekValueRef.current = value;
    onInteraction?.();
  }, [onInteraction]);

  const onSeekComplete = useCallback(
    (value: number) => {
      setIsSeeking(false);
      onSeek(value);
      onInteraction?.();
    },
    [onSeek, onInteraction]
  );

  const safeDuration = useMemo(() => Math.max(1, durationMs || 1), [durationMs]);

  const skipBy = useCallback(
    (deltaMs: number) => {
      const next = Math.max(0, Math.min(safeDuration, positionMs + deltaMs));
      onSeek(next);
      onInteraction?.();
    },
    [onSeek, positionMs, safeDuration, onInteraction]
  );

  return (
    <View style={styles.touchLayer} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onToggleVisibility}>
        <View style={styles.tapCatcher} />
      </TouchableWithoutFeedback>

      <Animated.View
        pointerEvents={isVisible ? 'auto' : 'none'}
        style={[
          styles.overlay,
          {
            opacity: overlayOpacity,
            transform: [{ translateY: overlayTranslateY }],
          },
        ]}
      >
          <View style={styles.centerControlsRow} pointerEvents="box-none">
            <Pressable
              onPress={() => skipBy(-10_000)}
              onPressIn={onInteraction}
              style={styles.centerIconBtn}
              hitSlop={24}
            >
              <SkipBack size={34} color="#fff" />
              <Text style={styles.skipText}>10</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                onTogglePlay();
                onInteraction?.();
              }}
              onPressIn={onInteraction}
              style={styles.playBtn}
              hitSlop={28}
            >
              {isPlaying ? (
                <Pause size={52} color="#fff" fill="#fff" />
              ) : (
                <Play size={52} color="#fff" fill="#fff" />
              )}
            </Pressable>

            <Pressable
              onPress={() => skipBy(10_000)}
              onPressIn={onInteraction}
              style={styles.centerIconBtn}
              hitSlop={24}
            >
              <SkipForward size={34} color="#fff" />
              <Text style={styles.skipText}>10</Text>
            </Pressable>
          </View>

          <View style={styles.bottomBar} pointerEvents="box-none">
            <Text style={styles.timeText}>
              {formatTime(uiPositionMs)} / {formatTime(durationMs)}
            </Text>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={safeDuration}
              value={Math.min(uiPositionMs, safeDuration)}
              disabled={!hasFiniteDuration(durationMs)}
              minimumTrackTintColor="#FF0000"
              maximumTrackTintColor="rgba(255,255,255,0.25)"
              thumbTintColor={isSeeking ? '#FFFFFF' : 'rgba(255,255,255,0)'}
              onSlidingStart={onSeekStart}
              onValueChange={onSeekChange}
              onSlidingComplete={onSeekComplete}
            />

            <Pressable
              onPress={() => {
                onToggleFullscreen();
                onInteraction?.();
              }}
              onPressIn={onInteraction}
              style={styles.fullscreenBtn}
              hitSlop={24}
            >
              {isFullscreen ? (
                <Minimize size={20} color="#fff" />
              ) : (
                <Maximize size={20} color="#fff" />
              )}
            </Pressable>
          </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  tapCatcher: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'space-between',
    zIndex: 50,
    elevation: 50,
  },

  centerControlsRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 26,
    paddingHorizontal: 18,
  },
  playBtn: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    position: 'absolute',
    bottom: 6,
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.9,
  },

  bottomBar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.9,
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 14,
  },
  fullscreenBtn: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});
