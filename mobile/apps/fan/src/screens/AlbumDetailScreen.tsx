import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, Pressable, Modal } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Play, X } from 'lucide-react-native';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import AudioListItem from '../ui/audio/AudioListItem';
import { LockedContentOverlay } from '../ui/SubscriptionUI';
import { Colors } from '../theme';

export default function AlbumDetailScreen({ route, navigation }: any) {
  const { albumId, title, artistName, coverImage, tracks } = route.params;
  const insets = useSafeAreaInsets();
  const { playQueue, currentItem, state: playerState } = useMediaPlayer();
  const [showArtistLockModal, setShowArtistLockModal] = useState<{ visible: boolean; item: any }>({
    visible: false,
    item: null,
  });

  const handlePlayAll = () => {
    if (!tracks || tracks.length === 0) return;

    // Check if first track is locked
    const firstTrack = tracks[0];
    if (firstTrack.isLocked || firstTrack.locked) {
      setShowArtistLockModal({ visible: true, item: firstTrack });
      return;
    }

    const queue = tracks.map((x: any) => ({
      id: x.id,
      contentId: x.contentId,
      title: x.title,
      artistName: x.artistName,
      artistId: x.artistId,
      mediaType: 'audio' as const,
      artworkUrl: x.artworkUrl,
      mediaUrl: x.mediaUrl || '',
      isLocked: Boolean(x.isLocked || x.locked),
      useStreamAccess: x.useStreamAccess,
    }));

    navigation.navigate('FullPlayer', {
      songId: tracks[0].id,
      title: tracks[0].title,
      artist: tracks[0].artistName,
      imageUrl: tracks[0].artworkUrl || '',
      audioUrl: tracks[0].mediaUrl || '',
      queueIndex: 0,
      queue,
    });
  };

  const handlePressTrack = (song: any) => {
    if (song.isLocked || song.locked) {
      setShowArtistLockModal({ visible: true, item: song });
      return;
    }

    const queue = tracks.map((x: any) => ({
      id: x.id,
      contentId: x.contentId,
      title: x.title,
      artistName: x.artistName,
      artistId: x.artistId,
      mediaType: 'audio' as const,
      artworkUrl: x.artworkUrl,
      mediaUrl: x.mediaUrl || '',
      isLocked: Boolean(x.isLocked || x.locked),
      useStreamAccess: x.useStreamAccess,
    }));
    
    const queueIndex = Math.max(0, queue.findIndex((q: any) => q.id === song.id || q.contentId === song.id));

    navigation.navigate('FullPlayer', {
      songId: song.id,
      title: song.title,
      artist: song.artistName,
      imageUrl: song.artworkUrl || '',
      audioUrl: song.mediaUrl || '',
      queueIndex,
      queue,
    });
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
        <ArrowLeft color="#fff" size={28} />
      </Pressable>
      
      <View style={styles.coverWrapper}>
        <Image source={{ uri: coverImage }} style={styles.coverImage} />
      </View>
      
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.artistName}>Album • {artistName}</Text>
      <Text style={styles.metadataText}>{tracks?.length || 0} songs</Text>
      
      <Pressable style={styles.playAllButton} onPress={handlePlayAll}>
        <Play fill="#000" color="#000" size={24} style={{ marginLeft: 4 }} />
      </Pressable>
    </View>
  );

  return (
    <LinearGradient colors={['#1a1a1a', '#000000']} style={styles.container}>
      <View style={{ paddingTop: insets.top, flex: 1 }}>
        <FlatList
          data={tracks}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          renderItem={({ item, index }) => {
            const isActive = Boolean(currentItem && (item.id === currentItem.id || item.contentId === currentItem.contentId || item.id === currentItem.contentId || item.contentId === currentItem.id));
            return (
              <View style={styles.trackRow}>
                <Text style={[styles.trackIndex, isActive && { color: Colors.accent }]}>{index + 1}</Text>
                <View style={{ flex: 1 }}>
                  <AudioListItem
                    item={item}
                    onPress={handlePressTrack}
                    isActive={isActive}
                    isPlaying={playerState.isPlaying}
                  />
                </View>
              </View>
            );
          }}
        />
      </View>

      {showArtistLockModal.visible && (
        <Modal
          transparent
          visible={true}
          animationType="fade"
          onRequestClose={() => setShowArtistLockModal({ visible: false, item: null })}
        >
          <LockedContentOverlay
            artistName={showArtistLockModal.item?.artistName}
            onSubscribe={() => {
              setShowArtistLockModal({ visible: false, item: null });
              navigation.navigate('SubscriptionFlow', {
                artistId: showArtistLockModal.item?.artistId,
                artistName: showArtistLockModal.item?.artistName,
              });
            }}
          />
          <Pressable
            style={{
              position: 'absolute',
              top: 50,
              right: 20,
              zIndex: 100,
              padding: 10,
            }}
            onPress={() => setShowArtistLockModal({ visible: false, item: null })}
          >
            <X color="#fff" size={28} />
          </Pressable>
        </Modal>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
  coverWrapper: {
    width: 220,
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 8,
  },
  artistName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  metadataText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 24,
  },
  playAllButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: -10,
    right: 24,
    elevation: 6,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
  },
  trackIndex: {
    width: 30,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
