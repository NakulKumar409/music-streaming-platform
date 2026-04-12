import { Router } from "express";
import { requireAuth } from "../../common/auth/requireAuth";
import { pool } from "../../common/db";
import { getAdminDashboardMetrics } from "../../controllers/adminAnalyticsController";
import { AnalyticsController } from "../../controllers/analyticsController";

const router = Router();
router.get("/metrics", requireAuth, getAdminDashboardMetrics);
router.get("/subscription-health", requireAuth, AnalyticsController.getPlatformSubscriptionHealth);

const requireAdmin = (req: any, res: any, next: any) => {
  const role = (req.user?.role || "").toUpperCase();
  if (role !== "ADMIN") {
    return res.status(403).json({
      success: false,
      message: "Forbidden"
    });
  }
  return next();
};

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

const buildLastNDaysUtc = (days: number) => {
  const end = new Date();
  const out: { date: string }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    out.push({ date: toIsoDate(d) });
  }
  return out;
};

const safeScalarNumber = async (
  query: string,
  params: any[],
  defaultValue = 0
): Promise<number> => {
  try {
    const r = await pool.query(query, params);
    const v = r.rows?.[0]?.value;
    const n = Number(v);
    return Number.isFinite(n) ? n : defaultValue;
  } catch {
    return defaultValue;
  }
};

const safeRows = async <T = any>(
  query: string,
  params: any[],
  defaultValue: T[] = []
): Promise<T[]> => {
  try {
    const r = await pool.query(query, params);
    return (r.rows as T[]) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

router.get("/dashboard-data", requireAuth, requireAdmin, async (req, res) => {
  const totalArtists = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM users WHERE UPPER(role) = 'ARTIST'",
    []
  );

  // Active reports: content with reports (either FLAGGED status or report_count > 0, not DELETED)
  const activeReports = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM content_items WHERE (UPPER(COALESCE(status, '')) = 'FLAGGED' OR report_count > 0) AND UPPER(COALESCE(status, '')) != 'DELETED'",
    []
  );

  const totalActiveSubscriptions = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM subscriptions WHERE UPPER(status) = 'ACTIVE'",
    []
  );

  // Today's revenue from all successful payments (amount is in paise, divide by 100 for rupees)
  const revenueToday = await safeScalarNumber(
    "SELECT COALESCE(SUM(amount)/100, 0)::float as value FROM payments WHERE created_at >= $1 AND created_at < ($1::timestamptz + interval '1 day') AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID')",
    [startOfTodayUtc().toISOString()],
    0
  );

  // New subscriptions today
  const newSubscriptionsToday = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM subscriptions WHERE created_at >= $1 AND created_at < ($1::timestamptz + interval '1 day') AND (UPPER(COALESCE(type, 'NEW')) = 'NEW' OR type IS NULL)",
    [startOfTodayUtc().toISOString()],
    0
  );

  // Renewals today
  const renewalsToday = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM subscriptions WHERE created_at >= $1 AND created_at < ($1::timestamptz + interval '1 day') AND UPPER(COALESCE(type, '')) = 'RENEWAL'",
    [startOfTodayUtc().toISOString()],
    0
  );

  // Total active subscription value (MRR - Monthly Recurring Revenue)
  const totalActiveSubscriptionsValue = await safeScalarNumber(
    "SELECT COALESCE(SUM(plan_amount), 0)::float as value FROM subscriptions WHERE UPPER(status) = 'ACTIVE'",
    [],
    0
  );

  const draftCount = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM content_items WHERE UPPER(lifecycle_state) = 'DRAFT'",
    []
  );

  const failedPaymentsCount = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM payments WHERE UPPER(status) = 'FAILED'",
    []
  );

  const summary = {
    totalArtists,
    totalActiveSubscriptions,
    revenueToday,
    activeReports,
    subscriptionDetails: {
      newToday: newSubscriptionsToday,
      renewalsToday: renewalsToday,
      totalActiveValue: totalActiveSubscriptionsValue
    },
    alerts: {
      draftCount,
      failedPaymentsCount
    }
  };

  const end = new Date();
  const days: { date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    days.push({ date: toIsoDate(d) });
  }

  const startIso = days[0].date + "T00:00:00.000Z";

  const growthRows = await safeRows<{ date: string; value: number }>(
    "SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, COUNT(*)::int as value FROM subscriptions WHERE created_at >= $1 GROUP BY 1 ORDER BY 1 ASC",
    [startIso],
    []
  );

  const growthMap = new Map<string, number>();
  for (const r of growthRows) growthMap.set(r.date, Number(r.value) || 0);

  const growth = days.map((d) => ({
    date: d.date,
    value: growthMap.get(d.date) ?? 0
  }));

  const revenueRows = await safeRows<{ date: string; value: number }>(
    "SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, COALESCE(SUM(amount)/100, 0)::float as value FROM payments WHERE created_at >= $1 AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID') GROUP BY 1 ORDER BY 1 ASC",
    [startIso],
    []
  );

  const revenueMap = new Map<string, number>();
  for (const r of revenueRows) revenueMap.set(r.date, Number(r.value) || 0);

  const revenue = days.map((d) => ({
    date: d.date,
    value: revenueMap.get(d.date) ?? 0
  }));

  const drafts = await safeRows<{
    id: any;
    title: string | null;
    created_at: string;
  }>(
    "SELECT id, title, created_at FROM content_items WHERE UPPER(lifecycle_state) = 'DRAFT' ORDER BY created_at DESC LIMIT 5",
    [],
    []
  );

  const failedPayments = await safeRows<{
    id: any;
    amount: number;
    created_at: string;
    status: string;
  }>(
    "SELECT id, amount, created_at, status FROM payments WHERE UPPER(status) = 'FAILED' ORDER BY created_at DESC LIMIT 5",
    [],
    []
  );

  const alerts = {
    success: true,
    drafts,
    failedPayments
  };

  return res.json({
    success: true,
    summary,
    growth,
    revenue,
    alerts
  });
});

