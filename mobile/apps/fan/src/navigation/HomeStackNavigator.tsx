import React, { lazy } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LazyScreen from '../ui/LazyScreen';

const ArtistScreen = lazy(() => import('../screens/ArtistScreen'));
const ArtistSubscriptionScreen = lazy(() => import('../screens/ArtistSubscriptionScreen'));
const ContentPlayerScreen = lazy(() => import('../screens/ContentPlayerScreen'));
const HomeScreen = lazy(() => import('../screens/HomeScreen'));
const SeeAllTrendingScreen = lazy(() => import('../screens/SeeAllTrendingScreen'));
const SubscriptionFlowScreen = lazy(() => import('../screens/SubscriptionFlowScreen'));
const SeeAllSongsScreen = lazy(() => import('../screens/SeeAllSongsScreen'));
const FullPlayerScreen = lazy(() => import('../screens/FullPlayerScreen'));

const LazyArtistScreen = LazyScreen(ArtistScreen);
const LazyArtistSubscriptionScreen = LazyScreen(ArtistSubscriptionScreen);
const LazyContentPlayerScreen = LazyScreen(ContentPlayerScreen);
const LazyHomeScreen = LazyScreen(HomeScreen);
const LazySeeAllTrendingScreen = LazyScreen(SeeAllTrendingScreen);
const LazySubscriptionFlowScreen = LazyScreen(SubscriptionFlowScreen);
const LazySeeAllSongsScreen = LazyScreen(SeeAllSongsScreen);
const LazyFullPlayerScreen = LazyScreen(FullPlayerScreen);

import type { MediaItem } from '../media.types';

export type HomeStackParamList = {
  HomeIndex: undefined;
  SeeAllSongs: undefined;
  SeeAllTrending: {
    artists?: any[];
  };
  Artist: {
    artistId?: string;
    unlocked?: boolean;
    contentId?: string;
  };
  SubscriptionFlow: {
    artistId?: string;
    artistName?: string;
    contentId?: string;
    artwork?: string;
  };
  ContentPlayer: {
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

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator id="fan-home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeIndex" component={LazyHomeScreen} />
      <Stack.Screen
        name="SeeAllSongs"
        component={LazySeeAllSongsScreen}
        options={{ headerShown: true, title: 'See All' }}
      />
      <Stack.Screen
        name="SeeAllTrending"
        component={LazySeeAllTrendingScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Artist"
        component={LazyArtistScreen}
        options={{ animation: 'slide_from_right' }}
      />
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
