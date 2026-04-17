/**
 * Hook para monitorear el estado de conectividad de red.
 *
 * En nativo usa expo-network. En web usa navigator.onLine.
 */

import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';

export interface NetworkStatus {
  isOnline: boolean;
  isLoading: boolean;
}

export function useNetworkStatus(pollIntervalMs = 5000): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const checkConnection = useCallback(async () => {
    if (Platform.OS === 'web') {
      setIsOnline(navigator.onLine);
      setIsLoading(false);
      return;
    }

    try {
      const Network = await import('expo-network');
      const state = await Network.getNetworkStateAsync();
      setIsOnline(!!(state.isConnected && state.isInternetReachable));
    } catch {
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
    const interval = setInterval(checkConnection, pollIntervalMs);

    // Web: also listen to online/offline events
    if (Platform.OS === 'web') {
      const goOnline = () => setIsOnline(true);
      const goOffline = () => setIsOnline(false);
      window.addEventListener('online', goOnline);
      window.addEventListener('offline', goOffline);
      return () => {
        clearInterval(interval);
        window.removeEventListener('online', goOnline);
        window.removeEventListener('offline', goOffline);
      };
    }

    return () => clearInterval(interval);
  }, [checkConnection, pollIntervalMs]);

  return { isOnline, isLoading };
}