router.get("/summary", requireAuth, requireAdmin, async (req, res) => {
  const totalArtists = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM users WHERE UPPER(role) = 'ARTIST'",
    []
  );

  // Active reports: content with reports (either FLAGGED status or report_count > 0, not DELETED)
  const activeReports = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM content_items WHERE (UPPER(COALESCE(status, '')) = 'FLAGGED' OR report_count > 0) AND UPPER(COALESCE(status, '')) != 'DELETED'",
    []
  );

  const totalActiveSubscriptions = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM subscriptions WHERE UPPER(status) = 'ACTIVE'",
    []
  );

  const revenueToday = await safeScalarNumber(
    "SELECT COALESCE(SUM(amount)/100, 0)::float as value FROM payments WHERE created_at >= $1 AND created_at < ($1::timestamptz + interval '1 day') AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID')",
    [startOfTodayUtc().toISOString()],
    0
  );

  const draftCount = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM content_items WHERE UPPER(lifecycle_state) = 'DRAFT'",
    []
  );

  const failedPaymentsCount = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM payments WHERE UPPER(status) = 'FAILED'",
    []
  );

  return res.json({
    success: true,
    totalArtists,
    totalActiveSubscriptions,
    revenueToday,
    activeReports,
    alerts: {
      draftCount,
      failedPaymentsCount
    }
  });
});

