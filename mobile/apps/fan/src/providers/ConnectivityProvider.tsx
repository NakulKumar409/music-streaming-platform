import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import OfflineScreen from '../screens/OfflineScreen';
import logger from '../utils/logger';

// Try to import NetInfo, fallback for Expo Go compatibility
let NetInfo: any = null;
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch (e) {
  logger.warn('NetInfo not available, running in Expo Go without connectivity checks');
}

interface ConnectivityContextType {
  isConnected: boolean;
  isInternetReachable: boolean;
  checkConnection: () => Promise<void>;
}

const ConnectivityContext = createContext<ConnectivityContextType | undefined>(undefined);

interface ConnectivityProviderProps {
  children: ReactNode;
}

export const useConnectivity = () => {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error('useConnectivity must be used within a ConnectivityProvider');
  }
  return context;
};

export const ConnectivityProvider: React.FC<ConnectivityProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean>(true);
  const [showOfflineScreen, setShowOfflineScreen] = useState<boolean>(false);

  const lastRef = useRef({
    connected: true,
    reachable: true,
    showOffline: false,
  });

  const applyConnectivity = useCallback((connected: boolean, reachable: boolean) => {
    const nextShowOffline = !connected;
    const last = lastRef.current;

    const changed =
      last.connected !== connected ||
      last.reachable !== reachable ||
      last.showOffline !== nextShowOffline;

    if (!changed) return;

    logger.log('Network state changed:', { connected, reachable });

    lastRef.current = {
      connected,
      reachable,
      showOffline: nextShowOffline,
    };

    setIsConnected(connected);
    setIsInternetReachable(reachable);
    setShowOfflineScreen(nextShowOffline);
  }, []);

  const checkConnection = async () => {
    if (!NetInfo) {
      // Expo Go fallback - assume always connected
      applyConnectivity(true, true);
      return;
    }

    try {
      const netInfoState = await NetInfo.fetch();
      const connected = netInfoState.isConnected ?? false;
      const reachable = netInfoState.isInternetReachable;

      // NetInfo often reports isInternetReachable as null/false briefly; don't let it thrash UI.
      const stableReachable =
        typeof reachable === 'boolean'
          ? reachable
          : connected
            ? lastRef.current.reachable
            : false;

      applyConnectivity(connected, stableReachable);
    } catch (error) {
      logger.error('Error checking connection:', error);
      applyConnectivity(false, false);
    }
  };

  useEffect(() => {
    // Initial connection check
    checkConnection();

    if (!NetInfo) {
      // Expo Go fallback - no event listener available
      return;
    }

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state: any) => {
      const connected = state.isConnected ?? false;
      const reachable = state.isInternetReachable;

      const stableReachable =
        typeof reachable === 'boolean'
          ? reachable
          : connected
            ? lastRef.current.reachable
            : false;

      applyConnectivity(connected, stableReachable);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleRetry = () => {
    logger.log('Retry button pressed');
    checkConnection();
  };

  return (
    <ConnectivityContext.Provider
      value={{
        isConnected,
        isInternetReachable,
        checkConnection,
      }}
    >
      {children}
      {showOfflineScreen && <OfflineScreen onRetry={handleRetry} />}
    </ConnectivityContext.Provider>
  );
};
