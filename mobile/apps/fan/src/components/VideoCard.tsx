import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Play } from 'lucide-react-native';
import ImageFallback from './ImageFallback';
import { resolveAppImageUrl, FALLBACK_BANNER } from '../utils/imageUtils';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

interface VideoCardProps {
  video: {
    title: string;
    artistName: string;
    thumbnail: any;
    duration?: string;
    viewCount: string;
  };
  onAction: () => void;
}

export default function VideoCard({ video, onAction }: VideoCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onAction}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        <View style={styles.thumbnailContainer}>
          <ImageFallback
            source={
              typeof video.thumbnail === 'string'
                ? { uri: resolveAppImageUrl(video.thumbnail, 'video') }
                : (video.thumbnail?.uri
                ? { uri: resolveAppImageUrl(video.thumbnail.uri, 'video') }
                : video.thumbnail)
            }
            style={styles.thumbnail}
            resizeMode="contain"
          />
          <View style={styles.playOverlay} pointerEvents="none">
            <View style={styles.playCircle}>
              <Play color="#FFFFFF" size={15} fill="#FFFFFF" style={styles.playIcon} />
            </View>
          </View>
          {video.duration ? (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{video.duration}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {video.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {video.artistName}
          </Text>
          <Text style={styles.views}>{video.viewCount}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginRight: 12,
    width: 210,
  },
  container: {
    width: '100%',
    backgroundColor: '#0C0D18',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.28)',
    padding: 6,
  },
  thumbnailContainer: {
    width: '100%',
    height: 118,
    position: 'relative',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  playCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    marginLeft: 2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 4,
    zIndex: 10,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  infoContainer: {
    paddingTop: 8,
    paddingHorizontal: 3,
    paddingBottom: 4,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  artist: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  views: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    fontWeight: '400',
    marginTop: 2,
  },
});
