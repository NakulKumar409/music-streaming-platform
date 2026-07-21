import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Music } from 'lucide-react-native';
import { colors } from '../theme-guest/colors';
import { spacing } from '../theme-guest/spacing';
import { typography } from '../theme-guest/typography';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export default function EmptyState({
  title = 'No content available yet',
  description = 'New releases will appear here soon.',
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Music color={colors.primary} size={28} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.2)',
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.cardTitle,
    fontWeight: typography.weightBold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.metadata,
    textAlign: 'center',
  },
});
