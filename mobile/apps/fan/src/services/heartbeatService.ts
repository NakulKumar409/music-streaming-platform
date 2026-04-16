import { apiV1 } from './api';
import logger from '../utils/logger';

let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let currentContentId: string | null = null;

/**
 * Start sending heartbeats to track listening time
 * @param contentId - The ID of the content being played
 */
export function startHeartbeat(contentId: string) {
  stopHeartbeat(); // Clear any existing heartbeat
  
  currentContentId = contentId;

  // Send an immediate heartbeat right when playback starts
  const sendBeat = async () => {
    try {
      const response = await apiV1.post('/stream/heartbeat', { contentId });
      if (!response.data.success) {
        logger.warn('[Heartbeat] Failed to send heartbeat:', response.data.message);
      }
    } catch (error: any) {
      logger.error('[Heartbeat] Error sending heartbeat:', error?.response?.status || error?.message);
    }
  };

  // Fire immediately on start
  sendBeat();
  
  // Then every 30 seconds
  heartbeatInterval = setInterval(sendBeat, 30000);

  logger.log('[Heartbeat] Started for content:', contentId);
}

/**
 * Stop sending heartbeats
 */
export function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    currentContentId = null;
    logger.log('[Heartbeat] Stopped');
  }
}

/**
 * Check if heartbeat is currently active
 */
export function isHeartbeatActive(): boolean {
  return heartbeatInterval !== null;
}
