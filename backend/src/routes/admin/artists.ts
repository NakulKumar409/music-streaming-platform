import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { requireAuth } from "../../common/auth/requireAuth";
import { pool } from "../../common/db";
import { invalidateCachePattern, invalidateArtistCache } from "../../common/cache";
import { AuditService } from "../../shared/audit/audit.service";
import { AgreementPdfService } from "../../services/agreement-pdf.service";

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

const safeScalar = async (query: string, params: any[], fallback = 0): Promise<number> => {
  try {
    const r = await pool.query(query, params);
    const v = r.rows?.[0]?.value;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};

const coercePositiveInt = (v: any, dflt: number) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(1, Math.floor(n));
};

// Signature decryption helpers (must match artist.ts encryption)
const ENCRYPTION_KEY_RAW = process.env.SIGNATURE_ENCRYPTION_KEY || "4a0f8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a";
const ENCRYPTION_KEY = ENCRYPTION_KEY_RAW.length === 64 
  ? Buffer.from(ENCRYPTION_KEY_RAW, 'hex') 
  : Buffer.from(ENCRYPTION_KEY_RAW, 'utf8').slice(0, 32);
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

const decryptSignature = (encryptedSignature: string): string => {
  try {
    const parts = encryptedSignature.split(':');
    if (parts.length !== 2) return encryptedSignature; // Not encrypted, return as-is
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = Buffer.isBuffer(ENCRYPTION_KEY) ? ENCRYPTION_KEY : Buffer.from(ENCRYPTION_KEY as string, 'hex').slice(0, 32);
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error decrypting signature:', error);
    return encryptedSignature; // Return encrypted if decryption fails
  }
};

router.post("/create", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";

  try {
    const { name, email, temporaryPassword } = req.body as {
      name?: string | null;
      email?: string;
      temporaryPassword?: string;
    };

    const {
      phone,
      genre,
      bio,
      socialLinks,
      revenueSharePercentage,
      adminRemarks,
      subscriptionPrice
    } = req.body as {
      phone?: string | null;
      genre?: string | null;
      bio?: string | null;
      socialLinks?: Record<string, any> | null;
      revenueSharePercentage?: number | string | null;
      adminRemarks?: string | null;
      subscriptionPrice?: number | string | null;
    };

    const trimmedEmail = (email || "").trim();

    if (!trimmedEmail || !temporaryPassword) {
      return res.status(400).json({
        success: false,
        message: "Email and temporaryPassword are required",
        correlationId
      });
    }

    const coercedRevenueShare = (() => {
      if (revenueSharePercentage === null || revenueSharePercentage === undefined) return 90;
      const n = Number(revenueSharePercentage);
      if (!Number.isFinite(n)) return 90;
      return Math.max(0, Math.min(100, n));
    })();

    const coercedSubscriptionPrice = (() => {
      if (subscriptionPrice === null || subscriptionPrice === undefined) return 0;
      const n = Number(subscriptionPrice);
      if (!Number.isFinite(n) || n < 0) return 0;
      return n;
    })();

    const existing = await safeQuery<{ id: number }>(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [trimmedEmail]
    );

    if (existing.length) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
        correlationId
      });
    }

    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const r = await pool.query(
      "INSERT INTO users (email, password, name, role, status, is_verified, phone, genre, bio, social_links, revenue_share_percentage, admin_remarks, subscription_price, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now(), now()) RETURNING id, email, name, role, status, is_verified, verified, phone, genre, bio, social_links, revenue_share_percentage, admin_remarks, subscription_price, created_at, updated_at",
      [
        trimmedEmail,
        hashedPassword,
        name ?? null,
        "ARTIST",
        "ACTIVE",
        false,
        phone ?? null,
        genre ?? null,
        bio ?? null,
        socialLinks ? JSON.stringify(socialLinks) : null,
        coercedRevenueShare,
        adminRemarks ?? null,
        coercedSubscriptionPrice
      ]
    );
    const inserted: any = r.rows?.[0] ?? null;

    try {
      await pool.query(
        "INSERT INTO artist_stats (artist_id, total_plays, total_subscribers, total_earnings, created_at, updated_at) VALUES ($1, 0, 0, 0, now(), now()) ON CONFLICT (artist_id) DO NOTHING",
        [inserted?.id]
      );
    } catch {
      // ignore; stats row is best-effort for backward compatibility
    }

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "admin_created_artist",
        correlationId,
        adminUserId: (req as any)?.user?.id ?? null,
        artistUserId: inserted?.id ?? null,
        email: trimmedEmail,
        role: "ARTIST",
        status: inserted?.status ?? "ACTIVE"
      })}`
    );

    AuditService.log({
      action: 'admin.artist_created',
      entity: 'user',
      entityId: String(inserted?.id),
      performedBy: (req as any)?.user?.id,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: { email: trimmedEmail, artistName: name }
    });

    await invalidateArtistCache();

    return res.status(201).json({
      success: true,
      artist: {
        id: inserted?.id ?? null,
        name: inserted?.name ?? name ?? null,
        email: inserted?.email ?? trimmedEmail,
        role: (inserted?.role ?? "ARTIST").toString(),
        status: (inserted?.status ?? "ACTIVE").toString(),
        isVerified: Boolean(
          (inserted?.is_verified as any) ??
            (inserted?.verified as any) ??
            false
        ),
        phone: inserted?.phone ?? null,
        genre: inserted?.genre ?? null,
        bio: inserted?.bio ?? null,
        socialLinks: inserted?.social_links ?? null,
        revenueSharePercentage: Number(inserted?.revenue_share_percentage ?? 90),
        adminRemarks: inserted?.admin_remarks ?? null,
        subscriptionPrice: Number(inserted?.subscription_price ?? coercedSubscriptionPrice),
        createdAt: inserted?.created_at ?? null,
        updatedAt: inserted?.updated_at ?? null
      },
      correlationId
    });
  } catch (err: any) {
    console.error(
      `[AUDIT] ${JSON.stringify({
        event: "admin_created_artist",
        outcome: "error",
        correlationId,
        adminUserId: (req as any)?.user?.id ?? null,
        message: err?.message || String(err)
      })}`
    );

    return res.status(500).json({
      success: false,
      message: "Failed to create artist",
      correlationId
    });
  }
});

// Revenue Share Configuration Management (must be before /:id)
router.post("/revenue-share-config", requireAuth, requireAdmin, async (req, res) => {
  const { version, artistShare, platformShare } = req.body as {
    version?: string;
    artistShare?: number;
    platformShare?: number;
  };

  const allowedPlanTypes = ["basic", "growth", "pro", "managed"];

  if (!version || !allowedPlanTypes.includes(version)) {
    return res.status(400).json({ success: false, message: "Invalid plan type. Must be one of: basic, growth, pro, managed" });
  }

  if (typeof artistShare !== "number" || typeof platformShare !== "number") {
    return res.status(400).json({ success: false, message: "Invalid revenue share values" });
  }

  if (artistShare + platformShare !== 100) {
    return res.status(400).json({ success: false, message: "Revenue shares must sum to 100" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    // Check if plan type already exists
    const existingPlan = await safeQuery<any>(
      `SELECT id FROM revenue_share_configs WHERE version = $1`,
      [version]
    );

    if (existingPlan.length > 0) {
      return res.status(400).json({ success: false, message: `Plan type '${version}' already exists. Use PUT to update instead.` });
    }

    await pool.query(
      `INSERT INTO revenue_share_configs (version, artist_share, platform_share, effective_from, is_active)
       VALUES ($1, $2, $3, NOW(), true)`,
      [version, artistShare, platformShare]
    );

    console.log(`[AUDIT] revenue_share_config_created: ${version} by admin ${adminUserId}`);

    return res.json({
      success: true,
      version,
      artistShare,
      platformShare
    });
  } catch (error: any) {
    console.error('[admin/revenue-share-config POST] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to create revenue share configuration" });
  }
});

router.put("/revenue-share-config/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { artistShare, platformShare, isActive } = req.body as {
    artistShare?: number;
    platformShare?: number;
    isActive?: boolean;
  };

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  if (artistShare !== undefined && platformShare !== undefined) {
    if (typeof artistShare !== "number" || typeof platformShare !== "number") {
      return res.status(400).json({ success: false, message: "Invalid revenue share values" });
    }
    if (artistShare + platformShare !== 100) {
      return res.status(400).json({ success: false, message: "Revenue shares must sum to 100" });
    }
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (artistShare !== undefined && platformShare !== undefined) {
      updates.push(`artist_share = $${paramIndex++}`);
      values.push(artistShare);
      updates.push(`platform_share = $${paramIndex++}`);
      values.push(platformShare);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE revenue_share_configs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Commission plan not found" });
    }

    console.log(`[AUDIT] revenue_share_config_updated: id ${id} by admin ${adminUserId}`);

    return res.json({ success: true, config: result.rows[0] });
  } catch (error: any) {
    console.error('[admin/revenue-share-config PUT] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to update revenue share configuration" });
  }
});

router.delete("/revenue-share-config/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const result = await pool.query(
      `DELETE FROM revenue_share_configs WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Commission plan not found" });
    }

    console.log(`[AUDIT] revenue_share_config_deleted: id ${id} by admin ${adminUserId}`);

    return res.json({ success: true, message: "Commission plan deleted" });
  } catch (error: any) {
    console.error('[admin/revenue-share-config DELETE] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to delete revenue share configuration" });
  }
});

