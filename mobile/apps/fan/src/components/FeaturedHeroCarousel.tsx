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
        {/* Neon electric indigo/blue background gradient */}
        <LinearGradient
          colors={['#0E1442', '#0A0E2F', '#040618']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Ambient neon glows */}
        <View style={styles.ambientGlowBlue} pointerEvents="none" />
        <View style={styles.ambientGlowPurple} pointerEvents="none" />

        {/* Content row: Text block on left, artwork on right */}
        <View style={styles.cardContent}>
          <View style={styles.textColumn}>
            {/* Neon Kicker Badge */}
            <View style={styles.kickerRow}>
              <Sparkles size={11} color="#818CF8" />
              <Text style={styles.kickerText}>
                {isVideo ? 'TRENDING VIDEO' : 'FEATURED'}
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

            {/* White pill CTA button — guaranteed single line matching Column 3 */}
            <TouchableOpacity
              style={styles.ctaPill}
              onPress={() => onPlayItem(item)}
              activeOpacity={0.85}
            >
              <Play color="#000000" size={12} fill="#000000" />
              <Text style={styles.ctaText} numberOfLines={1} ellipsizeMode="tail">
                {isVideo ? 'Watch Now' : 'Listen Now'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Real Artwork Thumbnail with neon border */}
          <View style={styles.artworkContainer}>
            <AppImage
              uri={item.thumbnail}
              fallbackType={isVideo ? 'video' : 'song'}
              style={styles.artworkImage}
              resizeMode="contain"
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
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.45)',
    position: 'relative',
    backgroundColor: '#090D2B',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ambientGlowBlue: {
    position: 'absolute',
    left: -20,
    top: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
  },
  ambientGlowPurple: {
    position: 'absolute',
    right: -25,
    bottom: -25,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(168, 85, 247, 0.18)',
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
    color: '#818CF8',
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
    width: 130,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#070A1E',
    borderWidth: 1.5,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
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
