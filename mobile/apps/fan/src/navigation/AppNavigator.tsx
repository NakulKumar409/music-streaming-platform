import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState, lazy } from 'react';

import { Platform } from 'react-native';
import SplashScreen from '../screens/SplashScreen';
import { useAuth } from '../store/authStore';
import { navigationRef } from './rootNavigation';
import { useMediaPlayer } from '../providers/MediaPlayerProvider';
import MediaPlayerOverlay from '../ui/MediaPlayerOverlay';
import LazyScreen from '../ui/LazyScreen';

import type { RootStackParamList } from './types';

const LoginScreen = lazy(() => import('../screens/LoginScreen'));
const SignupScreen = lazy(() => import('../screens/SignupScreen'));
const MainTabsNavigator = lazy(() => import('./MainTabsNavigator'));

const LazyLoginScreen = LazyScreen(LoginScreen);
const LazySignupScreen = LazyScreen(SignupScreen);
const LazyMainTabsNavigator = LazyScreen(MainTabsNavigator);

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { isAuthenticated, bootstrapAuth } = useAuth();
  const player = useMediaPlayer();
  const [isSplashVisible, setIsSplashVisible] = React.useState(true);
  const [currentRouteName, setCurrentRouteName] = useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const start = Date.now();

    (async () => {
      try {
        await bootstrapAuth();
      } finally {
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, 3000 - elapsed);
        setTimeout(() => {
          if (mounted) setIsSplashVisible(false);
        }, remaining);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [bootstrapAuth]);

  if (isSplashVisible) {
    return <SplashScreen />;
  }


  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator id="fan-root">
        {isAuthenticated ? (
          <Stack.Screen
            name="MainTabs"
            component={LazyMainTabsNavigator}
            options={{ headerShown: false }}
          />
        ) : (
          <>
            <Stack.Screen
              name="Login"
              component={LazyLoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Signup"
              component={LazySignupScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
      <MediaPlayerOverlay
        bottomSafeAreaPadding={Platform.OS === 'web' ? 12 : 0}
        state={player.state}
        currentItem={player.currentItem}
        togglePlayPause={player.togglePlayPause}
        skipNext={player.skipNext}
        skipPrev={player.skipPrev}
        seekTo={player.seekTo}
        toggleShuffle={player.toggleShuffle}
        cycleRepeatMode={player.cycleRepeatMode}
        setPlaybackRate={player.setPlaybackRate}
        setVolume={player.setVolume}
        close={player.close}
        setExpanded={player.setExpanded}
        inlineVideoHostActive={player.inlineVideoHostActive}
        inlineAudioHostActive={player.inlineAudioHostActive}
        onVideoPlaybackStatusUpdate={player.onVideoPlaybackStatusUpdate}
        videoPlayer={player.videoPlayer}
        audioPlayer={player.audioPlayer}
      />
    </NavigationContainer>
  );
}
