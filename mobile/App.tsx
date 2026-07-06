import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Sentry from '@sentry/react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import AppNavigator from './apps/fan/src/navigation/AppNavigator';
import { AuthProvider } from './apps/fan/src/store/authStore';
import { ConnectivityProvider } from './apps/fan/src/providers/ConnectivityProvider';
import { MediaPlayerProvider } from './apps/fan/src/providers/MediaPlayerProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './apps/fan/src/ui/ErrorBoundary';
import { applyTheme, DEFAULT_THEME_ID } from './apps/fan/src/config/themeConfig';

if (Platform.OS === 'web') {
  const savedTheme = localStorage.getItem('global-theme') || DEFAULT_THEME_ID;
  applyTheme(savedTheme);
}


const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (sentryDsn && sentryDsn !== 'your_mobile_sentry_dsn_here' && sentryDsn.startsWith('https://')) {
  Sentry.init({
    dsn: sentryDsn,
    debug: __DEV__,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  useEffect(() => {
    // Lock entire app to portrait - video screen will handle its own orientation
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
  }, []);

  return (
    <ErrorBoundary label="Fan App">
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <ConnectivityProvider>
              <MediaPlayerProvider>
                <AppNavigator />
              </MediaPlayerProvider>
            </ConnectivityProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
