import { Router } from "express";
import { requireAuth } from "../../common/auth/requireAuth";
import { revokeSubscription, adjustSubscription } from "../../controllers/admin/adminSubscriptionController";

const router = Router();

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

// Revoke a subscription (Immediate cancellation)
router.post("/:id/revoke", requireAuth, requireAdmin, revokeSubscription);

// Adjust any part of the subscription record
router.patch("/:id", requireAuth, requireAdmin, adjustSubscription);

export default router;
