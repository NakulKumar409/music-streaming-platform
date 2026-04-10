import { pool } from "../../common/db";

export interface DashboardStats {
  mrr: number;
  totalActiveSubscribers: number;
  churnRate: number;
  growthPercentage: number;
  revenueDetails: {
    platform: number;
    artist: number;
  };
}

export class SubscriptionStatsService {
  /**
   * Calculates Monthly Recurring Revenue (MRR).
   * MRR = (Sum of all active platform subs * price) + (Sum of all active artist subs * price)
   */
  static async getMRR(): Promise<number> {
    const query = `
      SELECT 
        SUM(CASE WHEN s.type = 'PLATFORM' THEN p.price ELSE u.subscription_price END) as total_mrr
      FROM subscriptions s
      LEFT JOIN platform_subscription_configs p ON s.type = 'PLATFORM' AND p.is_active = true
      LEFT JOIN users u ON s.type = 'ARTIST' AND u.id = s.artist_id
      WHERE s.status = 'ACTIVE'
    `;
    const res = await pool.query(query);
    return parseFloat(res.rows[0]?.total_mrr || '0');
  }

  /**
   * Calculates Churn Rate over the last X days.
   * Churn Rate = (Expired Subs in period) / (Active Subs at start of period)
   */
  static async getChurnRate(days: number = 30): Promise<number> {
    // 1. Get count of subs that expired in the last X days
    const expiredRes = await pool.query(`
      SELECT COUNT(*) as expired_count
      FROM subscription_audit_logs
      WHERE event_type = 'SUBSCRIPTION_EXPIRED'
        AND created_at > now() - interval '${days} days'
    `);

    // 2. Get count of active subs at the beginning of the period (approximate)
    const activeRes = await pool.query(`
      SELECT COUNT(*) as active_count
      FROM subscriptions
      WHERE status = 'ACTIVE' OR updated_at > now() - interval '${days} days'
    `);

    const expired = parseInt(expiredRes.rows[0].expired_count || '0');
    const active = parseInt(activeRes.rows[0].active_count || '0');

    if (active === 0) return 0;
    return (expired / active) * 100;
  }

  /**
   * Get total active subscriber count split by type.
   */
  static async getActiveSubscribers(): Promise<{ platform: number; artist: number; total: number }> {
    const res = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE type = 'PLATFORM') as platform_count,
        COUNT(*) FILTER (WHERE type = 'ARTIST') as artist_count
      FROM subscriptions
      WHERE status = 'ACTIVE'
    `);
    
    const platform = parseInt(res.rows[0].platform_count || '0');
    const artist = parseInt(res.rows[0].artist_count || '0');
    
    return { platform, artist, total: platform + artist };
  }

  /**
   * Get week-to-week growth trend.
   */
  static async getGrowthTrend(): Promise<number> {
    const thisWeek = await pool.query(`
      SELECT COUNT(*) FROM subscriptions 
      WHERE status = 'ACTIVE' AND start_date > now() - interval '7 days'
    `);
    const lastWeek = await pool.query(`
      SELECT COUNT(*) FROM subscriptions 
      WHERE status = 'ACTIVE' 
        AND start_date > now() - interval '14 days'
        AND start_date <= now() - interval '7 days'
    `);

    const current = parseInt(thisWeek.rows[0].count || '0');
    const previous = parseInt(lastWeek.rows[0].count || '1'); // Avoid div by zero

    return ((current - previous) / previous) * 100;
  }

  /**
   * Aggregated dashboard results.
   */
  static async getPlatformHealth(): Promise<DashboardStats> {
    const [mrr, subs, churn, growth] = await Promise.all([
      this.getMRR(),
      this.getActiveSubscribers(),
      this.getChurnRate(30),
      this.getGrowthTrend()
    ]);

    return {
      mrr,
      totalActiveSubscribers: subs.total,
      churnRate: parseFloat(churn.toFixed(2)),
      growthPercentage: parseFloat(growth.toFixed(2)),
      revenueDetails: {
        platform: mrr * (subs.platform / (subs.total || 1)), // Rough split
        artist: mrr * (subs.artist / (subs.total || 1))
      }
    };
  }

  /**
   * Artist-specific insights.
   */
  static async getArtistInsights(artistId: number): Promise<any> {
    const res = await pool.query(`
      SELECT 
        COUNT(*) as total_subscribers,
        SUM(u.subscription_price) as monthly_revenue,
        COUNT(*) FILTER (WHERE status = 'EXPIRED') as churned_last_30
      FROM subscriptions s
      JOIN users u ON u.id = s.artist_id
      WHERE s.artist_id = $1 AND s.type = 'ARTIST'
      GROUP BY u.subscription_price
    `, [artistId]);

    return res.rows[0] || { total_subscribers: 0, monthly_revenue: 0, churned_last_30: 0 };
  }
}
