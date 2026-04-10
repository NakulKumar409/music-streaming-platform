import { pool } from "../../common/db";
import { NotificationService } from "../notifications/notification.service";
import { logger } from "../../common/logger";

export class WinBackService {
  /**
   * Processes a churned user and sends a predictive "Win-back" offer.
   */
  static async processChurnedUser(userId: number, subscriptionId: number, type: string, artistId?: number) {
    try {
      // 1. Audit log the churn event
      await pool.query(`
        INSERT INTO subscription_audit_logs (user_id, subscription_id, event_type, metadata)
        VALUES ($1, $2, 'WINBACK_SESSION_STARTED', $3)
      `, [userId, subscriptionId, JSON.stringify({ type, artistId })]);

      // 2. Predictive check: Is this a high-value user?
      // Logic: If they had >=2 previous audit logs for 'PAYMENT_SUCCESS', they are loyal.
      const loyaltyRes = await pool.query(`
        SELECT COUNT(*) as successes
        FROM subscription_audit_logs
        WHERE user_id = $1 AND event_type = 'PAYMENT_SUCCESS'
      `, [userId]);

      const isHighValue = parseInt(loyaltyRes.rows[0].successes || '0') >= 2;
      const discount = isHighValue ? "30% OFF" : "20% OFF";
      const couponCode = isHighValue ? "LOYAL30" : "COMEBACK20";

      // 3. Send the notification
      const subject = isHighValue ? "We miss you! Special 30% Offer inside 🎁" : "Come back to Premium! 🎁";
      const body = isHighValue 
        ? `You've been a loyal fan. Get 30% OFF your next month if you re-activate in the next 48 hours! Use code: ${couponCode}`
        : `Get 20% OFF your next month if you re-activate today! Use code: ${couponCode}`;

      await NotificationService.sendToUser({
        userId: String(userId),
        title: subject,
        body: body,
        data: { 
          type: "win_back_offer", 
          discount, 
          couponCode,
          artistId: artistId ? String(artistId) : undefined 
        }
      });

      logger.info({ userId, discount }, "[WinBackService] Win-back offer sent");

    } catch (err) {
      logger.error(err, "[WinBackService] processChurnedUser failed");
    }
  }
}
