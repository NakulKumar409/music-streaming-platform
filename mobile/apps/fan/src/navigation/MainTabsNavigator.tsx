import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import BottomNavigation, { type BottomNavTab } from '../components/BottomNavigation';

import SearchStackNavigator from './SearchStackNavigator';
import AccountStackNavigator from './AccountStackNavigator';
import AudioStackNavigator from './AudioStackNavigator';
import HomeStackNavigator from './HomeStackNavigator';
import VideoStackNavigator from './VideoStackNavigator';

export type MainTabParamList = {
  HomeTab: undefined;
  SearchTab: undefined;
  AudioTab: undefined;
  VideoTab: undefined;
  AccountTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const ROUTE_TO_TAB: Record<string, BottomNavTab> = {
  HomeTab: 'home',
  SearchTab: 'search',
  AudioTab: 'audio',
  VideoTab: 'video',
  AccountTab: 'account',
};

export default function MainTabsNavigator() {
  return (
    <Tab.Navigator
      id="fan-tabs"
      tabBar={({ state, navigation }) => {
        const currentRoute = state.routes[state.index]?.name || 'HomeTab';
        const activeTab = ROUTE_TO_TAB[currentRoute] || 'home';

        return (
          <BottomNavigation
            activeTab={activeTab}
            onHomePress={() => navigation.navigate('HomeTab')}
            onSearchPress={() => navigation.navigate('SearchTab')}
            onAudioPress={() => navigation.navigate('AudioTab')}
            onVideoPress={() => navigation.navigate('VideoTab')}
            onAccountPress={() => navigation.navigate('AccountTab')}
          />
        );
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="SearchTab" component={SearchStackNavigator} options={{ title: 'Search' }} />
      <Tab.Screen name="AudioTab" component={AudioStackNavigator} options={{ title: 'Audio' }} />
      <Tab.Screen name="VideoTab" component={VideoStackNavigator} options={{ title: 'Video' }} />
      <Tab.Screen name="AccountTab" component={AccountStackNavigator} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}
