import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  Pressable,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Sparkles } from 'lucide-react-native';
import AppImage from './AppImage';
import { Colors } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const H_PAD = 20;
const BANNER_WIDTH = Math.min(SCREEN_WIDTH - H_PAD * 2, 600);
const BANNER_HEIGHT = 192;
const CARD_GAP = 12;
const ITEM_SNAP = BANNER_WIDTH + CARD_GAP;

export interface FeaturedItem {
  id: string;
  contentId?: string;
  title: string;
  artist: string;
  artistId?: string;
  thumbnail: string;
  mediaType?: 'audio' | 'video' | 'audio_video';
  mediaUrl?: string | null;
  durationMs?: number;
  isLocked?: boolean;
}

interface FeaturedHeroCarouselProps {
  items: FeaturedItem[];
  onPlayItem: (item: FeaturedItem) => void;
  isLoading?: boolean;
}

export default function FeaturedHeroCarousel({
  items,
  onPlayItem,
  isLoading = false,
}: FeaturedHeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<any>>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDragging = useRef(false);
  const itemsCount = items.length;

  const startAutoScroll = useCallback(() => {
    if (itemsCount <= 1) return;
    if (autoScrollTimer.current) clearInterval(autoScrollTimer.current);

    autoScrollTimer.current = setInterval(() => {
      if (isDragging.current) return;
      setActiveIndex((prev) => {
        const next = (prev + 1) % itemsCount;
        flatListRef.current?.scrollToOffset({
          offset: next * ITEM_SNAP,
          animated: true,
        });
        return next;
      });
    }, 2500); // 2.5 second auto-rotation cadence
  }, [itemsCount]);

  const stopAutoScroll = useCallback(() => {
    if (autoScrollTimer.current) {
      clearInterval(autoScrollTimer.current);
      autoScrollTimer.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoScroll();
    return () => stopAutoScroll();
  }, [startAutoScroll, stopAutoScroll]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / ITEM_SNAP);
    if (idx !== activeIndex && idx >= 0 && idx < itemsCount) {
      setActiveIndex(idx);
    }
  };

  if (isLoading || itemsCount === 0) {
    return null;
  }

  const renderItem = ({ item, index }: { item: FeaturedItem; index: number }) => {
    const isVideo = item.mediaType === 'video';

    return (
      <Pressable
        style={styles.bannerCard}
        onPress={() => onPlayItem(item)}
        android_ripple={{ color: 'rgba(255,255,255,0.08)' }}
      >
        {/* Luxury editorial background gradient */}
        <LinearGradient
          colors={['#20102B', '#110817', '#08040B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Ambient glow accent behind artwork */}
        <View style={styles.ambientGlow} />

        {/* Content row: Text block on left, artwork on right */}
        <View style={styles.cardContent}>
          <View style={styles.textColumn}>
            {/* Editorial Kicker Badge */}
            <View style={styles.kickerRow}>
              <Sparkles size={11} color="#EC4899" />
              <Text style={styles.kickerText}>
                {isVideo ? 'TRENDING VIDEO' : 'NEW MUSIC'}
              </Text>
            </View>

            {/* Song / Video Title */}
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {item.title}
            </Text>

            {/* Artist & subtitle */}
            <Text style={styles.bannerArtist} numberOfLines={1}>
              Curated for you • {item.artist}
            </Text>

            {/* Apple Music-inspired CTA pill */}
            <TouchableOpacity
              style={styles.ctaPill}
              onPress={() => onPlayItem(item)}
              activeOpacity={0.8}
            >
              <Play color="#000" size={12} fill="#000" />
              <Text style={styles.ctaText}>
                {isVideo ? 'Watch Now' : 'Listen Now'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Real Artwork Thumbnail */}
          <View style={styles.artworkContainer}>
            <AppImage
              uri={item.thumbnail}
              fallbackType={isVideo ? 'video' : 'song'}
              style={styles.artworkImage}
              resizeMode="cover"
            />
            {/* Subtle gloss overlay border */}
            <View style={styles.artworkGloss} />
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => `hero-${item.id}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_SNAP}
        decelerationRate="fast"
        onScroll={onScroll}
        onScrollBeginDrag={() => {
          isDragging.current = true;
          stopAutoScroll();
        }}
        onScrollEndDrag={() => {
          isDragging.current = false;
          startAutoScroll();
        }}
        scrollEventThrottle={16}
        contentContainerStyle={styles.listContent}
      />

      {/* Pagination indicators */}
      {itemsCount > 1 && (
        <View style={styles.paginationRow}>
          {items.map((_, idx) => (
            <View
              key={idx}
              style={[
                styles.dot,
                activeIndex === idx ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: H_PAD,
    gap: CARD_GAP,
  },
  bannerCard: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    position: 'relative',
    backgroundColor: '#120A18',
  },
  ambientGlow: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(236,72,153,0.14)',
  },
  cardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 14,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  kickerText: {
    color: '#EC4899',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 23,
    marginBottom: 4,
  },
  bannerArtist: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 14,
  },
  ctaPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  ctaText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  artworkContainer: {
    width: 136,
    height: 136,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  artworkGloss: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  activeDot: {
    width: 18,
    backgroundColor: '#EC4899',
  },
  inactiveDot: {
    width: 5,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