router.get("/global-summary", requireAuth, requireAdmin, async (req, res) => {
  // Parse date range parameters (optional)
  const startDateStr = String(req.query.startDate || '');
  const endDateStr = String(req.query.endDate || '');
  const startDate = startDateStr && startDateStr !== 'undefined' && !isNaN(Date.parse(startDateStr)) ? new Date(startDateStr) : null;
  const endDate = endDateStr && endDateStr !== 'undefined' && !isNaN(Date.parse(endDateStr)) ? new Date(endDateStr) : null;
  
  // Build date filter conditions
  const paymentsDateFilter = startDate && endDate 
    ? "created_at >= $1 AND created_at <= $2 AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID')"
    : "(UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID')";
  
  const transactionsDateFilter = startDate && endDate
    ? "date >= $1 AND date <= $2 AND (UPPER(status) = 'CAPTURED' OR UPPER(status) = 'SUCCESS')"
    : "(UPPER(status) = 'CAPTURED' OR UPPER(status) = 'SUCCESS')";
  
  const dateParams = startDate && endDate ? [startDate.toISOString(), endDate.toISOString()] : [];

  // Total Revenue from payments table (convert paise -> INR)
  const paymentsRevenueQuery = startDate && endDate
    ? `SELECT COALESCE(SUM(amount)/100, 0)::float as value FROM payments WHERE ${paymentsDateFilter}`
    : `SELECT COALESCE(SUM(amount)/100, 0)::float as value FROM payments WHERE ${paymentsDateFilter}`;
    
  const paymentsRevenue = await safeScalarNumber(paymentsRevenueQuery, dateParams, 0);
  
  // Also get revenue from transactions table as backup (for records that might not be in payments)
  const transactionsRevenueQuery = startDate && endDate
    ? `SELECT COALESCE(SUM(amount)/100, 0)::float as value FROM transactions WHERE ${transactionsDateFilter}`
    : `SELECT COALESCE(SUM(amount)/100, 0)::float as value FROM transactions WHERE ${transactionsDateFilter}`;
  
  const transactionsRevenue = await safeScalarNumber(transactionsRevenueQuery, dateParams, 0);
  
  // Use the higher of the two values (in case one table has more complete data)
  const totalRevenue = Math.max(paymentsRevenue, transactionsRevenue);

  const totalArtists = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM users WHERE UPPER(role) = 'ARTIST'",
    []
  );

  const totalFans = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM users WHERE UPPER(role) = 'FAN'",
    []
  );

  const totalActiveUsers = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM users WHERE UPPER(role) IN ('FAN', 'ARTIST')",
    []
  );

  const last30Start = new Date();
  last30Start.setUTCDate(last30Start.getUTCDate() - 30);

  const prev30Start = new Date(last30Start);
  prev30Start.setUTCDate(prev30Start.getUTCDate() - 30);

  const usersLast30Days = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM users WHERE created_at >= $1 AND UPPER(role) IN ('FAN', 'ARTIST')",
    [last30Start.toISOString()],
    0
  );

  const usersPrev30Days = await safeScalarNumber(
    "SELECT COUNT(*)::int as value FROM users WHERE created_at >= $1 AND created_at < $2 AND UPPER(role) IN ('FAN', 'ARTIST')",
    [prev30Start.toISOString(), last30Start.toISOString()],
    0
  );

  const growthRatePct =
    usersPrev30Days > 0
      ? ((usersLast30Days - usersPrev30Days) / usersPrev30Days) * 100
      : usersLast30Days > 0
        ? 100
        : 0;

  const platformFee = totalRevenue * 0.1;
  const artistPayouts = totalRevenue * 0.9;

  return res.json({
    success: true,
    totalRevenue,
    platformFee,
    artistPayouts,
    totalArtists,
    totalFans,
    totalActiveUsers,
    userGrowthRatePct: Number(growthRatePct.toFixed(2)),
    currency: "INR",
    // Debug info to help verify data sources
    _debug: {
      paymentsRevenue,
      transactionsRevenue,
      dateRange: startDate && endDate ? { startDate, endDate } : null
    }
  });
});

router.get("/growth", requireAuth, requireAdmin, async (req, res) => {
  const end = new Date();
  const days: { date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    days.push({ date: toIsoDate(d) });
  }

  const startIso = days[0].date + "T00:00:00.000Z";
  const rows = await safeRows<{ date: string; value: number }>(
    "SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, COUNT(*)::int as value FROM subscriptions WHERE created_at >= $1 GROUP BY 1 ORDER BY 1 ASC",
    [startIso],
    []
  );

  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, Number(r.value) || 0);

  const data = days.map((d) => ({
    date: d.date,
    value: map.get(d.date) ?? 0
  }));

  return res.json({ success: true, data });
});

router.get("/revenue-trends", requireAuth, requireAdmin, async (req, res) => {
  // Parse optional date range parameters
  const startDateStr = String(req.query.startDate || '');
  const endDateStr = String(req.query.endDate || '');
  const startDate = startDateStr && startDateStr !== 'undefined' && !isNaN(Date.parse(startDateStr)) ? new Date(startDateStr) : null;
  const endDate = endDateStr && endDateStr !== 'undefined' && !isNaN(Date.parse(endDateStr)) ? new Date(endDateStr) : null;
  
  let days: { date: string }[];
  let startIso: string;
  
  if (startDate && endDate) {
    // Use provided date range
    const dayCount = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const safeDayCount = Math.min(Math.max(dayCount, 1), 90); // Limit to 90 days max
    days = [];
    for (let i = safeDayCount - 1; i >= 0; i--) {
      const d = new Date(endDate);
      d.setUTCDate(d.getUTCDate() - i);
      days.push({ date: toIsoDate(d) });
    }
    startIso = toIsoDate(startDate) + "T00:00:00.000Z";
  } else {
    // Default to last 30 days
    days = buildLastNDaysUtc(30);
    startIso = days[0].date + "T00:00:00.000Z";
  }

  // Get revenue from payments table (convert paise to INR)
  const paymentRows = await safeRows<{ date: string; value: number }>(
    "SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, COALESCE(SUM(amount)/100, 0)::float as value FROM payments WHERE created_at >= $1 AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID') GROUP BY 1 ORDER BY 1 ASC",
    [startIso],
    []
  );
  
  // Get revenue from transactions table (as backup for missing payments)
  const transactionRows = await safeRows<{ date: string; value: number }>(
    "SELECT to_char(date_trunc('day', date), 'YYYY-MM-DD') as date, COALESCE(SUM(amount)/100, 0)::float as value FROM transactions WHERE date >= $1 AND (UPPER(status) = 'CAPTURED' OR UPPER(status) = 'SUCCESS') GROUP BY 1 ORDER BY 1 ASC",
    [startIso],
    []
  );

  // Merge data from both sources (use max value if both have data for same date)
  const map = new Map<string, number>();
  
  // Add payments data
  for (const r of paymentRows) {
    map.set(r.date, Number(r.value) || 0);
  }
  
  // Add transactions data (use higher value if date exists in both)
  for (const r of transactionRows) {
    const existingValue = map.get(r.date) || 0;
    const transactionValue = Number(r.value) || 0;
    map.set(r.date, Math.max(existingValue, transactionValue));
  }

  const data = days.map((d) => ({
    date: d.date,
    value: map.get(d.date) ?? 0
  }));

  return res.json({ success: true, data, currency: "INR" });
});

