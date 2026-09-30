import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock, MoreVertical, Pause, Play } from 'lucide-react-native';
import { Colors } from '../../theme';
import { getOptimizedImageUrl } from '../../utils/cloudinary';

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

// ── Fixed thumbnail dimensions — NEVER change based on image aspect ratio ──
const THUMB_SIZE = 54;

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
  const isLocked = item.isLocked || (item as any).locked;
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [
          styles.row,
          isActive && styles.rowActive,
          pressed && styles.rowPressed,
        ]}
        onPress={() => onPress(item)}
        android_ripple={{ color: 'rgba(255,255,255,0.06)', borderless: false }}
      >
        {/* Thumbnail — fixed 54×54, clipped to square, resizeMode=cover */}
        <View style={styles.thumbWrap}>
          <Image
            source={{ uri: getOptimizedImageUrl(item.artworkUrl || FALLBACK_ARTWORK) }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
          {/* Active playing indicator overlay */}
          {isActive && isPlaying && (
            <View style={styles.thumbActiveOverlay}>
              <View style={styles.thumbActiveDot} />
            </View>
          )}
        </View>

        {/* Title + artist */}
        <View style={styles.meta}>
          <Text
            style={[styles.title, isActive && styles.titleActive]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.title}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1} ellipsizeMode="tail">
            {item.artistName}
          </Text>
        </View>

        {/* Right actions: play/pause or lock + 3-dot menu */}
        <View style={styles.actionsWrap}>
          {/* Play / Pause / Lock button */}
          <View style={[
            styles.playBtn,
            isActive && styles.playBtnActive,
            isLocked && styles.playBtnLocked,
          ]}>
            {isLocked ? (
              <Lock size={15} color="rgba(255,255,255,0.35)" />
            ) : isActive && isPlaying ? (
              <Pause size={15} color="#fff" fill="#fff" />
            ) : (
              <Play size={15} color={isActive ? '#fff' : 'rgba(255,255,255,0.8)'} fill={isActive ? '#fff' : 'rgba(255,255,255,0.8)'} />
            )}
          </View>

          {/* 3-dot menu — keeps touch area generous */}
          <View style={styles.moreBtn}>
            <MoreVertical size={18} color="rgba(255,255,255,0.3)" />
          </View>
        </View>
      </Pressable>
    </View>
  );
});

export default AudioListItem;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  rowActive: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderColor: 'rgba(59,130,246,0.22)',
  },
  rowPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.85,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  // ── Thumbnail: fixed size, overflow:hidden clips any image ──
  thumbWrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    overflow: 'hidden',           // clips image to exact square
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    // resizeMode="cover" fills thumbnail — never distorts or changes row height
  },
  thumbActiveOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(59,130,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // ── Text ──
  meta: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
    gap: 4,
    paddingRight: 6,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  titleActive: {
    color: Colors.accent,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },

  // ── Right actions ──
  actionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  playBtnActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  playBtnLocked: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderColor: 'rgba(255,255,255,0.04)',
  },
  moreBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

