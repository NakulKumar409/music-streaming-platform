import { Request, Response } from "express";
import { pool } from "../common/db";
import { logger } from "../common/logger";

// Amounts stored in paise, will convert to INR (divide by 100)

export const getAdminDashboardMetrics = async (req: Request, res: Response) => {
  try {
    // Parse optional date range from query params
    const startDateStr = String(req.query.startDate || '');
    const endDateStr = String(req.query.endDate || '');
    const startDate = startDateStr && startDateStr !== 'undefined' && !isNaN(Date.parse(startDateStr)) ? new Date(startDateStr) : null;
    const endDate = endDateStr && endDateStr !== 'undefined' && !isNaN(Date.parse(endDateStr)) ? new Date(endDateStr) : null;
    
    // Build date filter clauses
    let paymentsDateFilter = "status = 'SUCCESS'";
    let transactionsDateFilter = "UPPER(status) = 'CAPTURED' OR UPPER(status) = 'SUCCESS'";
    const queryParams: any[] = [];
    
    if (startDate && endDate) {
      paymentsDateFilter = "status = 'SUCCESS' AND created_at >= $1 AND created_at <= $2";
      transactionsDateFilter = "(UPPER(status) = 'CAPTURED' OR UPPER(status) = 'SUCCESS') AND date >= $1 AND date <= $2";
      queryParams.push(startDate.toISOString(), endDate.toISOString());
    }

    // 1. Total Revenue from payments table - convert paise -> INR
    const revenueRow = await pool.query(
      `SELECT SUM(amount)::numeric as total FROM payments WHERE ${paymentsDateFilter}`,
      queryParams
    );
    const paymentsRevenue = Number(revenueRow.rows[0]?.total || 0) / 100;
    
    // Also get revenue from transactions table (for records that might not be in payments)
    const transactionsRevenueRow = await pool.query(
      `SELECT SUM(amount)::numeric as total FROM transactions WHERE ${transactionsDateFilter}`,
      queryParams
    );
    const transactionsRevenue = Number(transactionsRevenueRow.rows[0]?.total || 0) / 100;
    
    // Use the higher of the two values for complete revenue picture
    const totalRevenue = Math.max(paymentsRevenue, transactionsRevenue);

    // 2. Active Subscribers - only PLATFORM subscriptions (fans who paid)
    const activeSubRow = await pool.query(
      `SELECT COUNT(*)::int as count FROM subscriptions 
       WHERE UPPER(type) = 'PLATFORM' AND (UPPER(status) = 'ACTIVE' OR UPPER(status) = 'GRACE')`
    );
    const activeSubscribers = Number(activeSubRow.rows[0]?.count || 0);
    console.log(`[ANALYTICS-DEBUG] Active PLATFORM subscribers: ${activeSubscribers}`);
    
    // Debug: Check all subscription types and statuses
    const debugTypes = await pool.query(`SELECT DISTINCT type, status, COUNT(*) as count FROM subscriptions GROUP BY type, status`);
    console.log(`[ANALYTICS-DEBUG] All subscription types/statuses:`, debugTypes.rows);

    // 3. Revenue per Artist
    let artistRevenueQuery = `
      SELECT u.name as artist_name, SUM(p.amount)::numeric as amount
       FROM payments p
       JOIN subscriptions s ON p.subscription_id = s.id
       JOIN users u ON s.artist_id = u.id
       WHERE p.status = 'SUCCESS' AND s.type = 'ARTIST'`;
    
    const artistRevenueParams: any[] = [];
    if (startDate && endDate) {
      artistRevenueQuery += ` AND p.created_at >= $1 AND p.created_at <= $2`;
      artistRevenueParams.push(startDate.toISOString(), endDate.toISOString());
    }
    artistRevenueQuery += ` GROUP BY u.name ORDER BY amount DESC LIMIT 5`;
    
    const artistRevenueRow = await pool.query(artistRevenueQuery, artistRevenueParams);
    const revenuePerArtist = artistRevenueRow.rows.map(r => ({
      name: r.artist_name,
      revenue: Number(r.amount) / 100
    }));

    // 4. Conversion Rate (Subscribers / Total Users)
    // Count all FAN users (those who can subscribe to platform)
    const usersCountRow = await pool.query("SELECT COUNT(*)::int as count FROM users WHERE role = 'FAN'");
    const totalUsers = Number(usersCountRow.rows[0]?.count || 0);
    const conversionRate = totalUsers > 0 ? (activeSubscribers / totalUsers) * 100 : 0;
    console.log(`[ANALYTICS-DEBUG] Conversion calc: ${activeSubscribers} subscribers / ${totalUsers} users = ${conversionRate}%`);

    // 5. Daily Revenue Trend
    let dailyRevenueQuery = `
      SELECT 
        DATE_TRUNC('day', created_at)::date as date, 
        SUM(amount)::numeric as daily_total
      FROM payments 
      WHERE status = 'SUCCESS'`;
    
    const dailyRevenueParams: any[] = [];
    if (startDate && endDate) {
      dailyRevenueQuery += ` AND created_at >= $1 AND created_at <= $2`;
      dailyRevenueParams.push(startDate.toISOString(), endDate.toISOString());
    } else {
      dailyRevenueQuery += ` AND created_at > now() - interval '30 days'`;
    }
    dailyRevenueQuery += ` GROUP BY 1 ORDER BY 1 ASC`;
    
    const dailyRevenueRow = await pool.query(dailyRevenueQuery, dailyRevenueParams);
    const dailyTrends = dailyRevenueRow.rows.map(r => ({
      date: r.date,
      amount: Number(r.daily_total) / 100
    }));

    // 6. Growth Metrics (MoM) - date range doesn't apply here
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
      },
      currency: "INR",
      _debug: {
        paymentsRevenue,
        transactionsRevenue,
        dateRange: startDate && endDate ? { startDate, endDate } : null
      }
    });
  } catch (error) {
    logger.error({ error }, "Error fetching admin dashboard metrics");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
