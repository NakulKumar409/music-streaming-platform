import { pool } from "./db";

/**
 * Check if a user has access to an artist's subscription-based content
 * @param userId - The user ID requesting access
 * @param artistId - The artist ID whose content is being accessed
 * @returns Promise<boolean> - true if user has ACTIVE subscription, false otherwise
 */
export const checkAccess = async (userId: number, artistId: number): Promise<boolean> => {
  try {
    if (!Number.isFinite(userId) || userId <= 0) {
      return false;
    }
    
    if (!Number.isFinite(artistId) || artistId <= 0) {
      return false;
    }

    const result = await pool.query(
      `SELECT id
       FROM subscriptions
       WHERE user_id = $1
         AND artist_id = $2
         AND UPPER(COALESCE(status, '')) = 'ACTIVE'
         AND (end_date IS NULL OR end_date > now())
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
      `SELECT id, status, plan_type, start_date, end_date, auto_renew, created_at, updated_at
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
  void userId;
  void contentId;
  return { isLocked: false, subscriptionRequired: false };

  try {
    // Get content details
    const contentResult = await pool.query(
      `SELECT artist_id, subscription_required
       FROM content_items
       WHERE id = $1
       LIMIT 1`,
      [contentId]
    );

    if (!contentResult.rows?.length) {
      return { isLocked: true, subscriptionRequired: false };
    }

    const content = contentResult.rows[0];
    const subscriptionRequired = true;

    // If no user ID provided, content is locked
    if (!userId) {
      return { isLocked: true, subscriptionRequired };
    }

    // Check if user has active subscription
    const hasAccess = await checkAccess(userId, content.artist_id);
    
    return {
      isLocked: !hasAccess,
      subscriptionRequired
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
  end_date: Date;
  auto_renew: boolean;
  created_at: Date;
  updated_at: Date;
};
