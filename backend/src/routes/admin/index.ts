import { Router } from "express";
import adminAuthRoutes from "./auth";
import adminAnalyticsRoutes from "./analytics";
import adminArtistApprovalsRoutes from "./artist-approvals";
import adminArtistsRoutes from "./artists";
import adminContentRoutes from "./content";
import adminFeaturedArtistsRoutes from "./featured-artists";
import adminImageUploadRoutes from "./image-upload";
import adminSubscriptionRoutes from "./subscriptions";
import adminAuditRoutes from "./audit";
import { poolRead } from "../../common/db";
import { AuditService } from "../../shared/audit/audit.service";

const router = Router();

router.get("/debug-audit-trigger", async (req, res) => {
  AuditService.log({
    action: "test.event",
    entity: "system",
    entityId: "123",
    status: "success",
    role: "system",
    metadata: { test: true }
  });
  res.json({ success: true, message: "Triggered audit log" });
});

router.get("/debug-audit", async (req, res) => {
  try {
    const r = await poolRead.query("SELECT COUNT(*) FROM audit_logs");
    const r2 = await poolRead.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 2");
    res.json({ count: r.rows[0].count, latest: r2.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/debug-subscriptions/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const subs = await poolRead.query(
      `SELECT id, type, status, plan_type, artist_id, start_date, end_date, next_billing_date
       FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [userId]
    );
    const listenStats = await poolRead.query(
      `SELECT year, month, total_seconds FROM user_listening_stats WHERE user_id = $1 ORDER BY year DESC, month DESC LIMIT 6`,
      [userId]
    );
    res.json({ subscriptions: subs.rows, listenStats: listenStats.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.use("/", adminAuthRoutes);
router.use("/", adminArtistApprovalsRoutes);
router.use("/analytics", adminAnalyticsRoutes);
router.use("/artists", adminArtistsRoutes);
router.use("/content", adminContentRoutes);
router.use("/featured-artists", adminFeaturedArtistsRoutes);
router.use("/upload-image", adminImageUploadRoutes);
router.use("/subscriptions", adminSubscriptionRoutes);
router.use("/audit", adminAuditRoutes);

export default router;
