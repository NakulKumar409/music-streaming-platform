import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ArtistScreen from '../screens/ArtistScreen';
import ArtistSubscriptionScreen from '../screens/ArtistSubscriptionScreen';
import AudioScreen from '../screens/AudioScreen';
import ContentPlayerScreen from '../screens/ContentPlayerScreen';
import SubscriptionFlowScreen from '../screens/SubscriptionFlowScreen';

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
};

const Stack = createNativeStackNavigator<AudioStackParamList>();

export default function AudioStackNavigator() {
  return (
    <Stack.Navigator id="fan-audio" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AudioIndex" component={AudioScreen} />
      <Stack.Screen name="Artist" component={ArtistScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ArtistSubscription" component={ArtistSubscriptionScreen} />
      <Stack.Screen name="ContentPlayer" component={ContentPlayerScreen} />
      <Stack.Screen name="SubscriptionFlow" component={SubscriptionFlowScreen} />
    </Stack.Navigator>
  );
}
