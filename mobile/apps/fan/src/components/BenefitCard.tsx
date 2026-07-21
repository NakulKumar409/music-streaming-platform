import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Music, Sparkles, Heart, PlayCircle } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

interface BenefitCardProps {
  benefit: {
    title: string;
    description: string;
    iconName: string;
  };
  onAction: () => void;
}

export default function BenefitCard({ benefit, onAction }: BenefitCardProps) {
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

  const getColors = () => {
    if (benefit.iconName === 'Music') {
      return { bg: 'rgba(124, 58, 237, 0.15)', border: 'rgba(124, 58, 237, 0.3)', icon: '#C084FC' };
    }
    if (benefit.iconName === 'Sparkles') {
      return { bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)', icon: '#F472B6' };
    }
    if (benefit.iconName === 'Heart') {
      return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', icon: '#34D399' };
    }
    return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', icon: '#60A5FA' };
  };

  const themeColors = getColors();

  const renderIcon = () => {
    const iconSize = 20;
    if (benefit.iconName === 'Music') return <Music color={themeColors.icon} size={iconSize} />;
    if (benefit.iconName === 'Sparkles') return <Sparkles color={themeColors.icon} size={iconSize} />;
    if (benefit.iconName === 'Heart') return <Heart color={themeColors.icon} size={iconSize} fill={themeColors.icon} />;
    return <PlayCircle color={themeColors.icon} size={iconSize} />;
  };

  return (
    <Pressable
      onPress={onAction}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.pressable}
    >
      <Animated.View style={[styles.container, { transform: [{ scale }] }]}>
        <View style={[styles.iconContainer, { backgroundColor: themeColors.bg, borderColor: themeColors.border }]}>
          {renderIcon()}
        </View>
        <Text style={styles.title} numberOfLines={1}>
          {benefit.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {benefit.description}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    minWidth: '45%',
    margin: spacing.xs,
  },
  container: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderThin,
    padding: spacing.md,
    height: 120,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.15)',
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.cardTitle,
    fontWeight: typography.weightBold,
    marginBottom: 2,
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.metadata,
    lineHeight: 16,
  },
});
