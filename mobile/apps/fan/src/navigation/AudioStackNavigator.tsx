import React, { lazy } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LazyScreen from '../ui/LazyScreen';

const ArtistScreen = lazy(() => import('../screens/ArtistScreen'));
const ArtistSubscriptionScreen = lazy(() => import('../screens/ArtistSubscriptionScreen'));
const AudioScreen = lazy(() => import('../screens/AudioScreen'));
const ContentPlayerScreen = lazy(() => import('../screens/ContentPlayerScreen'));
const FullPlayerScreen = lazy(() => import('../screens/FullPlayerScreen'));
const SubscriptionFlowScreen = lazy(() => import('../screens/SubscriptionFlowScreen'));

const LazyArtistScreen = LazyScreen(ArtistScreen);
const LazyArtistSubscriptionScreen = LazyScreen(ArtistSubscriptionScreen);
const LazyAudioScreen = LazyScreen(AudioScreen);
const LazyContentPlayerScreen = LazyScreen(ContentPlayerScreen);
const LazyFullPlayerScreen = LazyScreen(FullPlayerScreen);
const LazySubscriptionFlowScreen = LazyScreen(SubscriptionFlowScreen);
import type { MediaItem } from '../media.types';

export type AudioStackParamList = {
  AudioIndex: undefined;
  Artist: {
    artistId?: string;
    unlocked?: boolean;
    contentId?: string;
  };
  ArtistSubscription: {
    song?: {
      id: string;
      title: string;
      artist: string;
      duration: string;
      thumbnail: string;
      locked: boolean;
    };
    coverImage?: string;
  };
  ContentPlayer: {
    contentId?: string;
  };
  SubscriptionFlow: {
    artistId?: string;
    artistName?: string;
    contentId?: string;
    artwork?: string;
  };
  FullPlayer: {
    songId: string;
    title: string;
    artist: string;
    imageUrl: string;
    audioUrl: string;
    queueIndex: number;
    queue: MediaItem[];
  };
};

const Stack = createNativeStackNavigator<AudioStackParamList>();

export default function AudioStackNavigator() {
  return (
    <Stack.Navigator id="fan-audio" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AudioIndex" component={LazyAudioScreen} />
      <Stack.Screen name="Artist" component={LazyArtistScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ArtistSubscription" component={LazyArtistSubscriptionScreen} />
      <Stack.Screen name="ContentPlayer" component={LazyContentPlayerScreen} />
      <Stack.Screen name="SubscriptionFlow" component={LazySubscriptionFlowScreen} />
      <Stack.Screen
        name="FullPlayer"
        component={LazyFullPlayerScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}
