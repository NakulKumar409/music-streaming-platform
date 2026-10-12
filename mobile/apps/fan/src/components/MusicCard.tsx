import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Play } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ImageFallback from './ImageFallback';
import { resolveAppImageUrl, FALLBACK_ARTWORK } from '../utils/imageUtils';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

interface MusicCardProps {
  track: {
    title: string;
    artistName: string;
    artwork: any;
    duration?: string;
    badge?: 'EARLY_ACCESS' | 'PREMIUM' | 'NEW';
  };
  onAction: () => void;
}

export default function MusicCard({ track, onAction }: MusicCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.96,
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

  const renderBadge = () => {
    if (!track.badge) return null;
    let label: string = track.badge;
    let badgeBg = '#7C3AED';
    let badgeText = '#FFFFFF';

    if (track.badge === 'NEW') {
      label = 'NEW';
      badgeBg = '#7C3AED';
    } else if (track.badge === 'PREMIUM') {
      label = 'PREMIUM';
      badgeBg = colors.secondary;
    } else if (track.badge === 'EARLY_ACCESS') {
      label = 'EARLY ACCESS';
      badgeBg = colors.primary;
    }

    return (
      <View style={[styles.badgeContainer, { backgroundColor: badgeBg }]}>
        <Text style={[styles.badgeText, { color: badgeText }]}>{label}</Text>
      </View>
    );
  };

  return (
    <Pressable
      onPress={onAction}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        {/* Neon purple, electric blue and cyan gradient border */}
        <LinearGradient
          colors={['#8B5CF6', '#3B82F6', '#06B6D4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientBorder}
        >
          <View style={styles.imageContainer}>
            <ImageFallback
              source={
                typeof track.artwork === 'string'
                  ? { uri: resolveAppImageUrl(track.artwork, 'song') }
                  : (track.artwork?.uri
                  ? { uri: resolveAppImageUrl(track.artwork.uri, 'song') }
                  : track.artwork)
              }
              style={styles.artwork}
              resizeMode="contain"
            />
            {renderBadge()}
            <View style={styles.playOverlay} pointerEvents="none">
              <View style={styles.playCircle}>
                <Play color="#FFFFFF" size={15} fill="#FFFFFF" style={styles.playIcon} />
              </View>
            </View>
            {track.duration ? (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{track.duration}</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artistName}
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
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 14.5,
    overflow: 'hidden',
  },
  artwork: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  badgeContainer: {
    position: 'absolute',
    top: 7,
    left: 7,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    zIndex: 10,
  },
  badgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
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
