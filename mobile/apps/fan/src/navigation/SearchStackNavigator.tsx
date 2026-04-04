import React, { lazy } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LazyScreen from '../ui/LazyScreen';

const SearchScreen = lazy(() => import('../screens/SearchScreen'));
const FullPlayerScreen = lazy(() => import('../screens/FullPlayerScreen'));

const LazySearchScreen = LazyScreen(SearchScreen);
const LazyFullPlayerScreen = LazyScreen(FullPlayerScreen);
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
      <Stack.Screen name="SearchIndex" component={LazySearchScreen} />
      <Stack.Screen
        name="FullPlayer"
        component={LazyFullPlayerScreen}
        options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
      />
    </Stack.Navigator>
  );
}
