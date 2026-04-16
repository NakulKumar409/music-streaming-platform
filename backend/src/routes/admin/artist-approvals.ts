import { Router } from "express";
import { requireAuth } from "../../common/auth/requireAuth";
import { pool } from "../../common/db";
import { invalidateArtistCache } from "../../common/cache";
import { logger } from "../../common/logger";
import { AuditService } from "../../shared/audit/audit.service";

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
const safeQuery = async <T = any>(query: string, params: any[]): Promise<T[]> => {
  try {
    const r = await pool.query(query, params);
    return (r.rows as T[]) ?? [];
  } catch {
    return [];
  }
};

router.get("/pending-artists", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    // Debug: First check all ARTIST users and their status
    // Note: artist_status is ENUM type, don't use UPPER() on it
    const allArtists = await safeQuery<any>(
      `SELECT id, email, name, role, artist_status::text as artist_status, created_at, onboarded_at
       FROM users
       WHERE role = 'ARTIST'`,
      []
    );
    logger.info({ 
      correlationId, 
      totalArtistCount: allArtists.length,
      artists: allArtists.map(a => ({ id: a.id, email: a.email, status: a.artist_status, role: a.role }))
    }, "[ADMIN] All artists in system");

    // Note: artist_status is ENUM type, cast to text for comparison
    const rows = await safeQuery<any>(
      `SELECT
         id,
         COALESCE(NULLIF(name, ''), NULLIF(split_part(email, '@', 1), ''), email) as name,
         email,
         created_at,
         onboarded_at,
         COALESCE(artist_status::text, 'PENDING') as artist_status,
         COALESCE(artist_bio, bio, '') as artist_bio,
         portfolio_links,
         artist_appeal_message,
         admin_remarks
       FROM users
       WHERE role = 'ARTIST'
         AND (
           COALESCE(artist_status::text, 'PENDING') = 'PENDING'
           OR (
             artist_status::text = 'REJECTED'
             AND NULLIF(TRIM(COALESCE(artist_appeal_message, '')), '') IS NOT NULL
           )
         )
       ORDER BY COALESCE(onboarded_at, created_at) DESC
       LIMIT 300`,
      []
    );

    logger.info({ 
      correlationId, 
      pendingCount: rows.length,
      pendingIds: rows.map(r => r.id)
    }, "[ADMIN] Pending artists query result");

    const items = rows.map((u) => {
      const status = (u.artist_status ?? "PENDING").toString().toUpperCase();
      const appeal = (u.artist_appeal_message ?? "").toString().trim();
      return {
        id: Number(u.id),
        name: u.name ?? null,
        email: u.email,
        submittedAt: u.onboarded_at ?? u.created_at ?? null,
        artistStatus: status,
        artistBio: u.artist_bio ?? "",
        portfolioLinks: Array.isArray(u.portfolio_links) ? u.portfolio_links : [],
        appealMessage: u.artist_appeal_message ?? null,
        appealed: status === "REJECTED" && Boolean(appeal),
        adminNote: u.admin_remarks ?? null
      };
    });

    return res.json({ success: true, items, correlationId });
  } catch (err: any) {
    logger.error({ correlationId, error: err?.message }, "[ADMIN] pending-artists error");
    return res.status(500).json({
      success: false,
      message: "Failed to fetch pending artists",
      correlationId
    });
  }
});

router.patch("/resolve-artist/:id", requireAuth, requireAdmin, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid id", correlationId });
  }

  const { action, reason } = req.body as { action?: string; reason?: string };
  const act = (action ?? "").toString().trim().toUpperCase();
  const note = (reason ?? "").toString().trim();

  if (act !== "APPROVE" && act !== "REJECT") {
    return res.status(400).json({
      success: false,
      message: "action must be APPROVE or REJECT",
      correlationId
    });
  }
  if (act === "REJECT" && !note) {
    return res.status(400).json({
      success: false,
      message: "reason is required for rejection",
      correlationId
    });
  }

  try {

    if (act === "APPROVE") {
      const r = await pool.query(
        `UPDATE users
         SET artist_status = 'APPROVED'::"ArtistStatus",
             is_verified = true,
             verified = true,
             admin_remarks = NULL,
             updated_at = now()
         WHERE id = $1 AND role = 'ARTIST'
         RETURNING id`,
        [id]
      );

      if (!r.rows?.length) {
        return res.status(404).json({ success: false, message: "Artist not found", correlationId });
      }

      await invalidateArtistCache();

      await pool
        .query(
          "INSERT INTO artist_stats (artist_id, total_plays, total_subscribers, total_earnings, created_at, updated_at) VALUES ($1, 0, 0, 0, now(), now()) ON CONFLICT (artist_id) DO NOTHING",
          [id]
        )
        .catch(() => undefined);

      AuditService.log({
        action: 'admin.artist_approved',
        entity: 'user',
        entityId: String(id),
        performedBy: req.user?.id,
        role: 'admin',
        status: 'success',
        correlationId,
        metadata: { action: 'approve' }
      });

      return res.json({ success: true, status: "APPROVED", correlationId });
    }

    const r = await pool.query(
      `UPDATE users
       SET artist_status = 'REJECTED'::"ArtistStatus",
           is_verified = false,
           verified = false,
           admin_remarks = $2,
           updated_at = now()
       WHERE id = $1 AND role = 'ARTIST'
       RETURNING id`,
      [id, note]
    );

    if (!r.rows?.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    AuditService.log({
      action: 'admin.artist_rejected',
      entity: 'user',
      entityId: String(id),
      performedBy: req.user?.id,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: { reason: note }
    });

    return res.json({ success: true, status: "REJECTED", correlationId });
  } catch (err: any) {
    console.error("[admin] resolve-artist error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to resolve artist", correlationId });
  }
});

export default router;
