import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Play, Pause, Lock } from 'lucide-react-native';
import { Colors } from '../../theme';
import { getOptimizedImageUrl } from '../../utils/cloudinary';

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

export interface AudioItemData {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string;
  isLocked?: boolean;
}

interface AudioListItemProps {
  item: AudioItemData;
  onPress: (item: AudioItemData) => void;
  isActive?: boolean;
  isPlaying?: boolean;
}

const AudioListItem = memo(({ item, onPress, isActive, isPlaying }: AudioListItemProps) => {
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
          source={{ uri: getOptimizedImageUrl(item.artworkUrl || FALLBACK_ARTWORK) }}
          style={styles.thumbnail}
        />
        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {item.artistName}
          </Text>
        </View>
        <View style={[styles.playButtonWrap, isActive && styles.playButtonWrapActive, (item.isLocked || (item as any).locked) && styles.playButtonWrapLocked]}>
          {(item.isLocked || (item as any).locked) ? (
            <Lock size={16} color="rgba(255,255,255,0.4)" />
          ) : isActive && isPlaying ? (
            <Pause size={16} color="#000" fill="#000" />
          ) : (
            <Play size={16} color={isActive ? "#000" : "#fff"} fill={isActive ? "#000" : "#fff"} />
          )}
        </View>
      </Pressable>
    </View>
  );
});

export default AudioListItem;

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
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  rowPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  thumbnail: {
    width: 52,
    height: 52,
    borderRadius: 12,
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
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
  playButtonWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginLeft: 12,
  },
  playButtonWrapActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  playButtonWrapLocked: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.05)',
  },
});
