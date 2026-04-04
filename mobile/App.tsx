import 'react-native-gesture-handler';

import React from 'react';
import * as Sentry from '@sentry/react-native';
import AppNavigator from './apps/fan/src/navigation/AppNavigator';
import { AuthProvider } from './apps/fan/src/store/authStore';
import { ConnectivityProvider } from './apps/fan/src/providers/ConnectivityProvider';
import { MediaPlayerProvider } from './apps/fan/src/providers/MediaPlayerProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ErrorBoundary from './apps/fan/src/ui/ErrorBoundary';

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
