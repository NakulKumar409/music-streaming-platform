import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BadgeCheck, Search } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import {
  fetchRecentlyPlayed,
  fetchSubscribedArtists,
  type RecentlyPlayedItem,
  type SubscribedArtist,
} from '../services/libraryService';

export default function LibraryScreen({ navigation }: any) {
  const tabBarHeight = useBottomTabBarHeight();
  const { playQueue } = useMediaPlayer();

  const [subscribedArtists, setSubscribedArtists] = useState<SubscribedArtist[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<RecentlyPlayedItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [artists, recent] = await Promise.all([
          fetchSubscribedArtists(),
          fetchRecentlyPlayed(15),
        ]);
        if (!mounted) return;
        setSubscribedArtists(artists);
        setRecentlyPlayed(recent);
      } catch {
        if (!mounted) return;
        setSubscribedArtists([]);
        setRecentlyPlayed([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      const [artists, recent] = await Promise.all([
        fetchSubscribedArtists(),
        fetchRecentlyPlayed(15),
      ]);
      setSubscribedArtists(artists);
      setRecentlyPlayed(recent);
    } catch {
      // ignore
    } finally {
      setRefreshing(false);
    }
  };

  const artistImageFallback =
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=80';
  const songArtworkFallback =
    'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=1400&q=80';

  return (
    <LinearGradient
      colors={Colors.backgroundGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBackground}
    >
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: tabBarHeight + 140 }}
          refreshControl={<RefreshControl tintColor="#fff" refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Library</Text>
            <Pressable onPress={() => {}} style={styles.headerIconBtn}>
              <Search color="rgba(255,255,255,0.75)" size={18} />
            </Pressable>
          </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Subscribed Artists</Text>
          <Pressable onPress={() => {}}>
            <Text style={styles.manageText}>Manage  &gt;</Text>
          </Pressable>
        </View>

        {subscribedArtists.length > 0 ? (
          <View style={styles.subListWrap}>
            {subscribedArtists.map((a) => (
              <Pressable
                key={a.id}
                style={styles.subRow}
                onPress={() => navigation.navigate('SubscriptionDetail', { artistId: a.id })}
              >
                <Image
                  source={{ uri: a.profileImageUrl || artistImageFallback }}
                  style={styles.subAvatar}
                />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={styles.subNameRow}>
                    <Text style={styles.subName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    {a.isVerified ? (
                      <View style={{ marginLeft: 8, marginTop: 2 }}>
                        <BadgeCheck color="#4AA3FF" fill="#4AA3FF" size={16} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.subLabel} numberOfLines={1}>
                    {(a.genre || '').toString() || 'Artist'}
                  </Text>
                </View>
                <Text style={styles.chev}>&gt;</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.emptySubArtistsCard}>
            <Text style={styles.emptySubArtistsTitle}>
              {loading ? 'Loading your subscriptions…' : 'No subscriptions yet'}
            </Text>
            <Text style={styles.emptySubArtistsSub}>
              {loading
                ? 'We’ll personalize this space for you.'
                : 'Find your favorite artists and subscribe for early access.'}
            </Text>
            {!loading ? (
              <Pressable
                style={styles.findArtistsBtn}
                onPress={() => navigation.getParent()?.navigate('HomeTab', { screen: 'HomeIndex' })}
              >
                <LinearGradient
                  colors={['rgba(255,122,24,0.22)', 'rgba(255,122,24,0.12)']}
                  style={styles.findArtistsBtnInner}
                >
                  <Text style={styles.findArtistsBtnText}>Find your favorite artists</Text>
                </LinearGradient>
              </Pressable>
            ) : null}
          </View>
        )}

        <Text style={styles.sectionTitleSolo}>Recently Played</Text>
        <FlatList
          data={recentlyPlayed}
          horizontal
          keyExtractor={(i) => i.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 10 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.recentCard}
              onPress={() => {
                if (!item.mediaUrl && !item.useStreamAccess) return;
                playQueue(
                  [
                    {
                      id: item.id,
                      contentId: item.id,
                      title: item.title,
                      artistName: item.artistName,
                      mediaType: item.mediaType,
                      artworkUrl: item.artworkUrl,
                      mediaUrl: item.mediaUrl || '',
                      useStreamAccess: item.useStreamAccess,
                    },
                  ],
                  0
                ).catch(() => undefined);
              }}
            >
              <ImageBackground
                source={{ uri: item.artworkUrl || songArtworkFallback }}
                style={styles.recentImg}
                imageStyle={styles.recentImgStyle}
              >
                <LinearGradient
                  colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.75)']}
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.durationPill} />
              </ImageBackground>
              <Text style={styles.recentTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.recentArtist} numberOfLines={1}>
                {item.artistName}
              </Text>
            </Pressable>
          )}
        />

        {subscribedArtists.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Your personal library</Text>
            <Text style={styles.emptySub}>Subscribe to artists you love to fill this space</Text>
            <Pressable
              style={styles.browseBtn}
              onPress={() => navigation.getParent()?.navigate('HomeTab', { screen: 'HomeIndex' })}
            >
              <LinearGradient
                colors={['rgba(255,122,24,0.22)', 'rgba(255,122,24,0.12)']}
                style={styles.browseBtnInner}
              >
                <Text style={styles.browseBtnText}>Browse Artists</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  manageText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '700',
  },
  emptySubArtistsCard: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  emptySubArtistsTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  emptySubArtistsSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  findArtistsBtn: {
    marginTop: 12,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.30)',
  },
  findArtistsBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findArtistsBtnText: {
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '900',
    fontSize: 13,
  },
  subListWrap: {
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  subAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  subNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  subLabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  chev: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 10,
  },
  sectionTitleSolo: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginTop: 18,
    marginBottom: 10,
  },
  recentCard: {
    width: 168,
    marginRight: 12,
  },
  recentImg: {
    width: 168,
    height: 92,
  },
  recentImgStyle: {
    borderRadius: 18,
  },
  durationPill: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  durationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '800',
  },
  recentTitle: {
    marginTop: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  recentArtist: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyWrap: {
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySub: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  browseBtn: {
    marginTop: 16,
    height: 50,
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.35)',
  },
  browseBtnInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '800',
  },
});
