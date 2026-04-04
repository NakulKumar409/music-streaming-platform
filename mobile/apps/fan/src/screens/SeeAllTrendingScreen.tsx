import React from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, BadgeCheck } from 'lucide-react-native';
import { Colors } from '../theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_W - 48 - CARD_GAP) / 2; // 48 = horizontal padding, gap between 2 cards

type ArtistCard = {
  id: string;
  name: string;
  subText: string;
  image: string;
  isVerified?: boolean;
  isSubscriptionBased?: boolean;
};

export default function SeeAllTrendingScreen({ navigation, route }: any) {
  const artists: ArtistCard[] = Array.isArray(route?.params?.artists) ? route.params.artists : [];

  const renderItem: ListRenderItem<ArtistCard> = ({ item, index }) => {
    const isFeatured = index < 3;
    return (
      <Pressable
        style={[styles.card, isFeatured && styles.featuredCard]}
        onPress={() => navigation.navigate('Artist', { artistId: item.id })}
      >
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.image }} style={styles.image} />
          <LinearGradient
            colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.6)']}
            style={styles.imageOverlay}
          />
          {item.isVerified && (
            <View style={styles.verifiedBadge}>
              <BadgeCheck size={18} color="#22c55e" fill="#22c55e" />
            </View>
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.subText} numberOfLines={1}>
            {item.subText || 'Artist'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <LinearGradient
        colors={Colors.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Custom Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <ArrowLeft size={22} color="#fff" />
          </Pressable>
          <Text style={styles.headerTitle}>All Artists</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={artists}
          keyExtractor={(item) => item.id}
          numColumns={2}
          initialNumToRender={5}
          windowSize={5}
          removeClippedSubviews={true}
          contentContainerStyle={styles.content}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No artists found.</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 40 },

  content: {
    padding: 16,
    paddingBottom: 120,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: CARD_GAP,
  },

  card: {
    width: CARD_WIDTH,
    backgroundColor: '#111',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featuredCard: {
    borderColor: 'rgba(255,182,8,0.25)',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  imageWrap: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  textWrap: {
    padding: 12,
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subText: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
  },

  empty: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '600',
  },
});
