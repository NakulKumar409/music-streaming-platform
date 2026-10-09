import React from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Search as SearchIcon } from 'lucide-react-native';

interface AudioHeaderProps {
  query: string;
  setQuery: (query: string) => void;
}

export default function AudioHeader({ query, setQuery }: AudioHeaderProps) {
  return (
    <View style={styles.container}>
      {/* Page title row */}
      <View style={styles.titleRow}>
        <Text style={styles.pageTitle}>Music</Text>
      </View>
      <Text style={styles.subtitle}>Explore millions of songs</Text>

      {/* Search box */}
      <View style={styles.searchWrap}>
        <View style={styles.searchBox}>
          <SearchIcon color="rgba(255,255,255,0.5)" size={17} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs, artists, albums..."
            placeholderTextColor="rgba(255,255,255,0.32)"
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    // Extra top padding so content never touches safe-area edge
    paddingTop: Platform.OS === 'android' ? 14 : 8,
    paddingBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  pageTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 32,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 18,
    lineHeight: 18,
  },
  searchWrap: {
    width: '100%',
    marginBottom: 4,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
    height: 48,
  },
});
