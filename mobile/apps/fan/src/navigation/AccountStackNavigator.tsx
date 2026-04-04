import React, { lazy } from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LazyScreen from '../ui/LazyScreen';

const AccountScreen = lazy(() => import('../screens/AccountScreen'));
const MyLibraryScreen = lazy(() => import('../screens/MyLibraryScreen'));
const SubscriptionDetail = lazy(() => import('../screens/SubscriptionDetail'));

const LazyAccountScreen = LazyScreen(AccountScreen);
const LazyMyLibraryScreen = LazyScreen(MyLibraryScreen);
const LazySubscriptionDetail = LazyScreen(SubscriptionDetail);

export type AccountStackParamList = {
  AccountIndex: undefined;
  MyLibrary: undefined;
  SubscriptionDetail: {
    artistId: string;
  };
};

const Stack = createNativeStackNavigator<AccountStackParamList>();

export default function AccountStackNavigator() {
  return (
    <Stack.Navigator id="fan-account" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountIndex" component={LazyAccountScreen} />
      <Stack.Screen name="MyLibrary" component={LazyMyLibraryScreen} />
      <Stack.Screen name="SubscriptionDetail" component={LazySubscriptionDetail} />
    </Stack.Navigator>
  );
}
