import React from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { Colors } from '../../theme';
import { getOptimizedImageUrl } from '../../utils/cloudinary';
import AppImage from '../../components/AppImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── FIXED card dimensions — NEVER driven by image dimensions ───────────────
const H_PAD = 20;
const CARD_WIDTH = SCREEN_WIDTH - H_PAD * 2;   // Full-width card with edge padding
const CARD_HEIGHT = Math.round(CARD_WIDTH * 0.56); // 16:9-ish fixed ratio

const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

interface CarouselItem {
  id: string;
  title: string;
  artistName: string;
  artworkUrl: string;
}

interface FeaturedCarouselProps {
  items: CarouselItem[];
  onPressItem: (item: CarouselItem) => void;
  isLoading?: boolean;
}

export default function FeaturedCarousel({ items, onPressItem, isLoading }: FeaturedCarouselProps) {
  // Show skeleton placeholder while loading
  if (isLoading && items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>New Song</Text>
        </View>
        <View style={[styles.card, styles.skeletonCard]}>
          <ActivityIndicator color={Colors.accent} size="small" />
        </View>
      </View>
    );
  }

  if (items.length === 0) return null;

  // Show only the first item (the most recent song) as the "New Song" hero card
  const featured = items[0];
  const imageUri = getOptimizedImageUrl(featured.artworkUrl || FALLBACK_ARTWORK) || FALLBACK_ARTWORK;

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>New Song</Text>
      </View>

      {/* Hero card — fixed dimensions, image fills via cover */}
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => onPressItem(featured)}
      >
        {/* ── Image container: FIXED size, overflow:hidden — image never changes card size ── */}
        <View style={styles.imgContainer}>
          <AppImage
            uri={featured.artworkUrl}
            fallbackType="song"
            style={styles.backgroundImage}
            resizeMode="cover"
          />
          {/* Bottom gradient for text legibility */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.80)']}
            style={styles.gradientOverlay}
            pointerEvents="none"
          />
        </View>

        {/* Text + play button row pinned to bottom */}
        <View style={styles.contentWrap}>
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {featured.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {featured.artistName}
            </Text>
          </View>

          <View style={styles.playButton}>
            <Play size={16} color="#fff" fill="#fff" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    marginBottom: 22,
    paddingHorizontal: H_PAD,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },

  // ── Card shell: fixed W×H, clip everything inside ──
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 18,
    overflow: 'hidden',             // clips image + gradient to card bounds
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  skeletonCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Image fills the entire card regardless of original aspect ratio ──
  imgContainer: {
    ...StyleSheet.absoluteFillObject, // fills parent card
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    // resizeMode="cover" ensures image fills container, crops excess — NO distortion
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: '45%',
  },

  // ── Text + play button pinned inside card at bottom ──
  contentWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  textWrap: {
    flex: 1,
    paddingRight: 14,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    marginBottom: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  artist: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  playButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    flexShrink: 0,
  },
});