router.patch("/revenue-share-config", requireAuth, requireAdmin, async (req, res) => {
  const { artistShare, platformShare } = req.body as {
    artistShare?: number;
    platformShare?: number;
  };

  if (typeof artistShare !== "number" || typeof platformShare !== "number") {
    return res.status(400).json({ success: false, message: "Invalid revenue share values" });
  }

  if (artistShare + platformShare !== 100) {
    return res.status(400).json({ success: false, message: "Revenue shares must sum to 100" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const latestVersionRows = await safeQuery<any>(
      `SELECT version FROM revenue_share_configs ORDER BY created_at DESC LIMIT 1`,
      []
    );

    const latestVersion = latestVersionRows.length > 0 ? latestVersionRows[0].version : "v0";
    const versionNum = parseInt(String(latestVersion).replace("v", "")) || 0;
    const newVersion = `v${versionNum + 1}`;

    await pool.query(
      `INSERT INTO revenue_share_configs (version, artist_share, platform_share, effective_from, is_active)
       VALUES ($1, $2, $3, NOW(), true)`,
      [newVersion, artistShare, platformShare]
    );

    await pool.query(
      `UPDATE revenue_share_configs SET is_active = false WHERE version != $1`,
      [newVersion]
    );

    console.log(`[AUDIT] revenue_share_config_created: ${newVersion} by admin ${adminUserId}`);

    return res.json({
      success: true,
      version: newVersion,
      artistShare,
      platformShare
    });
  } catch (error: any) {
    console.error('[admin/revenue-share-config PATCH] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to update revenue share configuration" });
  }
});

router.get("/revenue-share-config", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";
  console.log("[admin] GET revenue-share-config called", { correlationId });

  try {
    const configs = await safeQuery<any>(
      `SELECT id, version, artist_share, platform_share, effective_from, is_active, created_at
       FROM revenue_share_configs
       ORDER BY created_at DESC`,
      []
    );
    console.log("[admin] revenue-share-config query result", { count: configs.length });

    const planDescriptions: Record<string, { name: string; description: string; benefits: string[] }> = {
      "basic": {
        name: "Basic Plan",
        description: "Standard streaming with essential tools for new artists",
        benefits: ["Standard Streaming", "Artist Dashboard", "Basic Analytics"]
      },
      "growth": {
        name: "Growth Plan",
        description: "Enhanced support and analytics for growing artists",
        benefits: ["Standard Streaming", "Promotional Support", "Advanced Analytics"]
      },
      "pro": {
        name: "Pro Plan",
        description: "Professional promotion and featured placement",
        benefits: ["Promotion", "Featured Placement"]
      },
      "managed": {
        name: "Managed Plan",
        description: "Full management support with priority promotion",
        benefits: ["Priority Promotion", "Artist Management Support"]
      }
    };

    return res.json({
      success: true,
      configs: configs.map((c) => ({
        id: c.id,
        version: c.version,
        name: planDescriptions[c.version]?.name || `Plan ${c.version}`,
        description: planDescriptions[c.version]?.description || "",
        benefits: planDescriptions[c.version]?.benefits || [],
        artistShare: c.artist_share,
        platformShare: c.platform_share,
        effectiveFrom: c.effective_from,
        isActive: c.is_active,
        createdAt: c.created_at
      }))
    });
  } catch (error: any) {
    console.error('[admin/revenue-share-config GET] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch revenue share configurations", correlationId });
  }
});

// Terms Management (must be before /:id)
router.post("/terms-versions", requireAuth, requireAdmin, async (req, res) => {
  const { content } = req.body as {
    content?: string;
  };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ success: false, message: "Terms content is required" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const latestVersionRows = await safeQuery<any>(
      `SELECT version FROM terms_versions ORDER BY created_at DESC LIMIT 1`,
      []
    );

    const latestVersion = latestVersionRows.length > 0 ? latestVersionRows[0].version : "v0";
    const versionNum = parseInt(String(latestVersion).replace("v", "")) || 0;
    const newVersion = `v${versionNum + 1}`;

    await pool.query(
      `INSERT INTO terms_versions (version, content, effective_from, is_active)
       VALUES ($1, $2, NOW(), true)`,
      [newVersion, content.trim()]
    );

    await pool.query(
      `UPDATE terms_versions SET is_active = false WHERE version != $1`,
      [newVersion]
    );

    console.log(`[AUDIT] terms_version_published: ${newVersion} by admin ${adminUserId}`);

    return res.json({
      success: true,
      version: newVersion,
      content: content.trim()
    });
  } catch (error: any) {
    console.error('[admin/terms-versions POST] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to publish terms version", correlationId });
  }
});

router.get("/terms-versions", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";
  console.log("[admin] GET terms-versions called", { correlationId });

  try {
    const terms = await safeQuery<any>(
      `SELECT version, content, effective_from, is_active, created_at, updated_at
       FROM terms_versions
       ORDER BY created_at DESC`,
      []
    );
    console.log("[admin] terms-versions query result", { count: terms.length });

    return res.json({
      success: true,
      terms: terms.map((t) => ({
        version: t.version,
        content: t.content,
        effectiveFrom: t.effective_from,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))
    });
  } catch (error: any) {
    console.error('[admin/terms-versions GET] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch terms versions", correlationId });
  }
});

router.get("/terms-versions/active", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";

  try {
    const activeTerms = await safeQuery<any>(
      `SELECT version, content, effective_from, created_at
       FROM terms_versions
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      []
    );

    if (!activeTerms.length) {
      return res.status(404).json({ success: false, message: "No active terms found" });
    }

    return res.json({
      success: true,
      terms: activeTerms[0]
    });
  } catch (error: any) {
    console.error('[admin/terms-versions/active GET] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch active terms", correlationId });
  }
});

router.put("/terms-versions/:version", requireAuth, requireAdmin, async (req, res) => {
  const version = req.params.version;
  const { isActive } = req.body as {
    isActive?: boolean;
  };

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const isAct = Boolean(isActive);
    if (isAct) {
      await pool.query(
        `UPDATE terms_versions SET is_active = false WHERE version != $1`,
        [version]
      );
    }
    
    await pool.query(
      `UPDATE terms_versions SET is_active = $1 WHERE version = $2`,
      [isAct, version]
    );

    console.log(`[AUDIT] terms_version_status_toggled: ${version} to ${isAct} by admin ${adminUserId}`);

    return res.json({ success: true, version, isActive: isAct });
  } catch (error: any) {
    console.error('[admin/terms-versions PUT] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to toggle terms status", correlationId });
  }
});

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const page = coercePositiveInt(req.query.page, 1);
  const limit = coercePositiveInt(req.query.limit, 10);
  const search = String(req.query.search ?? "").trim();
  const filter = String(req.query.filter ?? "").trim().toLowerCase();



  const offset = (page - 1) * limit;
  const whereParts: string[] = ["UPPER(role) = 'ARTIST'"];
  const params: any[] = [];

  // Default behavior: only show active (non-deleted) artists unless explicitly filtering.
  if (filter === "inactive" || filter === "deleted") {
    whereParts.push("(COALESCE(is_deleted, false) = true OR UPPER(COALESCE(status, 'ACTIVE')) = 'SUSPENDED')");
  } else {
    whereParts.push("(COALESCE(is_deleted, false) = false AND UPPER(COALESCE(status, 'ACTIVE')) <> 'SUSPENDED')");
  }

  if (filter === "pending") {
    whereParts.push("COALESCE(is_verified, verified, false) = false");
  }

  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    whereParts.push("(LOWER(name) LIKE $" + params.length + " OR LOWER(email) LIKE $" + params.length + ")");
  }

  const whereSql = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const totalCount = await safeScalar(
    `SELECT COUNT(*)::int as value FROM users ${whereSql}`,
    params,
    0
  );

  const itemsParams = [...params, limit, offset];
  const limitParam = itemsParams.length - 1;
  const offsetParam = itemsParams.length;

  const items = await safeQuery<any>(
    `SELECT id, name, email, profile_image_url, role,
      COALESCE(is_verified, verified, false) as is_verified,
      COALESCE(subscription_price, 0) as subscription_price,
      COALESCE(status, 'ACTIVE') as status,
      COALESCE(is_deleted, false) as is_deleted,
      deleted_at,
      deletion_reason,
      agreement_accepted,
      agreement_version,
      artist_revenue_share,
      platform_revenue_share,
      agreement_id,
      terms_version,
      agreement_status,
      agreement_start_date,
      signature_signed_at,
      digital_signature
     FROM users
     ${whereSql}
     ORDER BY created_at DESC NULLS LAST, id DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    itemsParams
  );

  const normalizedItems = items.map((u) => ({
    id: u.id,
    name: u.name ?? null,
    email: u.email,
    profileImage: u.profile_image_url ?? null,
    isVerified: Boolean(u.is_verified),
    subscriptionPrice: Number(u.subscription_price ?? 0),
    status: (u.status ?? "ACTIVE").toString(),
    isDeleted: Boolean(u.is_deleted),
    deletedAt: u.deleted_at ?? null,
    deletionReason: u.deletion_reason ?? null,
    agreementAccepted: Boolean(u.agreement_accepted),
    agreementVersion: u.agreement_version ?? null,
    artistRevenueShare: u.artist_revenue_share ?? null,
    platformRevenueShare: u.platform_revenue_share ?? null,
    agreementId: u.agreement_id ?? null,
    termsVersion: u.terms_version ?? null,
    agreementStatus: u.agreement_status ?? null,
    agreementStartDate: u.agreement_start_date ?? null,
    signatureSignedAt: u.signature_signed_at ?? null,
    digitalSignature: u.digital_signature ? decryptSignature(u.digital_signature) : null
  }));

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  return res.json({
    success: true,
    items: normalizedItems,
    totalCount,
    totalPages
  });
});

router.get("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  try {
  } catch {
    // ignore
  }

  const rows = await safeQuery<any>(
    `SELECT id, name, email, profile_image_url, banner_image_url,
      created_at,
      updated_at,
      COALESCE(is_verified, verified, false) as is_verified,
      COALESCE(subscription_price, 0) as subscription_price,
      COALESCE(status, 'ACTIVE') as status,
      COALESCE(is_deleted, false) as is_deleted,
      deleted_at,
      deletion_reason,
      last_login,
      phone,
      genre,
      COALESCE(bio, '') as bio,
      social_links,
      COALESCE(revenue_share_percentage, 90) as revenue_share_percentage,
      admin_remarks,
      agreement_accepted,
      agreement_accepted_at,
      agreement_version,
      artist_revenue_share,
      platform_revenue_share,
      digital_signature,
      signature_signed_at,
      agreement_id,
      terms_version,
      agreement_status,
      agreement_start_date,
      agreement_pdf_path,
      signature_ip_address,
      signature_user_agent
     FROM users
     WHERE id = $1 AND UPPER(role) = 'ARTIST'
     LIMIT 1`,
    [id]
  );

  if (!rows.length) {
    const fallback = await safeQuery<any>(
      "SELECT id, name, email, created_at, profile_image_url, status FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST' LIMIT 1",
      [id]
    );

    if (!fallback.length) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    const u = fallback[0];
    return res.json({
      success: true,
      artist: {
        id: u.id,
        name: u.name ?? null,
        email: u.email,
        profileImage: u.profile_image_url ?? null,
        bannerImage: null,
        isVerified: false,
        subscriptionPrice: 0,
        status: (u.status ?? "ACTIVE").toString(),
        totalContentCount: 0,
        accountCreatedDate: u.created_at ?? null,
        lastLogin: null
      }
    });
  }

  const u = rows[0];

  try {
    await pool.query(
      "INSERT INTO artist_stats (artist_id, total_plays, total_subscribers, total_earnings, created_at, updated_at) VALUES ($1, 0, 0, 0, now(), now()) ON CONFLICT (artist_id) DO NOTHING",
      [id]
    );
  } catch {
    // ignore
  }

  const totalContentCount = await safeScalar(
    "SELECT COUNT(*)::int as value FROM content_items WHERE artist_id = $1",
    [id],
    0
  );

  // Decrypt digital signature for display
  const decryptedSignature = u.digital_signature ? decryptSignature(u.digital_signature) : null;

  return res.json({
    success: true,
    artist: {
      id: u.id,
      name: u.name ?? null,
      email: u.email,
      profileImage: u.profile_image_url ?? null,
      bannerImage: u.banner_image_url ?? null,
      isVerified: Boolean(u.is_verified),
      subscriptionPrice: Number(u.subscription_price ?? 0),
      isDeleted: Boolean(u.is_deleted),
      deletedAt: u.deleted_at ?? null,
      deletionReason: u.deletion_reason ?? null,
      phone: u.phone ?? null,
      genre: u.genre ?? null,
      bio: u.bio ?? "",
      socialLinks: u.social_links ?? null,
      revenueSharePercentage: Number(u.revenue_share_percentage ?? 90),
      adminRemarks: u.admin_remarks ?? null,
      status: (u.status ?? "ACTIVE").toString(),
      totalContentCount,
      accountCreatedDate: u.created_at ?? null,
      accountUpdatedDate: u.updated_at ?? null,
      lastLogin: u.last_login ?? null,
      agreementAccepted: Boolean(u.agreement_accepted),
      agreementAcceptedAt: u.agreement_accepted_at ?? null,
      agreementVersion: u.agreement_version ?? null,
      artistRevenueShare: u.artist_revenue_share ?? null,
      platformRevenueShare: u.platform_revenue_share ?? null,
      digitalSignature: decryptedSignature,
      signatureSignedAt: u.signature_signed_at ?? null,
      agreementId: u.agreement_id ?? null,
      termsVersion: u.terms_version ?? null,
      agreementStatus: u.agreement_status ?? null,
      agreementStartDate: u.agreement_start_date ?? null,
      agreementPdfPath: u.agreement_pdf_path ?? null,
      signatureIpAddress: u.signature_ip_address ?? null,
      signatureUserAgent: u.signature_user_agent ?? null
    }
  });
});

router.patch("/:id/soft-delete", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const reason = String(req.body?.reason ?? req.body?.deletionReason ?? "").trim();
  if (!reason) {
    return res.status(400).json({ success: false, message: "Deletion reason is required", correlationId });
  }

  try {
  } catch {
    // ignore
  }

  try {
    const updated = await pool.query(
      `UPDATE users
       SET is_deleted = true,
           deleted_at = now(),
           deletion_reason = $2,
           updated_at = now()
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       RETURNING id, COALESCE(is_deleted, false) as is_deleted, deleted_at, deletion_reason`,
      [id, reason]
    );

    if (!updated.rows?.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    await invalidateArtistCache();

    AuditService.log({
      action: 'admin.artist_status_changed',
      entity: 'user',
      entityId: String(id),
      performedBy: (req as any)?.user?.id,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: { action: 'soft_delete', deletionReason: reason }
    });

    return res.json({
      success: true,
      artist: {
        id: updated.rows[0].id,
        isDeleted: Boolean(updated.rows[0].is_deleted),
        deletedAt: updated.rows[0].deleted_at ?? null,
        deletionReason: updated.rows[0].deletion_reason ?? null
      },
      correlationId
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to soft delete artist", correlationId });
  }
});

router.patch("/:id/reactivate", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const correlationId = (req as any)?.correlationId || "-";

  try {
  } catch {
    // ignore
  }

  try {
    const updated = await pool.query(
      `UPDATE users
       SET is_deleted = false,
           deleted_at = NULL,
           deletion_reason = NULL,
           status = 'ACTIVE',
           updated_at = now()
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       RETURNING id, COALESCE(is_deleted, false) as is_deleted, deleted_at, deletion_reason`,
      [id]
    );

    if (!updated.rows?.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    await invalidateArtistCache();

    AuditService.log({
      action: 'admin.artist_status_changed',
      entity: 'user',
      entityId: String(id),
      performedBy: (req as any)?.user?.id,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: { action: 'reactivate' }
    });

    return res.json({
      success: true,
      artist: {
        id: updated.rows[0].id,
        isDeleted: Boolean(updated.rows[0].is_deleted),
        deletedAt: updated.rows[0].deleted_at ?? null,
        deletionReason: updated.rows[0].deletion_reason ?? null
      },
      correlationId
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || "Failed to reactivate artist", correlationId });
  }
});

router.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const correlationId = (req as any)?.correlationId || "-";

  try {

    const {
      name,
      phone,
      genre,
      bio,
      socialLinks,
      revenueSharePercentage,
      subscriptionPrice,
      adminRemarks
    } = req.body as {
      name?: string | null;
      phone?: string | null;
      genre?: string | null;
      bio?: string | null;
      socialLinks?: Record<string, any> | null;
      revenueSharePercentage?: number | string | null;
      subscriptionPrice?: number | string | null;
      adminRemarks?: string | null;
    };

    const nextRevenueShare = (() => {
      if (revenueSharePercentage === undefined) return undefined;
      if (revenueSharePercentage === null) return null;
      const n = Number(revenueSharePercentage);
      if (!Number.isFinite(n)) return undefined;
      return Math.max(0, Math.min(100, n));
    })();

    const nextSubscriptionPrice = (() => {
      if (subscriptionPrice === undefined) return undefined;
      if (subscriptionPrice === null) return null;
      const n = Number(subscriptionPrice);
      if (!Number.isFinite(n) || n < 0) return undefined;
      return n;
    })();

    const socialLinksJson = socialLinks === undefined ? undefined : socialLinks ? JSON.stringify(socialLinks) : null;

    const sql = `UPDATE users
      SET name = COALESCE($2, name),
          phone = COALESCE($3, phone),
          genre = COALESCE($4, genre),
          bio = COALESCE($5, bio),
          social_links = COALESCE($6, social_links),
          revenue_share_percentage = COALESCE($7, revenue_share_percentage),
          subscription_price = COALESCE($8, subscription_price),
          admin_remarks = COALESCE($9, admin_remarks),
          updated_at = now()
      WHERE id = $1 AND UPPER(role) = 'ARTIST'
      RETURNING id, name, email,
        phone, genre, bio, social_links, revenue_share_percentage, admin_remarks,
        subscription_price, created_at, updated_at,
        profile_image_url, banner_image_url,
        COALESCE(is_verified, verified, false) as is_verified,
        COALESCE(status, 'ACTIVE') as status,
        last_login`;

    const updated = await pool.query(sql, [
      id,
      name ?? null,
      phone ?? null,
      genre ?? null,
      bio ?? null,
      socialLinksJson as any,
      nextRevenueShare as any,
      nextSubscriptionPrice as any,
      adminRemarks ?? null
    ]);

    if (!updated.rows?.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    await invalidateArtistCache();

    const u = updated.rows[0] as any;

    return res.json({
      success: true,
      artist: {
        id: u.id,
        name: u.name ?? null,
        email: u.email,
        profileImage: u.profile_image_url ?? null,
        bannerImage: u.banner_image_url ?? null,
        isVerified: Boolean(u.is_verified),
        subscriptionPrice: Number(u.subscription_price ?? 0),
        phone: u.phone ?? null,
        genre: u.genre ?? null,
        bio: u.bio ?? "",
        socialLinks: u.social_links ?? null,
        revenueSharePercentage: Number(u.revenue_share_percentage ?? 90),
        adminRemarks: u.admin_remarks ?? null,
        status: (u.status ?? "ACTIVE").toString(),
        accountCreatedDate: u.created_at ?? null,
        accountUpdatedDate: u.updated_at ?? null,
        lastLogin: u.last_login ?? null
      },
      correlationId
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || "Failed to update artist",
      correlationId
    });
  }
});

router.patch("/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const rows = await safeQuery<{ status: string; is_deleted: boolean }>(
    "SELECT COALESCE(status, 'ACTIVE') as status, COALESCE(is_deleted, false) as is_deleted FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST' LIMIT 1",
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  const current = (rows[0].status ?? "ACTIVE").toString().toUpperCase();
  const isDeleted = Boolean(rows[0].is_deleted);
  const isInactive = isDeleted || current === "SUSPENDED";

  try {
    if (isInactive) {
      await pool.query(
        `UPDATE users
         SET status = 'ACTIVE',
             is_deleted = false,
             deleted_at = NULL,
             deletion_reason = NULL,
             updated_at = now()
         WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
        [id]
      );
    } else {
      await pool.query(
        `UPDATE users
         SET status = 'ACTIVE',
             is_deleted = true,
             deleted_at = now(),
             deletion_reason = COALESCE(NULLIF(TRIM($2), ''), 'Deactivated by admin'),
             updated_at = now()
         WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
        [id, String(req.body?.reason ?? "")]
      );
    }
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }

  await invalidateCachePattern("artist_search:*");

  AuditService.log({
    action: 'admin.artist_status_changed',
    entity: 'user',
    entityId: String(id),
    performedBy: (req as any)?.user?.id,
    role: 'admin',
    status: 'success',
    metadata: { action: isInactive ? 'activate' : 'deactivate', reason: req.body?.reason }
  });

  return res.json({
    success: true,
    status: "ACTIVE",
    isDeleted: !isInactive
  });
});

router.patch("/:id/verified", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const requested = req.body?.isVerified;
  const hasRequested = typeof requested === "boolean";

  const currentRows = await safeQuery<{ is_verified: any }>(
    "SELECT COALESCE(is_verified, verified, false) as is_verified FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST' LIMIT 1",
    [id]
  );

  if (!currentRows.length) {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  const current = Boolean(currentRows[0].is_verified);
  const next = hasRequested ? Boolean(requested) : !current;

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    await pool.query(
      "UPDATE users SET is_verified = $2 WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [id, next]
    );
  } catch {
    try {
      await pool.query(
        "UPDATE users SET verified = $2 WHERE id = $1 AND UPPER(role) = 'ARTIST'",
        [id, next]
      );
    } catch {
      return res.status(500).json({ success: false, message: "Failed to update verified" });
    }
  }

  console.log(
    `[AUDIT] ${JSON.stringify({
      event: "artist_verification_updated",
      correlationId,
      adminUserId,
      artistUserId: id,
      previousIsVerified: current,
      nextIsVerified: next
    })}`
  );

  await invalidateCachePattern("artist_search:*");

  return res.json({ success: true, isVerified: next });
});

router.get("/:id/agreement-pdf", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const correlationId = (req as any)?.correlationId || "-";

  try {
    const artistRows = await safeQuery<any>(
      `SELECT
        name,
        email,
        phone,
        agreement_version,
        artist_revenue_share,
        platform_revenue_share,
        agreement_accepted_at,
        signature_signed_at,
        agreement_id,
        digital_signature,
        terms_version,
        agreement_start_date,
        created_at,
        profile_image_url
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [id]
    );

    if (!artistRows.length) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    const artist = artistRows[0];

    if (!artist.agreement_id || !artist.agreement_accepted_at) {
      return res.status(404).json({ success: false, message: "No agreement found for this artist" });
    }

    // Fetch terms content
    const termsRows = await safeQuery<any>(
      `SELECT content FROM terms_versions WHERE version = $1 LIMIT 1`,
      [artist.terms_version || "v1"]
    );

    const termsContent = termsRows.length > 0 ? termsRows[0].content : "Terms & Conditions not available.";

    const decryptedSignature = artist.digital_signature ? decryptSignature(artist.digital_signature) : "";

    const pdfBuffer = await AgreementPdfService.generateAgreementPdf({
      artistName: artist.name || "Unknown Artist",
      email: artist.email,
      phone: artist.phone,
      agreementVersion: artist.agreement_version || "v1",
      artistRevenueShare: artist.artist_revenue_share || 55,
      platformRevenueShare: artist.platform_revenue_share || 45,
      agreementAcceptedAt: new Date(artist.agreement_accepted_at),
      signatureSignedAt: new Date(artist.signature_signed_at || artist.agreement_accepted_at),
      agreementId: artist.agreement_id,
      digitalSignature: decryptedSignature,
      termsVersion: artist.terms_version || "v1",
      termsContent: termsContent,
      agreementStartDate: new Date(artist.agreement_start_date || artist.agreement_accepted_at),
      accountCreatedDate: artist.created_at ? new Date(artist.created_at) : null,
      profileImageUrl: artist.profile_image_url || null
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="artist-agreement-${artist.agreement_id}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('[admin/artists/:id/agreement-pdf] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to generate agreement PDF", correlationId });
  }
});

// Revenue Share Configuration Management
router.post("/revenue-share-config", requireAuth, requireAdmin, async (req, res) => {
  const { version, artistShare, platformShare } = req.body as {
    version?: string;
    artistShare?: number;
    platformShare?: number;
  };

  const allowedPlanTypes = ["basic", "growth", "pro", "managed"];

  if (!version || !allowedPlanTypes.includes(version)) {
    return res.status(400).json({ success: false, message: "Invalid plan type. Must be one of: basic, growth, pro, managed" });
  }

  if (typeof artistShare !== "number" || typeof platformShare !== "number") {
    return res.status(400).json({ success: false, message: "Invalid revenue share values" });
  }

  if (artistShare + platformShare !== 100) {
    return res.status(400).json({ success: false, message: "Revenue shares must sum to 100" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    // Check if plan type already exists
    const existingPlan = await safeQuery<any>(
      `SELECT id FROM revenue_share_configs WHERE version = $1`,
      [version]
    );

    if (existingPlan.length > 0) {
      return res.status(400).json({ success: false, message: `Plan type '${version}' already exists. Use PUT to update instead.` });
    }

    await pool.query(
      `INSERT INTO revenue_share_configs (version, artist_share, platform_share, effective_from, is_active)
       VALUES ($1, $2, $3, NOW(), true)`,
      [version, artistShare, platformShare]
    );

    console.log(`[AUDIT] revenue_share_config_created: ${version} by admin ${adminUserId}`);

    return res.json({
      success: true,
      version,
      artistShare,
      platformShare
    });
  } catch (error: any) {
    console.error('[admin/revenue-share-config POST] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to create revenue share configuration" });
  }
});

router.put("/revenue-share-config/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { artistShare, platformShare, isActive } = req.body as {
    artistShare?: number;
    platformShare?: number;
    isActive?: boolean;
  };

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  if (artistShare !== undefined && platformShare !== undefined) {
    if (typeof artistShare !== "number" || typeof platformShare !== "number") {
      return res.status(400).json({ success: false, message: "Invalid revenue share values" });
    }
    if (artistShare + platformShare !== 100) {
      return res.status(400).json({ success: false, message: "Revenue shares must sum to 100" });
    }
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (artistShare !== undefined && platformShare !== undefined) {
      updates.push(`artist_share = $${paramIndex++}`);
      values.push(artistShare);
      updates.push(`platform_share = $${paramIndex++}`);
      values.push(platformShare);
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: "No fields to update" });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await pool.query(
      `UPDATE revenue_share_configs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Commission plan not found" });
    }

    console.log(`[AUDIT] revenue_share_config_updated: id ${id} by admin ${adminUserId}`);

    return res.json({ success: true, config: result.rows[0] });
  } catch (error: any) {
    console.error('[admin/revenue-share-config PUT] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to update revenue share configuration" });
  }
});

router.delete("/revenue-share-config/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const result = await pool.query(
      `DELETE FROM revenue_share_configs WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Commission plan not found" });
    }

    console.log(`[AUDIT] revenue_share_config_deleted: id ${id} by admin ${adminUserId}`);

    return res.json({ success: true, message: "Commission plan deleted" });
  } catch (error: any) {
    console.error('[admin/revenue-share-config DELETE] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to delete revenue share configuration" });
  }
});

router.patch("/revenue-share-config", requireAuth, requireAdmin, async (req, res) => {
  const { artistShare, platformShare } = req.body as {
    artistShare?: number;
    platformShare?: number;
  };

  if (typeof artistShare !== "number" || typeof platformShare !== "number") {
    return res.status(400).json({ success: false, message: "Invalid revenue share values" });
  }

  if (artistShare + platformShare !== 100) {
    return res.status(400).json({ success: false, message: "Revenue shares must sum to 100" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    const latestVersionRows = await safeQuery<any>(
      `SELECT version FROM revenue_share_configs ORDER BY created_at DESC LIMIT 1`,
      []
    );

    const latestVersion = latestVersionRows.length > 0 ? latestVersionRows[0].version : "v0";
    const versionNum = parseInt(String(latestVersion).replace("v", "")) || 0;
    const newVersion = `v${versionNum + 1}`;

    await pool.query(
      `INSERT INTO revenue_share_configs (version, artist_share, platform_share, effective_from, is_active)
       VALUES ($1, $2, $3, NOW(), true)`,
      [newVersion, artistShare, platformShare]
    );

    await pool.query(
      `UPDATE revenue_share_configs SET is_active = false WHERE version != $1`,
      [newVersion]
    );

    console.log(`[AUDIT] revenue_share_config_created: ${newVersion} by admin ${adminUserId}`);

    return res.json({
      success: true,
      version: newVersion,
      artistShare,
      platformShare
    });
  } catch (error: any) {
    console.error('[admin/revenue-share-config PATCH] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to update revenue share configuration" });
  }
});

router.get("/revenue-share-config", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";
  console.log("[admin] GET revenue-share-config called", { correlationId });

  try {
    const configs = await safeQuery<any>(
      `SELECT id, version, artist_share, platform_share, effective_from, is_active, created_at
       FROM revenue_share_configs
       ORDER BY created_at DESC`,
      []
    );
    console.log("[admin] revenue-share-config query result", { count: configs.length });

    const planDescriptions: Record<string, { name: string; description: string; benefits: string[] }> = {
      "basic": {
        name: "Basic Plan",
        description: "Standard streaming with essential tools for new artists",
        benefits: ["Standard Streaming", "Artist Dashboard", "Basic Analytics"]
      },
      "growth": {
        name: "Growth Plan",
        description: "Enhanced support and analytics for growing artists",
        benefits: ["Standard Streaming", "Promotional Support", "Advanced Analytics"]
      },
      "pro": {
        name: "Pro Plan",
        description: "Professional promotion and featured placement",
        benefits: ["Promotion", "Featured Placement"]
      },
      "managed": {
        name: "Managed Plan",
        description: "Full management support with priority promotion",
        benefits: ["Priority Promotion", "Artist Management Support"]
      }
    };

    return res.json({
      success: true,
      configs: configs.map((c) => ({
        id: c.id,
        version: c.version,
        name: planDescriptions[c.version]?.name || `Plan ${c.version}`,
        description: planDescriptions[c.version]?.description || "",
        benefits: planDescriptions[c.version]?.benefits || [],
        artistShare: c.artist_share,
        platformShare: c.platform_share,
        effectiveFrom: c.effective_from,
        isActive: c.is_active,
        createdAt: c.created_at
      }))
    });
  } catch (error: any) {
    console.error('[admin/revenue-share-config GET] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch revenue share configurations", correlationId });
  }
});

// Terms Management
router.post("/terms-versions", requireAuth, requireAdmin, async (req, res) => {
  const { content } = req.body as {
    content?: string;
  };

  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return res.status(400).json({ success: false, message: "Terms content is required" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    // Get the latest version number
    const latestVersionRows = await safeQuery<any>(
      `SELECT version FROM terms_versions ORDER BY created_at DESC LIMIT 1`,
      []
    );

    const latestVersion = latestVersionRows.length > 0 ? latestVersionRows[0].version : "v0";

    // Extract version number and increment
    const versionNum = parseInt(String(latestVersion).replace("v", "")) || 0;
    const newVersion = `v${versionNum + 1}`;

    // Insert new terms version
    await pool.query(
      `INSERT INTO terms_versions (version, content, effective_from, is_active)
       VALUES ($1, $2, NOW(), true)`,
      [newVersion, content.trim()]
    );

    // Deactivate old terms
    await pool.query(
      `UPDATE terms_versions SET is_active = false WHERE version != $1`,
      [newVersion]
    );

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "terms_version_published",
        correlationId,
        adminUserId,
        newVersion
      })}`
    );

    return res.json({
      success: true,
      version: newVersion,
      content: content.trim()
    });
  } catch (error: any) {
    console.error('[admin/terms-versions POST] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to publish terms version", correlationId });
  }
});

