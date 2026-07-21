import React, { useRef } from 'react';
import { Text, Pressable, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  style?: any;
  showPlayIcon?: boolean;
}

export default function PrimaryButton({ title, onPress, style, showPlayIcon }: PrimaryButtonProps) {
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

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.pressable, style]}
    >
      <Animated.View style={[styles.animatedContainer, { transform: [{ scale }] }]}>
        <LinearGradient
          colors={colors.purpleBlueGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          {showPlayIcon && <Play color="#FFFFFF" size={14} fill="#FFFFFF" style={styles.playIcon} />}
          <Text style={styles.text}>{title}</Text>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  animatedContainer: {
    width: '100%',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  gradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  playIcon: {
    marginRight: 6,
  },
  text: {
    color: colors.textPrimary,
    fontSize: typography.buttonText,
    fontWeight: typography.weightBold,
  },
});
