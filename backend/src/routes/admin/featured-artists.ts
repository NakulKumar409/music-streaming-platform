import { Router } from "express";
import { pool } from "../../common/db";
import { requireAuth } from "../../common/auth/requireAuth";
import { invalidateCache } from "../../common/cache";

const router = Router();

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

const toAbsoluteUrl = (req: any, value: any) => {
  const raw = (value ?? "").toString().trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  if (raw.startsWith("/")) return `${baseUrl}${raw}`;
  return `${baseUrl}/${raw}`;
};

/**
 * GET /api/v1/admin/featured-artists
 * Get all featured artists (admin view)
 */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fa.id, fa.artist_id, fa.name as manual_name, fa.avatar as manual_avatar, 
        fa.is_active, fa.created_at, fa.updated_at,
        u.name as artist_name,
        u.profile_image_url
       FROM featured_artists fa
       LEFT JOIN users u ON u.id = fa.artist_id
       ORDER BY fa.created_at DESC`
    );

    const featured = (result.rows || []).map((row: any) => ({
      id: row.id,
      artistId: row.artist_id,
      name: row.artist_name || row.manual_name || "Unknown Artist",
      avatar: toAbsoluteUrl(req, row.profile_image_url || row.manual_avatar),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({ success: true, featured });
  } catch (err: any) {
    console.error("[Admin Featured Artists Error]", err.message);
    return res.status(500).json({ success: false, message: "Failed to fetch featured artists" });
  }
});

/**
 * POST /api/v1/admin/featured-artists
 * Add a new featured artist
 * 
 * Case 1: Existing artist - { artistId: number }
 * Case 2: Manual artist - { name: string, avatar: string }
 */
router.post("/", async (req, res) => {
  try {
    const { artistId, name, avatar } = req.body;

    // Case 1: Existing artist
    if (artistId) {
      if (typeof artistId !== "number") {
        return res.status(400).json({ success: false, message: "artistId must be a number" });
      }

      // Verify artist exists and is active
      const artistCheck = await pool.query(
        `SELECT id, name, UPPER(role) as role, COALESCE(is_deleted, false) as is_deleted, COALESCE(status, 'ACTIVE') as status,
          profile_image_url
         FROM users WHERE id = $1`,
        [artistId]
      );

      if (!artistCheck.rows?.length) {
        return res.status(404).json({ success: false, message: "Artist not found" });
      }

      const artist = artistCheck.rows[0];

      if (artist.is_deleted) {
        return res.status(400).json({ success: false, message: "Cannot feature a deleted artist" });
      }

      if (artist.role !== "ARTIST") {
        return res.status(400).json({ success: false, message: "Selected user is not an artist" });
      }

      if (artist.status !== "ACTIVE") {
        return res.status(400).json({ success: false, message: "Artist account is not active" });
      }

      // Check if already featured
      const existingCheck = await pool.query(
        `SELECT id FROM featured_artists WHERE artist_id = $1`,
        [artistId]
      );

      if (existingCheck.rows?.length) {
        // Update to active if already exists
        const result = await pool.query(
          `UPDATE featured_artists 
           SET is_active = true, updated_at = NOW()
           WHERE artist_id = $1
           RETURNING id, artist_id, is_active, created_at`,
          [artistId]
        );
        
        const featured = result.rows[0];

        await invalidateCache("featured_artists");

        return res.json({
          success: true,
          message: "Artist is already featured - activated",
          featured: {
            id: featured.id,
            artistId: featured.artist_id,
            name: artist.name,
            avatar: toAbsoluteUrl(req, artist.profile_image_url),
            isActive: featured.is_active,
            createdAt: featured.created_at,
          },
        });
      }

      // Insert featured artist
      const result = await pool.query(
        `INSERT INTO featured_artists (artist_id, name, avatar, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, true, NOW(), NOW())
         RETURNING id, artist_id, is_active, created_at`,
        [artistId, artist.name, artist.profile_image_url]
      );

      const featured = result.rows[0];

      await invalidateCache("featured_artists");

      return res.json({
        success: true,
        message: "Artist added to featured",
        featured: {
          id: featured.id,
          artistId: featured.artist_id,
          name: artist.name,
          avatar: toAbsoluteUrl(req, artist.profile_image_url),
          isActive: featured.is_active,
          createdAt: featured.created_at,
        },
      });
    }

    // Case 2: Manual artist creation
    if (name && avatar) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ success: false, message: "Name is required for manual featured artist" });
      }

      if (typeof avatar !== "string" || avatar.trim().length === 0) {
        return res.status(400).json({ success: false, message: "Avatar URL is required for manual featured artist" });
      }

      const trimmedName = name.trim();
      const trimmedAvatar = avatar.trim();

      // Insert manual featured artist
      const result = await pool.query(
        `INSERT INTO featured_artists (artist_id, name, avatar, is_active, created_at, updated_at)
         VALUES (NULL, $1, $2, true, NOW(), NOW())
         RETURNING id, name, avatar, is_active, created_at`,
        [trimmedName, trimmedAvatar]
      );

      const featured = result.rows[0];

      await invalidateCache("featured_artists");

      return res.json({
        success: true,
        message: "Featured artist created",
        featured: {
          id: featured.id,
          artistId: null,
          name: featured.name,
          avatar: toAbsoluteUrl(req, featured.avatar),
          isActive: featured.is_active,
          createdAt: featured.created_at,
        },
      });
    }

    // Neither case matched
    return res.status(400).json({
      success: false,
      message: "Provide either artistId (for existing artist) OR name + avatar (for manual creation)"
    });

  } catch (err: any) {
    console.error("[Admin Add Featured Artist Error]", err.message);
    return res.status(500).json({ success: false, message: "Failed to add featured artist" });
  }
});

/**
 * DELETE /api/v1/admin/featured-artists/:id
 * Remove a featured artist
 */
router.delete("/:id", async (req, res) => {
  try {
    const featuredId = Number(req.params.id);

    if (!Number.isFinite(featuredId) || featuredId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid featured artist ID" });
    }

    // Delete featured artist record
    const result = await pool.query(
      `DELETE FROM featured_artists WHERE id = $1 RETURNING id`,
      [featuredId]
    );

    if (!result.rows?.length) {
      return res.status(404).json({ success: false, message: "Featured artist not found" });
    }

    await invalidateCache("featured_artists");

    return res.json({ success: true, message: "Artist removed from featured" });
  } catch (err: any) {
    console.error("[Admin Remove Featured Artist Error]", err.message);
    return res.status(500).json({ success: false, message: "Failed to remove featured artist" });
  }
});

/**
 * PATCH /api/v1/admin/featured-artists/:id
 * Toggle featured artist active status
 */
router.patch("/:id", async (req, res) => {
  try {
    const featuredId = Number(req.params.id);
    const { isActive } = req.body;

    if (!Number.isFinite(featuredId) || featuredId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid featured artist ID" });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ success: false, message: "isActive must be a boolean" });
    }

    const result = await pool.query(
      `UPDATE featured_artists 
       SET is_active = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, artist_id, is_active, updated_at`,
      [isActive, featuredId]
    );

    if (!result.rows?.length) {
      return res.status(404).json({ success: false, message: "Featured artist not found" });
    }

    const featured = result.rows[0];

    await invalidateCache("featured_artists");

    return res.json({
      success: true,
      message: `Featured artist ${isActive ? "activated" : "deactivated"}`,
      featured: {
        id: featured.id,
        artistId: featured.artist_id,
        isActive: featured.is_active,
        updatedAt: featured.updated_at,
      },
    });
  } catch (err: any) {
    console.error("[Admin Update Featured Artist Error]", err.message);
    return res.status(500).json({ success: false, message: "Failed to update featured artist" });
  }
});

export default router;
