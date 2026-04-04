import React, {} from 'react';

import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LibraryScreen from '../screens/LibraryScreen';
import SubscriptionDetail from '../screens/SubscriptionDetail';


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
      <Stack.Screen name="LibraryIndex" component={LibraryScreen} />
      <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetail} />
    </Stack.Navigator>
  );
}
