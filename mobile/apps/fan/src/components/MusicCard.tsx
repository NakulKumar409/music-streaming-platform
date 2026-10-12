import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Play } from 'lucide-react-native';
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
    let badgeBg = '#6366F1';
    let badgeText = '#FFFFFF';

    if (track.badge === 'NEW') {
      label = 'NEW';
      badgeBg = '#6366F1';
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
    width: 154,
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
  imageContainer: {
    width: '100%',
    height: 116,
    position: 'relative',
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    overflow: 'hidden',
  },
  artwork: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000000',
  },
  badgeContainer: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    zIndex: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
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
});
