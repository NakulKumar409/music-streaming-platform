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
import { ArrowLeft, BadgeCheck } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '../theme';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import {
  fetchRecentlyPlayed,
  fetchSubscribedArtists,
  type RecentlyPlayedItem,
  type SubscribedArtist,
} from '../services/libraryService';

export default function MyLibraryScreen({ navigation }: any) {
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
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <ArrowLeft color="rgba(255,255,255,0.9)" size={18} />
            </Pressable>
            <Text style={styles.headerTitle}>My Library</Text>
            <View style={{ width: 34 }} />
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
                  onPress={() => navigation.getParent()?.getParent()?.navigate('HomeTab', { screen: 'HomeIndex' })}
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
                        isLocked: false,
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
                onPress={() => navigation.getParent()?.getParent()?.navigate('HomeTab', { screen: 'HomeIndex' })}
              >
                <Text style={styles.browseBtnText}>Browse Artists</Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },

  sectionHeaderRow: {
    marginTop: 6,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '800',
  },
  manageText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionTitleSolo: {
    marginTop: 22,
    marginBottom: 12,
    paddingHorizontal: 20,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '800',
  },

  subListWrap: {
    marginTop: 10,
    paddingHorizontal: 20,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  subAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  subNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    maxWidth: 200,
  },
  subLabel: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  chev: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 18,
    fontWeight: '900',
    marginLeft: 10,
  },

  emptySubArtistsCard: {
    marginTop: 10,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  emptySubArtistsTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  emptySubArtistsSub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  findArtistsBtn: {
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,122,24,0.25)',
  },
  findArtistsBtnInner: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  findArtistsBtnText: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '900',
  },

  recentCard: {
    width: 150,
    marginRight: 12,
  },
  recentImg: {
    width: '100%',
    height: 150,
    borderRadius: 18,
    overflow: 'hidden',
  },
  recentImgStyle: {
    borderRadius: 18,
  },
  durationPill: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 34,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  recentTitle: {
    marginTop: 10,
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  recentArtist: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
  },

  emptyWrap: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  emptySub: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  browseBtn: {
    marginTop: 14,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  browseBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
  },
});
