import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MediaItem } from '../media.types';
import { apiV1 } from '../services/api';
import ErrorBoundary from '../ui/ErrorBoundary';

/**
 * Legacy/deep-link compatibility route.
 *
 * Audio playback must have exactly one engine/state machine. Older navigation
 * paths can still open ContentPlayer by contentId, but after resolving the
 * governed catalog item they are redirected into FullPlayer, which owns the
 * hardened global MediaPlayerProvider flow.
 */
export default function ContentPlayerScreen({ navigation, route }: any) {
  const contentId = route?.params?.contentId;
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const resolveGenerationRef = useRef(0);

  const resolveContent = useCallback(async () => {
    const generation = resolveGenerationRef.current + 1;
    resolveGenerationRef.current = generation;
    const isCurrent = () => generation === resolveGenerationRef.current;

    const id = String(contentId || '').trim();
    if (!id) {
      if (isCurrent()) setError('Content is unavailable.');
      return;
    }

    if (isCurrent()) setError(null);

    try {
      const res = await apiV1.get(`/content/${encodeURIComponent(id)}`);
      if (!isCurrent()) return;
      const c = res.data?.content ?? null;
      if (!c) {
        setError('Content could not be found.');
        return;
      }

      const mediaType = String(c.mediaType || c.type || '')
        .toLowerCase()
        .includes('video')
        ? 'video'
        : 'audio';

      if (mediaType !== 'audio') {
        setError('Open this release in the video player.');
        return;
      }

      if (Boolean(c.isLocked ?? c.locked ?? false)) {
        setError('An active artist subscription is required to play this content.');
        return;
      }

      const durationMs =
        Number.isFinite(Number(c.durationMs)) && Number(c.durationMs) > 0
          ? Math.round(Number(c.durationMs))
          : undefined;

      const item: MediaItem = {
        id: String(c.id),
        contentId: String(c.id),
        title: String(c.title ?? 'Untitled'),
        artistName: String(c.artistName ?? c.artist_name ?? 'Artist'),
        artistId:
          c.artistId !== undefined && c.artistId !== null
            ? String(c.artistId)
            : undefined,
        mediaType: 'audio',
        artworkUrl: String(c.artwork ?? c.thumbnailUrl ?? ''),
        mediaUrl: null,
        isLocked: false,
        useStreamAccess: c.useStreamAccess !== false,
        duration: durationMs,
      };

      if (!isCurrent()) return;
      navigation.replace('FullPlayer', {
        songId: String(item.contentId ?? item.id),
        title: item.title,
        artist: item.artistName ?? 'Artist',
        imageUrl: item.artworkUrl ?? '',
        audioUrl: '',
        queueIndex: 0,
        queue: [item],
      });
    } catch (err: any) {
      if (!isCurrent()) return;
      setError(
        err?.response?.data?.message ||
          'Could not prepare this audio. Please try again.'
      );
    }
  }, [contentId, navigation]);

  useEffect(() => {
    void resolveContent();
    return () => {
      resolveGenerationRef.current += 1;
    };
  }, [resolveContent, reloadKey]);

  return (
    <ErrorBoundary label="Media Player">
      <SafeAreaView style={styles.container}>
        {error ? (
          <View style={styles.center}>
            <Text style={styles.title}>Unable to play</Text>
            <Text style={styles.message}>{error}</Text>
            <Pressable
              onPress={() => setReloadKey((value) => value + 1)}
              style={styles.button}
            >
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.goBack()}
              style={[styles.button, styles.secondaryButton]}
            >
              <Text style={styles.buttonText}>Back</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator />
            <Text style={styles.message}>Preparing audio…</Text>
          </View>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  message: {
    marginTop: 10,
    color: 'rgba(255,255,255,0.68)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    marginTop: 18,
    minWidth: 120,
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#FF7A18',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
