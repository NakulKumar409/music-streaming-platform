import { Request, Response } from "express";
import { pool } from "../common/db";
import { logger } from "../common/logger";

export const trackUpsellAttempt = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    // Upsert interaction count
    await pool.query(`
      INSERT INTO upsell_metrics (user_id, interaction_count, last_attempt_at)
      VALUES ($1, 1, now())
      ON CONFLICT (user_id) DO UPDATE SET
        interaction_count = upsell_metrics.interaction_count + 1,
        last_attempt_at = now()
    `, [userId]);

    return res.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Error tracking upsell attempt");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getUpsellStatus = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const result = await pool.query(
      "SELECT interaction_count FROM upsell_metrics WHERE user_id = $1",
      [userId]
    );

    const count = result.rows[0]?.interaction_count || 0;
    const showStrongUpsell = count >= 3;

    return res.json({
      success: true,
      interactionCount: count,
      showStrongUpsell
    });
  } catch (error) {
    logger.error({ error }, "Error fetching upsell status");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
