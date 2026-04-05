import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiV1 } from './api';

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Request notification permissions from the OS.
 * Returns the final status string.
 */
export async function requestNotificationPermissions(): Promise<NotificationPermissionStatus> {
  if (!Device.isDevice) {
    // On iOS Simulator, we can still get a "granted" status but no real delivery
    console.warn('[Notifications] Running on a simulator - push won\'t deliver on real device lock screen');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  // iOS: register notification categories/channels
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FFD700',
    });
  }

  return finalStatus as NotificationPermissionStatus;
}

/**
 * Fetches the Expo Push Token for this device.
 * The token looks like: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
 */
export async function getExpoPushToken(): Promise<string | null> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({
      projectId: 'fan-app', // Your Expo project ID
    });
    return data;
  } catch (err: any) {
    if (!Device.isDevice) {
      // Mock for simulator so we can test the backend sync
      const mockToken = `ExponentPushToken[SIM_MOCK_${Math.random().toString(36).substring(7)}]`;
      console.warn(`[Notifications] Real token failed on Simulator: ${err.message}. Using Mock: ${mockToken}`);
      return mockToken;
    }
    console.error('[Notifications] Failed to get push token:', err.message);
    return null;
  }
}

/**
 * Full flow: Request permission → get token → sync to backend.
 * Returns { success, token, status }
 */
export async function registerForPushNotifications(): Promise<{
  success: boolean;
  token: string | null;
  status: NotificationPermissionStatus;
}> {
  const status = await requestNotificationPermissions();

  if (status !== 'granted') {
    return { success: false, token: null, status };
  }

  const token = await getExpoPushToken();

  if (token) {
    try {
      // Save token + preference to backend
      await apiV1.put('/user/settings', {
        pushNotifications: true,
        expoPushToken: token,
      });
      console.log('[Notifications] Token registered with backend:', token);
    } catch (err) {
      console.error('[Notifications] Failed to sync token to backend:', err);
    }
  }

  return { success: !!token, token, status };
}

/**
 * Disable push notifications - clear backend preference.
 */
export async function disablePushNotifications(): Promise<void> {
  try {
    await apiV1.put('/user/settings', {
      pushNotifications: false,
    });
    console.log('[Notifications] Push notifications disabled on backend');
  } catch (err) {
    console.error('[Notifications] Failed to disable on backend:', err);
  }
}
