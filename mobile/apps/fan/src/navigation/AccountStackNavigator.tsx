import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import AccountScreen from '../screens/AccountScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MyLibraryScreen from '../screens/MyLibraryScreen';
import SubscriptionDetail from '../screens/SubscriptionDetail';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import SubscriptionFlowScreen from '../screens/SubscriptionFlowScreen';

export type AccountStackParamList = {
  AccountIndex: undefined;
  EditProfile: undefined;
  MyLibrary: undefined;
  ChangePassword: undefined;
  SubscriptionDetail: {
    artistId?: string;
    type?: 'ARTIST' | 'PLATFORM';
  };
  SubscriptionFlow: {
    artistId?: string;
    artistName?: string;
    contentId?: string;
    artwork?: string;
    defaultPlan?: 'ARTIST' | 'PLATFORM';
  };
};

const Stack = createNativeStackNavigator<AccountStackParamList>();

export default function AccountStackNavigator() {
  return (
    <Stack.Navigator id="fan-account" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountIndex" component={AccountScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="MyLibrary" component={MyLibraryScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="SubscriptionDetail" component={SubscriptionDetail} />
      <Stack.Screen
        name="SubscriptionFlow"
        component={SubscriptionFlowScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
