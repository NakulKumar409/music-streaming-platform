import { Request, Response } from "express";
import { pool } from "../common/db";
import { logger } from "../common/logger";

export const getAdminDashboardMetrics = async (req: Request, res: Response) => {
  try {
    // 1. Total Revenue (from payments table)
    const revenueRow = await pool.query(
      `SELECT SUM(amount)::numeric as total FROM payments WHERE status = 'SUCCESS'`
    );
    const totalRevenue = Number(revenueRow.rows[0]?.total || 0) / 100; // Convert paise to INR

    // 2. Active Subscribers
    const activeSubRow = await pool.query(
      `SELECT COUNT(*)::int as count FROM subscriptions 
       WHERE status = 'ACTIVE' OR status = 'GRACE'`
    );
    const activeSubscribers = Number(activeSubRow.rows[0]?.count || 0);

    // 3. Revenue per Artist
    const artistRevenueRow = await pool.query(
      `SELECT u.name as artist_name, SUM(p.amount)::numeric as amount
       FROM payments p
       JOIN subscriptions s ON p.subscription_id = s.id
       JOIN users u ON s.artist_id = u.id
       WHERE p.status = 'SUCCESS' AND s.type = 'ARTIST'
       GROUP BY u.name
       ORDER BY amount DESC
       LIMIT 5`
    );
    const revenuePerArtist = artistRevenueRow.rows.map(r => ({
      name: r.artist_name,
      revenue: Number(r.amount) / 100
    }));

    // 4. Conversion Rate (Subscribers / Total Users)
    const usersCountRow = await pool.query("SELECT COUNT(*)::int as count FROM users WHERE role = 'USER'");
    const totalUsers = Number(usersCountRow.rows[0]?.count || 0);
    const conversionRate = totalUsers > 0 ? (activeSubscribers / totalUsers) * 100 : 0;

    // 5. Daily Revenue Trend (Last 30 Days)
    const dailyRevenueRow = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at)::date as date, 
        SUM(amount)::numeric as daily_total
      FROM payments 
      WHERE status = 'SUCCESS' AND created_at > now() - interval '30 days'
      GROUP BY 1 ORDER BY 1 ASC
    `);
    const dailyTrends = dailyRevenueRow.rows.map(r => ({
      date: r.date,
      amount: Number(r.daily_total) / 100
    }));

    // 6. Growth Metrics (MoM)
    const currentMonthRev = await pool.query(`
      SELECT SUM(amount)::numeric as total FROM payments 
      WHERE status = 'SUCCESS' AND created_at > DATE_TRUNC('month', now())
    `);
    const lastMonthRev = await pool.query(`
      SELECT SUM(amount)::numeric as total FROM payments 
      WHERE status = 'SUCCESS' 
        AND created_at > DATE_TRUNC('month', now() - interval '1 month')
        AND created_at < DATE_TRUNC('month', now())
    `);
    
    const curMonth = Number(currentMonthRev.rows[0]?.total || 0) / 100;
    const prevMonth = Number(lastMonthRev.rows[0]?.total || 0) / 100;
    const momGrowth = prevMonth > 0 ? ((curMonth - prevMonth) / prevMonth) * 100 : 0;

    // 7. ARPU & Churn (Estimated)
    const arpu = activeSubscribers > 0 ? totalRevenue / activeSubscribers : 0;
    
    const expiredCountRow = await pool.query(
      "SELECT COUNT(*)::int as count FROM subscriptions WHERE status = 'EXPIRED' AND updated_at > now() - interval '30 days'"
    );
    const expiredLast30 = Number(expiredCountRow.rows[0]?.count || 0);
    const churnRate = activeSubscribers > 0 ? (expiredLast30 / (activeSubscribers + expiredLast30)) * 100 : 0;

    // 8. Recent Subscriptions
    const recentSubRow = await pool.query(
      `SELECT s.type, u.email as user_email, u2.name as artist_name, s.status, s.created_at
       FROM subscriptions s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN users u2 ON s.artist_id = u2.id
       ORDER BY s.created_at DESC
       LIMIT 10`
    );

    return res.json({
      success: true,
      metrics: {
        totalRevenue,
        activeSubscribers,
        conversionRate: conversionRate.toFixed(2) + "%",
        revenuePerArtist,
        dailyTrends,
        growth: {
          monthlyRevenue: curMonth,
          prevMonthlyRevenue: prevMonth,
          momPercentage: momGrowth.toFixed(1) + "%"
        },
        unitEconomics: {
          arpu: Math.round(arpu),
          churnRate: churnRate.toFixed(1) + "%"
        },
        recentSubscriptions: recentSubRow.rows
      }
    });
  } catch (error) {
    logger.error({ error }, "Error fetching admin dashboard metrics");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
