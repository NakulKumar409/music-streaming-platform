import { Request, Response } from "express";
import { SubscriptionStatsService } from "../shared/analytics/subscription-stats.service";
import { logger } from "../common/logger";

export class AnalyticsController {
  /**
   * Admin-only: Get global platform subscription health.
   */
  static async getPlatformSubscriptionHealth(req: Request, res: Response) {
    try {
      const stats = await SubscriptionStatsService.getPlatformHealth();
      return res.json({
        success: true,
        data: stats
      });
    } catch (err) {
      logger.error(err, "[AnalyticsController] getPlatformSubscriptionHealth failed");
      return res.status(500).json({
        success: false,
        message: "Failed to calculate platform metrics"
      });
    }
  }

  /**
   * Artist-only: Get insights for their specific channel.
   */
  static async getArtistSubscriptionInsights(req: Request, res: Response) {
    try {
      const artistId = (req as any).user?.id;
      if (!artistId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const insights = await SubscriptionStatsService.getArtistInsights(artistId);
      return res.json({
        success: true,
        data: insights
      });
    } catch (err) {
      logger.error(err, "[AnalyticsController] getArtistSubscriptionInsights failed");
      return res.status(500).json({
        success: false,
        message: "Failed to calculate artist insights"
      });
    }
  }
}
