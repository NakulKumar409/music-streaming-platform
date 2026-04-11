import React, { useMemo } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Search as SearchIcon } from 'lucide-react-native';

interface AudioHeaderProps {
  query: string;
  setQuery: (query: string) => void;
}

export default function AudioHeader({ query, setQuery }: AudioHeaderProps) {
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.headerTop}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.headerLogo}
          resizeMode="cover"
        />
        <Text style={styles.greeting}>{greeting}</Text>
      </View>
      <Text style={styles.subtitle}>What do you want to hear today?</Text>

      <View style={styles.searchWrap}>
        <BlurView intensity={24} tint="dark" style={styles.searchBlur}>
          <SearchIcon color="rgba(255,255,255,0.7)" size={18} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search songs"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </BlurView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  headerTextWrap: {
    marginBottom: 16,
  },
  greeting: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  searchWrap: {
    width: '100%',
  },
  searchBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },
});
