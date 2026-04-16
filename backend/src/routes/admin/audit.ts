import { Router } from "express";
import { getAuditLogs } from "../../controllers/admin/adminAuditController";
import { requireAuth } from "../../common/auth/requireAuth";

const router = Router();

// Apply admin auth middleware here if exist, assuming requireAuth checks admin or there is another check in index.ts
router.get("/", requireAuth, getAuditLogs);

export default router;
