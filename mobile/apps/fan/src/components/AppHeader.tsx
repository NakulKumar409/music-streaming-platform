import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { Search, User } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { typography } from '../theme-guest/typography';

interface AppHeaderProps {
  onAction: () => void;
}

export default function AppHeader({ onAction }: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
          resizeMode="cover"
        />
        <Text style={styles.title}>MusicWave</Text>
      </View>
      <View style={styles.right}>
        <Pressable onPress={onAction} style={styles.iconButton} hitSlop={10} accessibilityLabel="Search">
          <Search color={colors.textPrimary} size={22} />
        </Pressable>
        <Pressable onPress={onAction} style={styles.iconButton} hitSlop={10} accessibilityLabel="Account">
          <User color={colors.textPrimary} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.horizontalPadding,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sectionHeading,
    fontWeight: typography.weightBold,
    letterSpacing: 0.2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
