import React, { lazy } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LazyScreen from '../ui/LazyScreen';

const LibraryScreen = lazy(() => import('../screens/LibraryScreen'));
const SubscriptionDetail = lazy(() => import('../screens/SubscriptionDetail'));

const LazyLibraryScreen = LazyScreen(LibraryScreen);
const LazySubscriptionDetail = LazyScreen(SubscriptionDetail);

export type LibraryStackParamList = {
  LibraryIndex: undefined;
  SubscriptionDetail: {
    artistId: string;
  };
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export default function LibraryStackNavigator() {
  return (
    <Stack.Navigator id="fan-library" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LibraryIndex" component={LazyLibraryScreen} />
      <Stack.Screen name="SubscriptionDetail" component={LazySubscriptionDetail} />
    </Stack.Navigator>
  );
}
