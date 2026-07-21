import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Compass, Users, Library, User } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { radius } from '../theme-guest/radius';
import { typography } from '../theme-guest/typography';

interface BottomNavigationProps {
  onAction: () => void;
  onHomePress?: () => void;
}

export default function BottomNavigation({ onAction, onHomePress }: BottomNavigationProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      <Pressable onPress={onHomePress} style={styles.tabItem} accessibilityRole="button">
        <Home color={colors.primary} size={24} />
        <Text style={[styles.label, styles.activeLabel]}>Home</Text>
        <View style={styles.activeIndicator} />
      </Pressable>

      <Pressable onPress={onAction} style={styles.tabItem} accessibilityRole="button">
        <Compass color={colors.textInactive} size={24} />
        <Text style={styles.label}>Discover</Text>
      </Pressable>

      <Pressable onPress={onAction} style={styles.tabItem} accessibilityRole="button">
        <Users color={colors.textInactive} size={24} />
        <Text style={styles.label}>Artists</Text>
      </Pressable>

      <Pressable onPress={onAction} style={styles.tabItem} accessibilityRole="button">
        <Library color={colors.textInactive} size={24} />
        <Text style={styles.label}>Library</Text>
      </Pressable>

      <Pressable onPress={onAction} style={styles.tabItem} accessibilityRole="button">
        <User color={colors.textInactive} size={24} />
        <Text style={styles.label}>Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: colors.borderThin,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 15,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    position: 'relative',
  },
  label: {
    fontSize: 10,
    marginTop: 4,
    color: colors.textInactive,
    fontWeight: typography.weightMedium,
  },
  activeLabel: {
    color: colors.primary,
    fontWeight: typography.weightBold,
  },
  activeIndicator: {
    position: 'absolute',
    top: -spacing.sm,
    width: 24,
    height: 2,
    backgroundColor: colors.primary,
    borderRadius: 1,
  },
});
