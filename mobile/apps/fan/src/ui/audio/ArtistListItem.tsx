import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getOptimizedImageUrl } from '../../utils/cloudinary';

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

export interface ArtistItemData {
  id: string;
  name: string;
  artworkUrl?: string;
  image?: string;
}

interface ArtistListItemProps {
  item: ArtistItemData;
  onPress: (item: ArtistItemData) => void;
}

const ArtistListItem = memo(({ item, onPress }: ArtistListItemProps) => {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          pressed && styles.rowPressed,
        ]}
        onPress={() => onPress(item)}
      >
        <Image
          source={{ uri: getOptimizedImageUrl(item.image || item.artworkUrl || FALLBACK_ARTWORK) }}
          style={styles.avatar}
        />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            Artist
          </Text>
        </View>
        <View style={styles.actionWrap} />
      </Pressable>
    </View>
  );
});

export default ArtistListItem;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26, // Circular for artists
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  meta: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  actionWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});
