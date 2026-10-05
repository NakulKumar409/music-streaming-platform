import { Router } from "express";

const router = Router();

/**
 * Content ownership belongs to approved artists. The legacy admin upload
 * endpoint is intentionally retired so old clients cannot bypass that rule.
 */
router.post("/upload", (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  return res.status(410).json({
    success: false,
    code: "ADMIN_CONTENT_UPLOAD_RETIRED",
    message: "Artists upload their own content from Artist Studio",
    correlationId,
  });
});

export default router;
