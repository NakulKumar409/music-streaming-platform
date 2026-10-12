import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';
import ImageFallback from './ImageFallback';
import { resolveAppImageUrl, FALLBACK_ARTIST_AVATAR } from '../utils/imageUtils';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { typography } from '../theme-guest/typography';

interface ArtistCardProps {
  artist: {
    name: string;
    image: any;
    subscriberCount: string;
    isVerified: boolean;
  };
  onAction: () => void;
}

export default function ArtistCard({ artist, onAction }: ArtistCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.94,
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
          style={styles.avatarBorder}
        >
          <View style={styles.avatarInner}>
            <ImageFallback
              source={
                typeof artist.image === 'string'
                  ? { uri: resolveAppImageUrl(artist.image, 'artist') }
                  : (artist.image?.uri
                  ? { uri: resolveAppImageUrl(artist.image.uri, 'artist') }
                  : (artist.image || { uri: FALLBACK_ARTIST_AVATAR }))
              }
              fallbackSource={{ uri: FALLBACK_ARTIST_AVATAR }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          </View>
        </LinearGradient>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={2}>
            {artist.name}
          </Text>
          {artist.isVerified && (
            <BadgeCheck color="#06B6D4" size={12} fill="rgba(6, 182, 212, 0.15)" style={{ marginLeft: 2 }} />
          )}
        </View>
        {artist.subscriberCount ? (
          <Text style={styles.subscribers} numberOfLines={1}>
            {artist.subscriberCount}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginRight: 12,
    alignItems: 'center',
    width: 90,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },
  avatarBorder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    padding: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    overflow: 'hidden',
    backgroundColor: '#090D26',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 2,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  subscribers: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
});
