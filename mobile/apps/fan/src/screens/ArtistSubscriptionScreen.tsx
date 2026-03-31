import React, { useState, useEffect } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator
} from 'react-native';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { ArrowLeft, Lock, Pause, Play } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ErrorBoundary from '../ui/ErrorBoundary';

type Song = {
  id: string;
  title: string;
  artist: string;
  duration: string;
  thumbnail: string;
  locked: boolean;
};

export default function ArtistSubscriptionScreen({ navigation, route }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const [isPlaying, setIsPlaying] = useState(false);
  const [songData, setSongData] = useState<Song | null>(null);

  useEffect(() => {
    const dummySong: Song = {
      id: 'locked-101',
      title: 'Secret Melody',
      artist: 'Luna Ray',
      duration: '3:12',
      thumbnail: 'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80',
      locked: true,
    };
    
    setSongData(route?.params?.song || dummySong);
  }, [route.params]);

  if (!songData) return <View style={styles.container}><ActivityIndicator color="#fff" /></View>;

  return (
    <ErrorBoundary label="Payments: Artist Subscription">
      <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background Hero */}
      <View style={styles.heroWrap}>
        <Image source={{ uri: songData.thumbnail }} style={styles.heroImg} />
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.95)']}
          style={styles.heroGradient}
        />
      </View>

      {/* FIXED: Back Button moved outside heroWrap for absolute top priority */}
      <Pressable 
        onPress={() => navigation.goBack()} 
        style={styles.backBtn}
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} // Touch area increase karne ke liye
      >
        <ArrowLeft color="#fff" size={24} />
      </Pressable>

      {/* Requirement: Center Aligned Subscription Card */}
      <View style={styles.centerContent}>
        <View style={styles.heroTextWrap}>
          <Text style={styles.songTitle}>{songData.title}</Text>
          <Text style={styles.songArtist}>{songData.artist}</Text>
        </View>

        <View style={styles.cardOuter}>
          <BlurView intensity={40} tint="dark" style={styles.card}>
            <View style={styles.lockedHeaderRow}>
              <Lock color="#FF6A00" size={20} />
              <Text style={styles.lockedHeaderText}>LOCKED EARLY ACCESS</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.subscribeHint}>Subscribe to unlock this exclusive release</Text>

            <Pressable 
              style={styles.subscribeBtnWrap} 
              onPress={() =>
                navigation.navigate('SubscriptionFlow', {
                  artistId: 'luna-ray',
                  artistName: songData.artist,
                  contentId: songData.id,
                  artwork: songData.thumbnail,
                })
              }
            >
              <LinearGradient
                colors={['#FF7A18', '#FF3D00']}
                start={{x: 0, y: 0}}
                end={{x: 1, y: 0}}
                style={styles.subscribeBtn}
              >
                <Text style={styles.subscribeBtnText}>Subscribe</Text>
              </LinearGradient>
            </Pressable>
          </BlurView>
        </View>
      </View>


      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  heroWrap: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  heroImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  heroGradient: { ...StyleSheet.absoluteFillObject },
  
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 2, // Hero Wrap ke upar
  },

  // FIXED STYLES FOR BACK BUTTON
  backBtn: {
    position: 'absolute',
    top: 50, // SafeAreaView ke edges ke hisab se adjustment
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999, // Sabse upar taaki touch hamesha mile
    elevation: 10, // Android ke liye
  },

  heroTextWrap: {
    alignItems: 'center',
    marginBottom: 30,
  },
  songTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  songArtist: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 5,
  },

  cardOuter: {
    width: '100%',
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(20,20,20,0.7)',
    padding: 24,
  },
  lockedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedHeaderText: {
    marginLeft: 12,
    color: '#FF6A00',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 20,
  },
  subscribeHint: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 25,
    opacity: 0.8,
  },
  subscribeBtnWrap: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  subscribeBtn: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },

});