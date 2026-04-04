import React, {} from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import SearchScreen from '../screens/SearchScreen';
import FullPlayerScreen from '../screens/FullPlayerScreen';

import type { MediaItem } from '../media.types';

export type SearchStackParamList = {
  SearchIndex: undefined;
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

const Stack = createNativeStackNavigator<SearchStackParamList>();

export default function SearchStackNavigator() {
  return (
    <Stack.Navigator id="fan-search" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchIndex" component={SearchScreen} />
      <Stack.Screen
        name="FullPlayer"
        component={FullPlayerScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}
