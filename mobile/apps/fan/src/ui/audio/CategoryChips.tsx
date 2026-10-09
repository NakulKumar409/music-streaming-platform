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
              activeOpacity={0.75}
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
    marginTop: 14,
    marginBottom: 6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 10,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
  },
  chipInactive: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.10)',
  },
  chipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  chipText: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
});

