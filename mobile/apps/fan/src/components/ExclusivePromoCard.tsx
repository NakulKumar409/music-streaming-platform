import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from './PrimaryButton';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

interface ExclusivePromoCardProps {
  onAction: () => void;
}

export default function ExclusivePromoCard({ onAction }: ExclusivePromoCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.98,
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
          colors={colors.darkGlassGradient}
          style={styles.gradient}
        >
          <View style={styles.contentRow}>
            <View style={styles.lockContainer}>
              <Lock color={colors.secondary} size={28} />
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.heading}>
                Unlock exclusive releases before everyone else!
              </Text>
              <Text style={styles.description}>
                Subscribe directly to artists and access their latest songs and videos early.
              </Text>
            </View>
          </View>

          <PrimaryButton
            title="Explore Subscriptions"
            onPress={onAction}
            style={styles.button}
          />
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    marginHorizontal: spacing.horizontalPadding,
    marginBottom: spacing.sectionSpacing,
  },
  container: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    padding: spacing.lg,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  lockContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.25)',
  },
  textContainer: {
    flex: 1,
  },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.cardTitle + 1,
    fontWeight: typography.weightBold,
    lineHeight: 20,
    marginBottom: 4,
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.metadata,
    lineHeight: 16,
  },
  button: {
    width: '100%',
  },
});
