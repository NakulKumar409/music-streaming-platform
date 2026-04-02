import { Router } from "express";
import { v2 as cloudinary } from 'cloudinary';
import multer from "multer";
import { pool } from "../../common/db";
import { requireAuth } from "../../common/auth/requireAuth";

const router = Router();

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper to require admin role
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

// Middleware: ensure admin only
router.use(requireAuth, requireAdmin);

/**
 * POST /api/v1/admin/upload-image
 * Upload an image to Cloudinary
 */
router.post("/", upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    // Convert buffer to base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Image, {
      folder: 'featured-artists',
      resource_type: 'image',
      type: 'upload',
      use_filename: true,
      unique_filename: true,
      transformation: [
        { width: 400, height: 400, crop: 'fill', gravity: 'auto' }
      ]
    });

    return res.json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err: any) {
    console.error("[Image Upload Error]", err.message);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to upload image" 
    });
  }
});

export default router;
