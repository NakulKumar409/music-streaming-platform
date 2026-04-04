import React, {} from 'react';
import { StyleSheet } from 'react-native';

import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Home as HomeIcon, Music, PlayCircle, Search, User } from 'lucide-react-native';

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

export default function MainTabsNavigator() {
  return (
    <Tab.Navigator
      id="fan-tabs"
      screenOptions={({ route }): BottomTabNavigationOptions => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: styles.tabBar,
        tabBarIcon: ({ color, size }) => {
          const iconSize = size ?? 24;
          if (route.name === 'HomeTab') return <HomeIcon color={color} size={iconSize} />;
          if (route.name === 'SearchTab') return <Search color={color} size={iconSize} />;
          if (route.name === 'AudioTab') return <Music color={color} size={iconSize} />;
          if (route.name === 'VideoTab') return <PlayCircle color={color} size={iconSize} />;
          return <User color={color} size={iconSize} />;
        },
        tabBarItemStyle: styles.tabBarItem,
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: 'Home' }} />
      <Tab.Screen name="SearchTab" component={SearchStackNavigator} options={{ title: 'Search' }} />
      <Tab.Screen name="AudioTab" component={AudioStackNavigator} options={{ title: 'Audio' }} />
      <Tab.Screen name="VideoTab" component={VideoStackNavigator} options={{ title: 'Video' }} />
      <Tab.Screen name="AccountTab" component={AccountStackNavigator} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 84,
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  tabBarItem: {
    paddingTop: 8,
    paddingBottom: 10,
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 4,
  },
});