router.get("/top-artists", requireAuth, requireAdmin, async (req, res) => {
  const rows = await safeRows<{
    artist_id: number;
    artist_name: string | null;
    profile_image_url: string | null;
    total_subscribers: number;
    total_plays: number;
  }>(
    `SELECT
        u.id as artist_id,
        COALESCE(u.name, u.email) as artist_name,
        u.profile_image_url,
        COALESCE(subs.total_subscribers, 0)::int as total_subscribers,
        COALESCE(plays.total_plays, 0)::int as total_plays
      FROM users u
      LEFT JOIN (
        SELECT artist_id, COUNT(*)::int as total_subscribers
        FROM subscriptions
        WHERE UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'
        GROUP BY artist_id
      ) subs ON subs.artist_id = u.id
      LEFT JOIN (
        SELECT c.artist_id, COUNT(p.id)::int as total_plays
        FROM content_items c
        LEFT JOIN content_plays p ON p.content_id = c.id
        GROUP BY c.artist_id
      ) plays ON plays.artist_id = u.id
      WHERE UPPER(u.role) = 'ARTIST'
      ORDER BY total_subscribers DESC, total_plays DESC, u.id ASC
      LIMIT 5`,
    [],
    []
  );

  const items = rows.map((r) => ({
    artistId: Number(r.artist_id),
    name: r.artist_name,
    profileImageUrl: r.profile_image_url,
    subscribers: Number(r.total_subscribers ?? 0),
    plays: Number(r.total_plays ?? 0)
  }));

  return res.json({ success: true, items });
});

router.get("/top-categories", requireAuth, requireAdmin, async (req, res) => {
  const rows = await safeRows<{ category: string; value: number }>(
    "SELECT COALESCE(NULLIF(TRIM(type), ''), 'UNKNOWN') as category, COUNT(*)::int as value FROM content_items WHERE COALESCE(is_approved, false) = true GROUP BY 1 ORDER BY value DESC, category ASC LIMIT 8",
    [],
    []
  );

  const items = rows.map((r) => ({
    category: r.category,
    value: Number(r.value ?? 0)
  }));

  return res.json({ success: true, items });
});

router.get("/revenue", requireAuth, requireAdmin, async (req, res) => {
  const end = new Date();
  const days: { date: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    days.push({ date: toIsoDate(d) });
  }

  const startIso = days[0].date + "T00:00:00.000Z";
  const rows = await safeRows<{ date: string; value: number }>(
    "SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, COALESCE(SUM(amount)/100, 0)::float as value FROM payments WHERE created_at >= $1 AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID') GROUP BY 1 ORDER BY 1 ASC",
    [startIso],
    []
  );

  const map = new Map<string, number>();
  for (const r of rows) map.set(r.date, Number(r.value) || 0);

  const data = days.map((d) => ({
    date: d.date,
    value: map.get(d.date) ?? 0
  }));

  return res.json({
    success: true,
    data
  });
});

router.get("/alerts", requireAuth, requireAdmin, async (req, res) => {
  const drafts = await safeRows<{
    id: any;
    title: string | null;
    created_at: string;
  }>(
    "SELECT id, title, created_at FROM content_items WHERE UPPER(lifecycle_state) = 'DRAFT' ORDER BY created_at DESC LIMIT 5",
    [],
    []
  );

  const failedPayments = await safeRows<{
    id: any;
    amount: number;
    created_at: string;
    status: string;
  }>(
    "SELECT id, amount, created_at, status FROM payments WHERE UPPER(status) = 'FAILED' ORDER BY created_at DESC LIMIT 5",
    [],
    []
  );

  return res.json({
    success: true,
    drafts,
    failedPayments
  });
});

export default router;
