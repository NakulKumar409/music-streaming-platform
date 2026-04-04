import React, { lazy } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LazyScreen from '../ui/LazyScreen';

const ArtistScreen = lazy(() => import('../screens/ArtistScreen'));
const ArtistSubscriptionScreen = lazy(() => import('../screens/ArtistSubscriptionScreen'));
const ContentPlayerScreen = lazy(() => import('../screens/ContentPlayerScreen'));
const SubscriptionFlowScreen = lazy(() => import('../screens/SubscriptionFlowScreen'));
const VideoScreen = lazy(() => import('../screens/VideoScreen'));

const LazyArtistScreen = LazyScreen(ArtistScreen);
const LazyArtistSubscriptionScreen = LazyScreen(ArtistSubscriptionScreen);
const LazyContentPlayerScreen = LazyScreen(ContentPlayerScreen);
const LazySubscriptionFlowScreen = LazyScreen(SubscriptionFlowScreen);
const LazyVideoScreen = LazyScreen(VideoScreen);

export type VideoStackParamList = {
  VideoIndex: undefined;
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
};

const Stack = createNativeStackNavigator<VideoStackParamList>();

export default function VideoStackNavigator() {
  return (
    <Stack.Navigator id="fan-video" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VideoIndex" component={LazyVideoScreen} />
      <Stack.Screen name="Artist" component={LazyArtistScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ArtistSubscription" component={LazyArtistSubscriptionScreen} />
      <Stack.Screen name="ContentPlayer" component={LazyContentPlayerScreen} />
      <Stack.Screen name="SubscriptionFlow" component={LazySubscriptionFlowScreen} />
    </Stack.Navigator>
  );
}
