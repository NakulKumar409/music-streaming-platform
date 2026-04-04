import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../theme';

export type CategoryType = 'All' | 'Trending' | 'Artists' | 'Albums';

const CATEGORIES: CategoryType[] = ['All', 'Trending', 'Artists', 'Albums'];

interface CategoryChipsProps {
  activeCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
}

export default function CategoryChips({ activeCategory, onSelectCategory }: CategoryChipsProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              activeOpacity={0.7}
              onPress={() => onSelectCategory(cat)}
              style={[
                styles.chip,
                isActive ? styles.chipActive : styles.chipInactive,
              ]}
            >
              <Text style={[styles.chipText, isActive ? styles.chipTextActive : null]}>
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: 'rgba(255,106,0,0.16)', // Brand accent tint
    borderColor: 'rgba(255,106,0,0.55)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '700',
  },
  chipTextActive: {
    color: Colors.accent,
  },
});
