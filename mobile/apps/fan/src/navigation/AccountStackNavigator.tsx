import React from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AccountScreen from '../screens/AccountScreen';
import MyLibraryScreen from '../screens/MyLibraryScreen';
import SubscriptionDetail from '../screens/SubscriptionDetail';

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
      <Stack.Screen name="AccountIndex" component={AccountScreen} />
      <Stack.Screen name="MyLibrary" component={MyLibraryScreen} />
      <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetail} />
    </Stack.Navigator>
  );
}
