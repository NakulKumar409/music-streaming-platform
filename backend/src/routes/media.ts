import { Router } from 'express';
import { requireAuth } from '../common/auth/requireAuth';
import { uploadLimiter } from '../common/security/rateLimit';
import multer from 'multer';
import { handleMediaUpload } from '../controllers/media/MediaUploadController';
import { handleMediaWebhook } from '../controllers/media/WebhookController';
import { generatePlaybackUrl } from '../controllers/media/PlaybackController';

const router = Router();

// Memory limits for upload middleware, the Upload Controller writes to Temp Disk 
// To simplify Cloudinary requirements and prevent disk pollution in node cluster
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 500 // 500MB general limit, controller validates it
  }
});

// Require Artist Role Middleware (Isolated)
const requireArtist = (req: any, res: any, next: any) => {
  const role = (req.user?.role || "").toUpperCase();
  if (role !== "ARTIST") {
    return res.status(403).json({ success: false, message: "Forbidden: Artists only" });
  }
  return next();
};

// 1. Authenticated File Upload Flow
router.post(
  '/upload',
  uploadLimiter,
  requireAuth,
  requireArtist,
  upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'media', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
    { name: 'video', maxCount: 1 }
  ]),
  handleMediaUpload
);

// 2. Playback Generation (Backend Control & Signed URLs)
router.get(
  '/:id/playback',
  requireAuth,
  generatePlaybackUrl
);

// 3. Provider Webhook for Async Processing (Public facing, provider specific signature/logic handled internally if needed)
router.post('/webhook', handleMediaWebhook);

export default router;
