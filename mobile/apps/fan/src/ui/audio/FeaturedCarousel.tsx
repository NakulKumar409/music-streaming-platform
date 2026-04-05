import React from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { Colors } from '../../theme';
import { getOptimizedImageUrl } from '../../utils/cloudinary';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.75;
const FALLBACK_ARTWORK =
  'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

// Note: Re-using the minimal properties of AudioCard to decouple slightly
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
  if (items.length === 0 && !isLoading) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>New Song</Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => onPressItem(item)}
          >
            <Image
              source={{ uri: getOptimizedImageUrl(item.artworkUrl || FALLBACK_ARTWORK) }}
              style={styles.backgroundImage}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={styles.gradientOverlay}
            />
            
            <View style={styles.contentWrap}>
              <View style={styles.textWrap}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {item.artistName}
                </Text>
              </View>
              
              <View style={styles.playButton}>
                <Play size={16} color="#000" fill="#000" />
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    marginBottom: 20,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 0.65,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: '40%', // Start gradient halfway down
  },
  contentWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 16,
  },
  textWrap: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  artist: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
