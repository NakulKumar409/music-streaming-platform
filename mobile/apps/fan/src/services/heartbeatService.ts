import { apiV1 } from './api';

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let currentContentId: string | null = null;

/**
 * Start sending heartbeats to track listening time
 * @param contentId - The ID of the content being played
 */
export function startHeartbeat(contentId: string) {
  stopHeartbeat(); // Clear any existing heartbeat
  
  currentContentId = contentId;
  
  // Send heartbeat every 30 seconds
  heartbeatInterval = setInterval(async () => {
    try {
      const response = await apiV1.post('/stream/heartbeat', { contentId });

      if (!response.data.success) {
        console.warn('[Heartbeat] Failed to send heartbeat:', response.data.message);
      }
    } catch (error: any) {
      console.error('[Heartbeat] Error sending heartbeat:', error?.response?.status || error?.message);
    }
  }, 30000); // 30 seconds

  console.log('[Heartbeat] Started for content:', contentId);
}

/**
 * Stop sending heartbeats
 */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    currentContentId = null;
    console.log('[Heartbeat] Stopped');
  }
}

/**
 * Check if heartbeat is currently active
 */
export function isHeartbeatActive(): boolean {
  return heartbeatInterval !== null;
}
