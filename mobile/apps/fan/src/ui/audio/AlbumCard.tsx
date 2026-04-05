import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Colors } from '../../theme';

export interface AlbumData {
  id: string;
  title: string;
  artistName: string;
  coverImage: string;
  totalTracks: number;
  tracks: any[];
}

interface AlbumCardProps {
  album: AlbumData;
  onPress: (album: AlbumData) => void;
}

export default function AlbumCard({ album, onPress }: AlbumCardProps) {
  return (
    <Pressable
      onPress={() => onPress(album)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.imageContainer}>
        <Image source={{ uri: album.coverImage }} style={styles.image} />
        <View style={styles.trackBadge}>
          <Text style={styles.trackBadgeText}>{album.totalTracks} tracks</Text>
        </View>
      </View>
      <View style={styles.detailsContainer}>
        <Text style={styles.title} numberOfLines={1}>{album.title}</Text>
        <Text style={styles.artist} numberOfLines={1}>{album.artistName}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    margin: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  trackBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trackBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  detailsContainer: {
    padding: 12,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  artist: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '600',
  },
});
