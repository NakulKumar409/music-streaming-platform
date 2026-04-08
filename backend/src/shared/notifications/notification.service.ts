import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { pool } from "../../common/db";
import { logger } from "../../common/logger";

const expo = new Expo();

export interface SendPushInput {
  userId: string;
  title: string;
  body: string;
  data?: any;
  sound?: "default" | null;
}

export class NotificationService {
  /**
   * Sends a push notification to a specific user.
   * Handles token validation and user preferences.
   */
  static async sendToUser(input: SendPushInput): Promise<boolean> {
    const { userId, title, body, data, sound = "default" } = input;

    try {
      // 1. Fetch user token and preferences
      const userRes = await pool.query(
        "SELECT expo_push_token, notifications_pref FROM users WHERE id = $1",
        [userId]
      );

      if (userRes.rows.length === 0) return false;
      const user = userRes.rows[0];

      // 2. Check if user has push enabled and has a token
      if (!user.notifications_pref || !user.expo_push_token) {
        logger.debug("[NotificationService] Skipping push for user %s: Disabled or no token", userId);
        return false;
      }

      const token = user.expo_push_token;

      // 3. Validate token (handle mocks for simulator testing)
      const isMock = token.startsWith("ExponentPushToken[SIM_MOCK_");
      if (!isMock && !Expo.isExpoPushToken(token)) {
        logger.warn("[NotificationService] Invalid push token for user %s: %s", userId, token);
        return false;
      }

      if (isMock) {
        logger.info("[NotificationService] [MOCK] Sending push to user %s: %s - %s", userId, title, body);
        return true;
      }

      // 4. Send real notification via Expo
      const messages: ExpoPushMessage[] = [{
        to: token,
        sound: sound || undefined,
        title,
        body,
        data,
      }];

      const chunks = expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          logger.error(error, "[NotificationService] Error sending chunk");
        }
      }

      logger.info("[NotificationService] Push sent to user %s. Status: %j", userId, tickets);
      return true;
    } catch (error) {
      logger.error(error, "[NotificationService] Failed to send push to user %s", userId);
      return false;
    }
  }

  /**
   * Sends a push notification to multiple users (e.g., all subscribers of an artist)
   */
  static async sendToMultipleUsers(userIds: string[], input: Omit<SendPushInput, "userId">): Promise<number> {
    let successCount = 0;
    // For simplicity and to reuse sendToUser's logic (which handles prefs/tokens), we loop.
    // In high-scale production, we would chunk these into a single Expo call.
    for (const userId of userIds) {
       const success = await this.sendToUser({ userId, ...input });
       if (success) successCount++;
    }
    return successCount;
  }
}
