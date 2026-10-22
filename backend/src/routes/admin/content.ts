import { Router } from "express";
import { invalidateContentCache } from "../../common/cache";
import {
  ContentGovernanceError,
  takedownContent,
  type GovernanceRole,
} from "../../modules/content/content-governance.service";
import { listReportedLiveContent } from "../../modules/content/content-moderation-query.service";

const router = Router();

function actor(req: any) {
  return {
    userId: Number(req.user?.id),
    role: String(req.user?.role || "").toUpperCase() as GovernanceRole,
    correlationId: req?.correlationId || undefined,
  };
}

function sendError(res: any, error: unknown, correlationId: string) {
  if (error instanceof ContentGovernanceError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      correlationId,
    });
  }
  return res.status(500).json({
    success: false,
    code: "CONTENT_GOVERNANCE_FAILED",
    message: "Content governance operation failed",
    correlationId,
  });
}

router.get("/pending", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  return res.status(410).json({
    success: false,
    code: "CONTENT_APPROVAL_RETIRED",
    message: "Artist uploads publish automatically when media processing is ready",
    correlationId,
  });
});

router.get("/reported", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  try {
    const items = await listReportedLiveContent(req.query?.limit, req.query?.offset);
    return res.json({ success: true, items, correlationId });
  } catch (error) {
    return sendError(res, error, correlationId);
  }
});

const retiredApprovalAction = (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  return res.status(410).json({
    success: false,
    code: "CONTENT_APPROVAL_RETIRED",
    message: "Per-content approval is no longer part of the publishing workflow",
    correlationId,
  });
};

router.patch("/:id/approve", retiredApprovalAction);
router.post("/:id/approve", retiredApprovalAction);
router.patch("/:id/reject", retiredApprovalAction);
router.post("/:id/reject", retiredApprovalAction);

router.post("/:id/takedown", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  try {
    const result = await takedownContent(req.params.id, req.body?.reason, actor(req));
    await invalidateContentCache();
    return res.json({ success: true, content: result, correlationId });
  } catch (error) {
    return sendError(res, error, correlationId);
  }
});

export default router;