router.get("/terms-versions", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";
  console.log("[admin] GET terms-versions called", { correlationId });

  try {
    const terms = await safeQuery<any>(
      `SELECT version, content, effective_from, is_active, created_at, updated_at
       FROM terms_versions
       ORDER BY created_at DESC`,
      []
    );
    console.log("[admin] terms-versions query result", { count: terms.length });

    return res.json({
      success: true,
      terms: terms.map((t) => ({
        version: t.version,
        content: t.content,
        effectiveFrom: t.effective_from,
        isActive: t.is_active,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }))
    });
  } catch (error: any) {
    console.error('[admin/terms-versions GET] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch terms versions", correlationId });
  }
});

router.get("/terms-versions/active", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";

  try {
    const activeTerms = await safeQuery<any>(
      `SELECT version, content, effective_from, created_at
       FROM terms_versions
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      []
    );

    if (!activeTerms.length) {
      return res.status(404).json({ success: false, message: "No active terms found" });
    }

    return res.json({
      success: true,
      terms: {
        version: activeTerms[0].version,
        content: activeTerms[0].content,
        effectiveFrom: activeTerms[0].effective_from,
        createdAt: activeTerms[0].created_at
      }
    });
  } catch (error: any) {
    console.error('[admin/terms-versions/active GET] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch active terms", correlationId });
  }
});

// Approve Agreement (transition from PENDING_APPROVAL to ACTIVE)
router.patch("/:id/approve-agreement", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    // Check if artist exists and has agreement
    const artistRows = await safeQuery<any>(
      `SELECT id, name, email, agreement_accepted, agreement_status, artist_status
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [id]
    );

    if (!artistRows.length) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    const artist = artistRows[0];

    if (!artist.agreement_accepted) {
      return res.status(400).json({ success: false, message: "Artist has not signed agreement yet" });
    }

    if (artist.agreement_status === "ACTIVE") {
      return res.status(400).json({ success: false, message: "Agreement is already active" });
    }

    if (artist.agreement_status === "SUSPENDED" || artist.agreement_status === "TERMINATED") {
      return res.status(400).json({ success: false, message: "Cannot approve suspended or terminated agreement" });
    }

    // Update agreement status to ACTIVE and artist status to APPROVED
    await pool.query(
      `UPDATE users
       SET agreement_status = 'ACTIVE',
           artist_status = 'APPROVED',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    // Log audit event
    AuditService.log({
      action: 'artist.agreement_approved',
      entity: 'user',
      entityId: String(id),
      performedBy: adminUserId,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: {
        artistName: artist.name,
        artistEmail: artist.email,
        previousStatus: artist.agreement_status,
        newStatus: 'ACTIVE'
      }
    });

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "artist_agreement_approved",
        correlationId,
        adminUserId,
        artistUserId: id,
        artistName: artist.name,
        artistEmail: artist.email
      })}`
    );

    // Invalidate cache
    await invalidateArtistCache();

    return res.json({
      success: true,
      message: "Agreement approved successfully",
      agreementStatus: "ACTIVE",
      artistStatus: "APPROVED"
    });
  } catch (error: any) {
    console.error('[admin/artists/:id/approve-agreement] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to approve agreement", correlationId });
  }
});

