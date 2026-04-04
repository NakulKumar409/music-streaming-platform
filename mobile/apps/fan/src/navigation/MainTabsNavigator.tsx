import React, { lazy } from 'react';
import { StyleSheet } from 'react-native';

import { createBottomTabNavigator, type BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { Home as HomeIcon, Music, PlayCircle, Search, User } from 'lucide-react-native';
import LazyScreen from '../ui/LazyScreen';

const SearchStackNavigator = lazy(() => import('./SearchStackNavigator'));
const AccountStackNavigator = lazy(() => import('./AccountStackNavigator'));
const AudioStackNavigator = lazy(() => import('./AudioStackNavigator'));
const HomeStackNavigator = lazy(() => import('./HomeStackNavigator'));
const VideoStackNavigator = lazy(() => import('./VideoStackNavigator'));

const LazySearchStack = LazyScreen(SearchStackNavigator);
const LazyAccountStack = LazyScreen(AccountStackNavigator);
const LazyAudioStack = LazyScreen(AudioStackNavigator);
const LazyHomeStack = LazyScreen(HomeStackNavigator);
const LazyVideoStack = LazyScreen(VideoStackNavigator);

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
        tabBarBackground: () => (
          <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
        ),
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
      <Tab.Screen name="HomeTab" component={LazyHomeStack} options={{ title: 'Home' }} />
      <Tab.Screen name="SearchTab" component={LazySearchStack} options={{ title: 'Search' }} />
      <Tab.Screen name="AudioTab" component={LazyAudioStack} options={{ title: 'Audio' }} />
      <Tab.Screen name="VideoTab" component={LazyVideoStack} options={{ title: 'Video' }} />
      <Tab.Screen name="AccountTab" component={LazyAccountStack} options={{ title: 'Account' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
    backgroundColor: 'transparent',
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
