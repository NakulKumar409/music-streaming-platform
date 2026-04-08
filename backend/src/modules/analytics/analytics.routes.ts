import { Router } from "express";
import { getAdminDashboardMetrics } from "../../controllers/adminAnalyticsController";
import { requireAuth } from "../../common/auth/requireAuth";

const router = Router();

router.post("/event", (req, res) => {
  console.log("Analytics Event:", req.body);

  res.json({
    success: true
  });
});

router.get("/metrics", requireAuth, getAdminDashboardMetrics);

export default router;
