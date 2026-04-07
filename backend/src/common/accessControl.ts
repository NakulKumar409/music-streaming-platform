import { pool } from "./db";
import { validateEnv } from "../config/env.validation";

/**
 * Check if a user has access to an artist's subscription-based content
 * @param userId - The user ID requesting access
 * @param artistId - The artist ID whose content is being accessed
 * @returns Promise<boolean> - true if user has ACTIVE subscription, false otherwise
 */
export const checkAccess = async (userId: number, artistId: number): Promise<boolean> => {
  try {
    // Global killswitch
    const config = validateEnv();
    if (!config.subscriptionEnabled) {
      return true;
    }

    if (!Number.isFinite(userId) || userId <= 0) {
      return false;
    }

    // Admin bypass
    const userRoleResult = await pool.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    const role = (userRoleResult.rows[0]?.role || "").toUpperCase();
    if (role === "ADMIN") {
      return true;
    }
    
    if (!Number.isFinite(artistId) || artistId <= 0) {
      return false;
    }

    // A user has access if:
    // 1. They have an ACTIVE or GRACE_PERIOD subscription for this specific artist
    // 2. OR they have an ACTIVE or GRACE_PERIOD subscription for the entire PLATFORM
    const result = await pool.query(
      `SELECT id, type, status, grace_ends_at, next_billing_date
       FROM subscriptions
       WHERE user_id = $1
         AND (
           (type = 'ARTIST' AND artist_id = $2)
           OR (type = 'PLATFORM')
         )
         AND UPPER(COALESCE(status, '')) IN ('ACTIVE', 'GRACE_PERIOD', 'PAST_DUE', 'GRACE')
         AND (
           COALESCE(grace_ends_at, next_billing_date) IS NULL 
           OR COALESCE(grace_ends_at, next_billing_date) > now()
         )
       LIMIT 1`,
      [userId, artistId]
    );

    return Boolean(result.rows?.length);
  } catch (error) {
    console.error('[Access Control] Error checking access:', error);
    return false;
  }
};

/**
 * Get subscription details for a user-artist pair
 * @param userId - The user ID
 * @param artistId - The artist ID
 * @returns Promise<SubscriptionDetails | null>
 */
export const getSubscriptionDetails = async (userId: number, artistId: number) => {
  try {
    const result = await pool.query(
      `SELECT id, status, plan_type, start_date, next_billing_date, auto_renew, created_at, updated_at
       FROM subscriptions
       WHERE user_id = $1 AND artist_id = $2
       LIMIT 1`,
      [userId, artistId]
    );
    

    return result.rows?.[0] || null;
  } catch (error) {
    console.error('[Access Control] Error getting subscription details:', error);
    return null;
  }
};

/**
 * Check if content requires subscription and if user has access
 * @param userId - The user ID (optional, for anonymous access)
 * @param contentId - The content ID to check
 * @returns Promise<{isLocked: boolean, subscriptionRequired: boolean}>
 */
export const checkContentAccess = async (userId: number | null, contentId: number) => {
  try {
    // Get content details
    let contentResult: any;
    try {
      contentResult = await pool.query(
        `SELECT artist_id, subscription_required
         FROM content_items
         WHERE id = $1
         LIMIT 1`,
        [contentId]
      );
    } catch (err: any) {
      if (err?.code === '42703') {
        contentResult = await pool.query(
          `SELECT artist_id
           FROM content_items
           WHERE id = $1
           LIMIT 1`,
          [contentId]
        );
      } else {
        throw err;
      }
    }

    if (!contentResult.rows?.length) {
      return { isLocked: true, subscriptionRequired: false };
    }

    const content = contentResult.rows[0];
    const subscriptionRequired = content.hasOwnProperty('subscription_required')
      ? Boolean(content.subscription_required)
      : true;

    // If subscription is not required, it's never locked
    if (!subscriptionRequired) {
      return { isLocked: false, subscriptionRequired: false };
    }

    // If no user ID provided but subscription IS required, content is locked
    if (!userId) {
      return { isLocked: true, subscriptionRequired: true };
    }

    // Check if user has active subscription
    const hasAccess = await checkAccess(userId, content.artist_id);
    
    return {
      isLocked: !hasAccess,
      subscriptionRequired: true
    };
  } catch (error) {
    console.error('[Access Control] Error checking content access:', error);
    return { isLocked: true, subscriptionRequired: false };
  }
};

export type SubscriptionDetails = {
  id: number;
  status: string;
  plan_type: string;
  start_date: Date;
  next_billing_date: Date;
  auto_renew: boolean;
  created_at: Date;
  updated_at: Date;
};
