import React, { useRef } from 'react';
import { Text, Pressable, StyleSheet, Animated } from 'react-native';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

interface SecondaryButtonProps {
  title: string;
  onPress: () => void;
  style?: any;
}

export default function SecondaryButton({ title, onPress, style }: SecondaryButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 0.96,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.7,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.pressable, style]}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }], opacity }]}>
        <Text style={styles.text}>{title}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  container: {
    width: '100%',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderThin,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    color: colors.textPrimary,
    fontSize: typography.buttonText,
    fontWeight: typography.weightSemiBold,
  },
});
