import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { typography } from '../theme-guest/typography';

interface SectionHeaderProps {
  title: string;
  onAction: () => void;
}

export default function SectionHeader({ title, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        onPress={onAction}
        hitSlop={10}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
      >
        <Text style={styles.btnText}>View All</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.horizontalPadding,
    marginVertical: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.sectionHeading,
    fontWeight: typography.weightBold,
  },
  btn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  btnPressed: {
    opacity: 0.6,
  },
  btnText: {
    color: colors.primary,
    fontSize: typography.metadata + 1,
    fontWeight: typography.weightSemiBold,
  },
});
