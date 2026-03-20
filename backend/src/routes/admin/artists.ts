import { Router } from "express";
import bcrypt from "bcrypt";
import { requireAuth } from "../../common/auth/requireAuth";
import { pool } from "../../common/db";

const router = Router();

const ensureArtistOnboardingSchema = async () => {
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'ACTIVE'"
  );
  await pool
    .query("ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'")
    .catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS artist_bio TEXT").catch(() => undefined);
  await pool
    .query("ALTER TABLE users ADD COLUMN IF NOT EXISTS portfolio_links TEXT[] NOT NULL DEFAULT '{}'")
    .catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ").catch(() => undefined);
  await pool.query("ALTER TABLE users ALTER COLUMN artist_status SET DEFAULT 'PENDING'").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verified BOOLEAN");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_image_url TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30)");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS genre VARCHAR(120)");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB");
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ").catch(() => undefined);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS deletion_reason TEXT").catch(() => undefined);
  await pool.query("ALTER TABLE users ALTER COLUMN is_deleted SET DEFAULT false").catch(() => undefined);
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS revenue_share_percentage NUMERIC NOT NULL DEFAULT 90"
  );
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_remarks TEXT");
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_price NUMERIC NOT NULL DEFAULT 0"
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
};

const ensureArtistStatsSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS artist_stats (
      artist_id INT PRIMARY KEY,
      total_plays INT NOT NULL DEFAULT 0,
      total_subscribers INT NOT NULL DEFAULT 0,
      total_earnings NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await pool.query("ALTER TABLE artist_stats ADD COLUMN IF NOT EXISTS total_plays INT NOT NULL DEFAULT 0");
  await pool.query(
    "ALTER TABLE artist_stats ADD COLUMN IF NOT EXISTS total_subscribers INT NOT NULL DEFAULT 0"
  );
  await pool.query(
    "ALTER TABLE artist_stats ADD COLUMN IF NOT EXISTS total_earnings NUMERIC NOT NULL DEFAULT 0"
  );
  await pool.query(
    "ALTER TABLE artist_stats ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
  await pool.query(
    "ALTER TABLE artist_stats ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()"
  );
};

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

router.post("/create", requireAuth, requireAdmin, async (req, res) => {
  const correlationId = (req as any)?.correlationId || "-";

  try {
    await ensureArtistOnboardingSchema();
    await ensureArtistStatsSchema();

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

router.get("/", requireAuth, requireAdmin, async (req, res) => {
  const page = coercePositiveInt(req.query.page, 1);
  const limit = coercePositiveInt(req.query.limit, 10);
  const search = String(req.query.search ?? "").trim();
  const filter = String(req.query.filter ?? "").trim().toLowerCase();

  try {
    await ensureArtistOnboardingSchema();
  } catch {
    // ignore migration errors; select below will surface anything critical
  }

  const offset = (page - 1) * limit;
  const whereParts: string[] = ["UPPER(role) = 'ARTIST'"];
  const params: any[] = [];

  // Default behavior: only show active (non-deleted) artists unless explicitly filtering.
  if (filter === "inactive" || filter === "deleted") {
    whereParts.push("COALESCE(is_deleted, false) = true");
  } else {
    whereParts.push("COALESCE(is_deleted, false) = false");
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
      deletion_reason
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
    deletionReason: u.deletion_reason ?? null
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
    await ensureArtistOnboardingSchema();
    await ensureArtistStatsSchema();
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
      admin_remarks
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
      lastLogin: u.last_login ?? null
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
    await ensureArtistOnboardingSchema();
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
    await ensureArtistOnboardingSchema();
  } catch {
    // ignore
  }

  try {
    const updated = await pool.query(
      `UPDATE users
       SET is_deleted = false,
           deleted_at = NULL,
           deletion_reason = NULL,
           updated_at = now()
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       RETURNING id, COALESCE(is_deleted, false) as is_deleted, deleted_at, deletion_reason`,
      [id]
    );

    if (!updated.rows?.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

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
    await ensureArtistOnboardingSchema();

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

  const rows = await safeQuery<{ status: string }>(
    "SELECT COALESCE(status, 'ACTIVE') as status FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST' LIMIT 1",
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: "Artist not found" });
  }

  const current = (rows[0].status ?? "ACTIVE").toString().toUpperCase();
  const next = current === "SUSPENDED" ? "ACTIVE" : "SUSPENDED";

  try {
    await pool.query(
      "UPDATE users SET status = $2 WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [id, next]
    );
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }

  return res.json({ success: true, status: next });
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

  return res.json({ success: true, isVerified: next });
});

export default router;
