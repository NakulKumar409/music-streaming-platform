import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Play } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    viewCount?: string;
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
        <LinearGradient
          colors={['#8B5CF6', '#3B82F6', '#06B6D4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
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
            {video.viewCount ? (
              <View style={styles.viewsBadge}>
                <Text style={styles.viewsText}>{video.viewCount}</Text>
              </View>
            ) : null}
            {video.duration ? (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{video.duration}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {video.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {video.artistName}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginRight: 12,
    width: 142,
  },
  container: {
    width: '100%',
  },
  gradientBorder: {
    width: '100%',
    padding: 1.5,
    borderRadius: 16,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  thumbnailContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14.5,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    marginLeft: 2,
  },
  viewsBadge: {
    position: 'absolute',
    bottom: 7,
    left: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  viewsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: 7,
    right: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
  },
  artist: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
});
