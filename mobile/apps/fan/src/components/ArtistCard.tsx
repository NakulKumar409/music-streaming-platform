import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck } from 'lucide-react-native';
import ImageFallback from './ImageFallback';
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
          colors={colors.magentaPurpleGradient}
          style={styles.avatarBorder}
        >
          <View style={styles.avatarInner}>
            <ImageFallback
              source={artist.image}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          </View>
        </LinearGradient>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {artist.name}
          </Text>
          {artist.isVerified && (
            <BadgeCheck color={colors.highlight} size={15} fill="rgba(6, 182, 212, 0.1)" />
          )}
        </View>
        <Text style={styles.subscribers} numberOfLines={1}>
          {artist.subscriberCount}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginRight: spacing.cardGap,
    alignItems: 'center',
    width: 90,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },
  avatarBorder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: colors.backgroundCard,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: '100%',
  },
  name: {
    color: colors.textPrimary,
    fontSize: typography.cardTitle - 1,
    fontWeight: typography.weightBold,
    textAlign: 'center',
    flexShrink: 1,
  },
  subscribers: {
    color: colors.textMuted,
    fontSize: typography.metadata - 1,
    marginTop: 2,
    textAlign: 'center',
  },
});