// Reject Agreement
router.patch("/:id/reject-agreement", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const { reason } = req.body as {
    reason?: string;
  };

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    // Check if artist exists and has agreement
    const artistRows = await safeQuery<any>(
      `SELECT id, name, email, agreement_accepted, agreement_status
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [id]
    );

    if (!artistRows.length) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    const artist = artistRows[0];

    if (!artist.agreement_accepted) {
      return res.status(400).json({ success: false, message: "Artist has not signed agreement yet" });
    }

    if (artist.agreement_status === "ACTIVE") {
      return res.status(400).json({ success: false, message: "Cannot reject active agreement. Use suspend instead." });
    }

    // Update agreement status to REJECTED and artist status to REJECTED
    await pool.query(
      `UPDATE users
       SET agreement_status = 'REJECTED',
           artist_status = 'REJECTED',
           admin_remarks = COALESCE(admin_remarks || '', '') || 'Rejection reason: ' || $2,
           updated_at = NOW()
       WHERE id = $1`,
      [id, reason || "No reason provided"]
    );

    // Log audit event
    AuditService.log({
      action: 'artist.agreement_rejected',
      entity: 'user',
      entityId: String(id),
      performedBy: adminUserId,
      role: 'admin',
      status: 'success',
      correlationId,
      metadata: {
        artistName: artist.name,
        artistEmail: artist.email,
        previousStatus: artist.agreement_status,
        newStatus: 'REJECTED',
        rejectionReason: reason
      }
    });

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "artist_agreement_rejected",
        correlationId,
        adminUserId,
        artistUserId: id,
        artistName: artist.name,
        artistEmail: artist.email,
        rejectionReason: reason
      })}`
    );

    // Invalidate cache
    await invalidateArtistCache();

    return res.json({
      success: true,
      message: "Agreement rejected successfully",
      agreementStatus: "REJECTED",
      artistStatus: "REJECTED"
    });
  } catch (error: any) {
    console.error('[admin/artists/:id/reject-agreement] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to reject agreement", correlationId });
  }
});

