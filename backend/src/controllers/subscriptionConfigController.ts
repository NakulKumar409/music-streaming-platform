import { Request, Response } from "express";
import { pool } from "../common/db";
import { logger } from "../common/logger";

/**
 * GET /api/v1/subscriptions/platform-config
 * Returns the currently active platform subscription configuration.
 */
export const getPlatformConfig = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT price, discount_price, discount_months, currency, duration, features FROM platform_subscription_configs WHERE is_active = true ORDER BY updated_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Platform subscription configuration not found"
      });
    }

    return res.json({
      success: true,
      config: result.rows[0]
    });
  } catch (error) {
    logger.error({ error }, "Error fetching platform subscription config");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PUT /api/v1/admin/subscriptions/platform-config
 * Updates the platform subscription configuration. (Admin only)
 */
export const updatePlatformConfig = async (req: Request, res: Response) => {
  try {
    const { price, discountPrice, discountMonths, currency, duration, features } = req.body;

    if (!price || price <= 0) {
      return res.status(400).json({ success: false, message: "Valid price is required" });
    }

    // Update the config. We keep it simple: one active config.
    // We update the existing one or insert if missing.
    const result = await pool.query(
      `UPDATE platform_subscription_configs 
       SET price = $1, discount_price = $2, discount_months = $3, currency = $4, duration = $5, features = $6, updated_at = now()
       WHERE is_active = true
       RETURNING *`,
      [price, discountPrice || null, discountMonths || 1, currency || 'INR', duration || 'monthly', JSON.stringify(features || [])]
    );

    if (result.rowCount === 0) {
      // If none active, insert new
      await pool.query(
        `INSERT INTO platform_subscription_configs (price, discount_price, discount_months, currency, duration, features, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [price, discountPrice || null, discountMonths || 1, currency || 'INR', duration || 'monthly', JSON.stringify(features || [])]
      );
    }

    return res.json({
      success: true,
      message: "Platform subscription updated successfully"
    });
  } catch (error) {
    logger.error({ error }, "Error updating platform subscription config");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