// Update Agreement Status
router.patch("/:id/agreement-status", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ success: false, message: "Invalid id" });
  }

  const { status } = req.body as {
    status?: string;
  };

  if (!status || !['ACTIVE', 'SUSPENDED', 'TERMINATED'].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status. Must be ACTIVE, SUSPENDED, or TERMINATED" });
  }

  const correlationId = (req as any)?.correlationId || "-";
  const adminUserId = (req as any)?.user?.id ?? null;

  try {
    // Check if artist exists and has agreement
    const artistRows = await safeQuery<any>(
      `SELECT id, name, agreement_accepted, agreement_status
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [id]
    );

    if (!artistRows.length) {
      return res.status(404).json({ success: false, message: "Artist not found" });
    }

    const artist = artistRows[0];

    if (!artist.agreement_accepted) {
      return res.status(400).json({ success: false, message: "Artist has not signed agreement yet" });
    }

    // Update agreement status
    await pool.query(
      `UPDATE users
       SET agreement_status = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [status, id]
    );

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "artist_agreement_status_updated",
        correlationId,
        adminUserId,
        artistUserId: id,
        artistName: artist.name,
        oldStatus: artist.agreement_status,
        newStatus: status
      })}`
    );

    return res.json({
      success: true,
      message: `Agreement status updated to ${status}`,
      agreementStatus: status
    });
  } catch (error: any) {
    console.error('[admin/artists/:id/agreement-status] error', correlationId, error?.message);
    return res.status(500).json({ success: false, message: "Failed to update agreement status", correlationId });
  }
});

export default router;
