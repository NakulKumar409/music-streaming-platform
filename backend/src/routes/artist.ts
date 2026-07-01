import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { requireAuth } from "../common/auth/requireAuth";
import { pool } from "../common/db";
import { uploadLimiter } from "../common/security/rateLimit";
import { invalidateArtistCache } from "../common/cache";
import multer from "multer";
import path from "path";
import fs from "fs";
import { AnalyticsController } from "../controllers/analyticsController";
import { logger } from "../common/logger";
import { AuditService } from "../shared/audit/audit.service";
import { AgreementPdfService } from "../services/agreement-pdf.service";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.get("/dashboard/subscription-insights", requireAuth, AnalyticsController.getArtistSubscriptionInsights);

const requireArtist = (req: any, res: any, next: any) => {
  const role = (req.user?.role || "").toUpperCase();
  if (role !== "ARTIST") {
    return res.status(403).json({
      success: false,
      message: "Forbidden"
    });

  }
  return next();
};

const EARLY_ACCESS_DAYS = 7;

// Encryption helpers for digital signature
const ENCRYPTION_KEY = process.env.SIGNATURE_ENCRYPTION_KEY || crypto.randomBytes(32);
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

const encryptSignature = (signature: string): string => {
  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.isBuffer(ENCRYPTION_KEY) ? ENCRYPTION_KEY : Buffer.from(ENCRYPTION_KEY as string, 'hex').slice(0, 32);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(signature, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error encrypting signature:', error);
    return signature; // Fallback to unencrypted if encryption fails
  }
};

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

const ensureUploadsDir = () => {
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      cb(null, ensureUploadsDir());
    } catch (e: any) {
      cb(e, ensureUploadsDir());
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}${ext}`);
  }
});

const uploadImage = multer({
  storage: imageStorage,
  limits: {
    fileSize: 1024 * 1024 * 10
  }
});

router.post("/onboard", uploadLimiter, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    const {
      email,
      password,
      artistName,
      bio,
      portfolioLinks,
      phone,
      genre,
      agreementAccepted,
      agreementVersion,
      commissionPlanId,
      digitalSignature,
      termsVersion
    } = req.body as {
      email?: string;
      password?: string;
      artistName?: string;
      bio?: string;
      portfolioLinks?: any;
      phone?: string;
      genre?: string;
      agreementAccepted?: boolean;
      agreementVersion?: string;
      commissionPlanId?: string;
      digitalSignature?: string;
      termsVersion?: string;
    };

    const trimmedEmail = (email || "").trim().toLowerCase();
    const trimmedPassword = (password || "").toString();
    const trimmedName = (artistName || "").trim();
    const trimmedBio = (bio || "").trim();

    const links = Array.isArray(portfolioLinks)
      ? portfolioLinks
          .map((x) => (x ?? "").toString().trim())
          .filter(Boolean)
          .slice(0, 20)
      : typeof portfolioLinks === "string"
        ? portfolioLinks
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

    if (!trimmedEmail) {
      return res.status(400).json({ success: false, message: "email is required", correlationId });
    }
    if (!trimmedPassword || trimmedPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "password is required (min 6 chars)",
        correlationId
      });
    }
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: "artistName is required", correlationId });
    }

    // Validate commission plan if provided
    let artistRevenueShare: number | null = null;
    let platformRevenueShare: number | null = null;

    if (commissionPlanId) {
      const planRows = await safeRows<any>(
        `SELECT id, artist_share, platform_share, is_active 
         FROM revenue_share_configs 
         WHERE id = $1 
         LIMIT 1`,
        [Number(commissionPlanId)],
        []
      );

      if (!planRows.length) {
        return res.status(400).json({ success: false, message: "Invalid commission plan", correlationId });
      }

      const plan = planRows[0];
      if (!plan.is_active) {
        return res.status(400).json({ success: false, message: "Commission plan is not active", correlationId });
      }

      artistRevenueShare = plan.artist_share;
      platformRevenueShare = plan.platform_share;
    }

    // Validate terms version if provided
    let termsContentHash: string | null = null;
    if (termsVersion) {
      const termsRows = await safeRows<any>(
        `SELECT version, content, is_active 
         FROM terms_versions 
         WHERE version = $1 
         LIMIT 1`,
        [termsVersion],
        []
      );

      if (!termsRows.length) {
        return res.status(400).json({ success: false, message: "Invalid terms version", correlationId });
      }

      if (!termsRows[0].is_active) {
        return res.status(400).json({ success: false, message: "Terms version is not active", correlationId });
      }

      // Generate content hash for verification
      const termsContent = termsRows[0].content;
      termsContentHash = crypto.createHash('sha256').update(termsContent).digest('hex');
    }

    const existing = await safeRows<any>(
      "SELECT id, role FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [trimmedEmail],
      []
    );

    const hashedPassword = await bcrypt.hash(trimmedPassword, 10);

    let userId: number | null = null;

    const agreementId = agreementAccepted ? uuidv4() : null;
    const agreementAcceptedAt = agreementAccepted ? new Date() : null;
    const signatureSignedAt = agreementAccepted && digitalSignature ? new Date() : null;
    const agreementStartDate = agreementAccepted ? new Date() : null;
    const agreementStatus = agreementAccepted ? "PENDING_APPROVAL" : null;

    // Encrypt digital signature before storage
    const encryptedSignature = digitalSignature ? encryptSignature(digitalSignature) : null;

    if (!existing.length) {
      const inserted = await pool.query(
        `INSERT INTO users (email, password, name, role, status, is_verified, verified, phone, genre, artist_status, artist_bio, portfolio_links, onboarded_at, created_at, updated_at, agreement_accepted, agreement_accepted_at, agreement_version, artist_revenue_share, platform_revenue_share, digital_signature, signature_signed_at, agreement_id, terms_version, agreement_status, agreement_start_date, signature_ip_address, signature_user_agent)
         VALUES ($1, $2, $3, 'ARTIST', 'ACTIVE', false, false, $4, $5, 'PENDING', $6, $7, now(), now(), now(), $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         RETURNING id`,
        [
          trimmedEmail,
          hashedPassword,
          trimmedName,
          phone ?? null,
          genre ?? null,
          trimmedBio,
          links,
          agreementAccepted || false,
          agreementAcceptedAt,
          agreementVersion || null,
          artistRevenueShare || null,
          platformRevenueShare || null,
          encryptedSignature || null,
          signatureSignedAt,
          agreementId,
          termsVersion || null,
          agreementStatus,
          agreementStartDate,
          req.ip || req.connection?.remoteAddress || null,
          req.get('user-agent') || null
        ]
      );
      userId = Number(inserted.rows?.[0]?.id ?? 0) || null;
    } else {
      const r = (existing[0]?.role ?? "").toString().toUpperCase();
      if (r && r !== "ARTIST" && r !== "FAN") {
        return res.status(409).json({ success: false, message: "Email already in use", correlationId });
      }

      const updated = await pool.query(
        `UPDATE users
         SET password = $2,
             name = $3,
             role = 'ARTIST',
             status = COALESCE(status, 'ACTIVE'),
             is_verified = false,
             verified = false,
             phone = COALESCE($4, phone),
             genre = COALESCE($5, genre),
             artist_status = 'PENDING',
             artist_bio = $6,
             portfolio_links = $7,
             onboarded_at = now(),
             updated_at = now(),
             agreement_accepted = COALESCE($8, agreement_accepted),
             agreement_accepted_at = COALESCE($9, agreement_accepted_at),
             agreement_version = COALESCE($10, agreement_version),
             artist_revenue_share = COALESCE($11, artist_revenue_share),
             platform_revenue_share = COALESCE($12, platform_revenue_share),
             digital_signature = COALESCE($13, digital_signature),
             signature_signed_at = COALESCE($14, signature_signed_at),
             agreement_id = COALESCE($15, agreement_id),
             terms_version = COALESCE($16, terms_version),
             agreement_status = COALESCE($17, agreement_status),
             agreement_start_date = COALESCE($18, agreement_start_date),
             signature_ip_address = COALESCE($19, signature_ip_address),
             signature_user_agent = COALESCE($20, signature_user_agent)
         WHERE LOWER(email) = $1
         RETURNING id`,
        [
          trimmedEmail,
          hashedPassword,
          trimmedName,
          phone ?? null,
          genre ?? null,
          trimmedBio,
          links,
          agreementAccepted || false,
          agreementAcceptedAt,
          agreementVersion || null,
          artistRevenueShare || null,
          platformRevenueShare || null,
          encryptedSignature || null,
          signatureSignedAt,
          agreementId,
          termsVersion || null,
          agreementStatus,
          agreementStartDate,
          req.ip || req.connection?.remoteAddress || null,
          req.get('user-agent') || null
        ]
      );
      userId = Number(updated.rows?.[0]?.id ?? 0) || null;
    }

    if (!userId) {
      return res.status(500).json({ success: false, message: "Failed to onboard artist", correlationId });
    }

    // Generate agreement PDF if agreement was accepted
    let agreementPdfPath: string | null = null;
    if (agreementAccepted && agreementId && digitalSignature) {
      try {
        const termsRows = await safeRows<any>(
          `SELECT content FROM terms_versions WHERE version = $1 LIMIT 1`,
          [termsVersion || "v1"],
          []
        );
        const termsContent = termsRows.length > 0 ? termsRows[0].content : "Terms & Conditions not available.";

        const pdfBuffer = await AgreementPdfService.generateAgreementPdf({
          artistName: trimmedName,
          email: trimmedEmail,
          phone: phone || undefined,
          agreementVersion: agreementVersion || "v1",
          artistRevenueShare: artistRevenueShare || 55,
          platformRevenueShare: platformRevenueShare || 45,
          agreementAcceptedAt: agreementAcceptedAt || new Date(),
          signatureSignedAt: signatureSignedAt || new Date(),
          agreementId: agreementId,
          digitalSignature: digitalSignature,
          termsVersion: termsVersion || "v1",
          termsContent: termsContent,
          agreementStartDate: agreementStartDate || new Date()
        });

        // Save PDF to disk
        const pdfDir = path.join(process.cwd(), "public", "agreements");
        if (!fs.existsSync(pdfDir)) {
          fs.mkdirSync(pdfDir, { recursive: true });
        }
        const pdfFileName = `agreement-${agreementId}.pdf`;
        const pdfFilePath = path.join(pdfDir, pdfFileName);
        fs.writeFileSync(pdfFilePath, pdfBuffer);
        agreementPdfPath = `/agreements/${pdfFileName}`;

        // Update user record with PDF path
        await pool.query(
          `UPDATE users SET agreement_pdf_path = $2 WHERE id = $1`,
          [userId, agreementPdfPath]
        );

        logger.info({ userId, agreementId, pdfPath: agreementPdfPath }, "[artist/onboard] Agreement PDF generated");
      } catch (pdfError: any) {
        logger.error({ error: pdfError?.message }, "[artist/onboard] Failed to generate agreement PDF");
        // Don't fail the onboarding if PDF generation fails
      }
    }

    const token = jwt.sign(
      { id: userId, email: trimmedEmail, role: "ARTIST" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    console.log(
      `[AUDIT] ${JSON.stringify({
        event: "artist_onboard_submitted",
        correlationId,
        userId,
        email: trimmedEmail,
        artistStatus: "PENDING",
        agreementAccepted,
        agreementVersion,
        agreementId,
        commissionPlanId,
        termsVersion,
        agreementPdfPath
      })}`
    );

    return res.status(201).json({
      success: true,
      token,
      pendingApproval: true,
      user: {
        id: userId,
        email: trimmedEmail,
        role: "ARTIST",
        isVerified: false,
        status: "ACTIVE"
      },
      correlationId
    });
  } catch (err: any) {
    console.error("[artist/onboard] error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to submit application", correlationId });
  }
});

router.patch("/onboard", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const { artistName, bio, portfolioLinks, phone } = req.body as {
      artistName?: string;
      bio?: string;
      portfolioLinks?: any;
      phone?: string;
    };

    const trimmedName = (artistName || "").trim();
    const trimmedBio = (bio || "").trim();

    const links = Array.isArray(portfolioLinks)
      ? portfolioLinks
          .map((x) => (x ?? "").toString().trim())
          .filter(Boolean)
          .slice(0, 20)
      : typeof portfolioLinks === "string"
        ? portfolioLinks
            .split("\n")
            .map((x) => x.trim())
            .filter(Boolean)
            .slice(0, 20)
        : [];

    if (!trimmedName) {
      return res.status(400).json({ success: false, message: "artistName is required", correlationId });
    }
    if (!trimmedBio) {
      return res.status(400).json({ success: false, message: "bio is required", correlationId });
    }
    if (!links.length) {
      return res.status(400).json({ success: false, message: "portfolioLinks is required", correlationId });
    }

    await pool.query(
      `UPDATE users
       SET name = $2,
           phone = COALESCE($3, phone),
           artist_bio = $4,
           portfolio_links = $5,
           artist_status = 'PENDING',
           onboarded_at = now(),
           updated_at = now()
       WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
      [artistUserId, trimmedName, phone ?? null, trimmedBio, links]
    );

    audit(req, { event: "artist_onboard_resubmitted", outcome: "success" });
    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_onboard_resubmitted", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to resubmit application", correlationId });
  }
});

router.patch("/appeal", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const { message } = req.body as { message?: string };
    const msg = (message ?? "").toString().trim();
    if (!msg) {
      return res.status(400).json({ success: false, message: "message is required", correlationId });
    }

    await pool.query(
      "UPDATE users SET artist_appeal_message = $2, updated_at = now() WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [artistUserId, msg]
    );

    audit(req, { event: "artist_appeal_submitted", outcome: "success" });
    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_appeal_submitted", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to submit appeal", correlationId });
  }
});

const safeScalarNumber = async (
  query: string,
  params: any[],
  fallback = 0
): Promise<number> => {
  try {
    const r = await pool.query(query, params);
    const v = r.rows?.[0]?.value ?? r.rows?.[0]?.c ?? r.rows?.[0]?.count;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};

// Public API: Get all commission plans (for artist onboarding dropdown)
router.get("/commission-plans", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    const rows = await safeRows<any>(
      `SELECT id, version, artist_share, platform_share, effective_from, is_active
       FROM revenue_share_configs
       ORDER BY effective_from DESC`,
      [],
      []
    );

    const planDescriptions: Record<string, { name: string; description: string; benefits: string[] }> = {
      basic: {
        name: "Basic Plan",
        description: "Standard streaming with essential tools for new artists",
        benefits: ["Standard Streaming", "Artist Dashboard", "Basic Analytics"]
      },
      growth: {
        name: "Growth Plan",
        description: "Enhanced support and analytics for growing artists",
        benefits: ["Standard Streaming", "Promotional Support", "Advanced Analytics"]
      },
      pro: {
        name: "Pro Plan",
        description: "Professional promotion and featured placement",
        benefits: ["Promotion", "Featured Placement"]
      },
      managed: {
        name: "Managed Plan",
        description: "Full management support with priority promotion",
        benefits: ["Priority Promotion", "Artist Management Support"]
      }
    };

    const plans = rows.map((r: any) => {
      const desc = planDescriptions[r.version] || { name: `Plan ${r.version}`, description: "", benefits: [] };
      return {
        id: r.id,
        version: r.version,
        name: desc.name,
        description: desc.description,
        benefits: desc.benefits,
        artistShare: r.artist_share,
        platformShare: r.platform_share,
        effectiveFrom: r.effective_from,
        isActive: r.is_active
      };
    });

    return res.json({
      success: true,
      plans,
      correlationId
    });
  } catch (err: any) {
    console.error("[artist/commission-plans] error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch commission plans", correlationId });
  }
});

// Public API: Get current terms
router.get("/terms/current", async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    const rows = await safeRows<any>(
      `SELECT version, content, effective_from, is_active
       FROM terms_versions
       WHERE is_active = true
       ORDER BY created_at DESC
       LIMIT 1`,
      [],
      []
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "No active terms found", correlationId });
    }

    const terms = {
      version: rows[0].version,
      content: rows[0].content,
      effectiveFrom: rows[0].effective_from,
      isActive: rows[0].is_active
    };

    return res.json({
      success: true,
      terms,
      correlationId
    });
  } catch (err: any) {
    console.error("[artist/terms/current] error", correlationId, err?.message);
    return res.status(500).json({ success: false, message: "Failed to fetch terms", correlationId });
  }
});

const safeRows = async <T = any>(query: string, params: any[], fallback: T[] = []): Promise<T[]> => {
  try {
    const r = await pool.query(query, params);
    return (r.rows as T[]) ?? fallback;
  } catch {
    return fallback;
  }
};

const audit = (req: any, payload: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req?.user?.id ?? null;
  console.log(
    `[AUDIT] ${JSON.stringify({
      role: "ARTIST",
      correlationId,
      artistUserId,
      ...payload
    })}`
  );
};

router.post(
  "/uploads/image",
  uploadLimiter,
  requireAuth,
  requireArtist,
  uploadImage.single("image"),
  async (req: any, res: any) => {
    const correlationId = req?.correlationId || "-";

    try {

      const kindRaw = (req.body?.kind ?? "").toString().trim().toLowerCase();
      const kind = kindRaw === "banner" ? "banner" : kindRaw === "profile" ? "profile" : "";

      if (!kind) {
        return res.status(400).json({
          success: false,
          message: "kind must be 'profile' or 'banner'",
          correlationId
        });
      }

      const file = req.file as any;
      if (!file?.filename) {
        return res.status(400).json({
          success: false,
          message: "image file is required",
          correlationId
        });
      }

      const url = `/uploads/${file.filename}`;

      const artistUserId = req.user?.id;
      const column = kind === "profile" ? "profile_image_url" : "banner_image_url";

      await pool.query(
        `UPDATE users SET ${column} = $2 WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
        [artistUserId, url]
      );

      audit(req, {
        event: "artist_image_uploaded",
        outcome: "success",
        kind,
        url
      });

      await invalidateArtistCache();
      return res.json({ success: true, url, correlationId });
    } catch (err: any) {
      audit(req, {
        event: "artist_image_uploaded",
        outcome: "error",
        message: err?.message || String(err)
      });
      return res.status(500).json({
        success: false,
        message: "Failed to upload image",
        correlationId
      });
    }
  }
);

router.get("/me", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const rows = await safeRows<any>(
      `SELECT id, email, name,
        COALESCE(is_verified, verified, false) as is_verified,
        COALESCE(status, 'ACTIVE') as status,
        COALESCE(artist_status, 'PENDING') as artist_status,
        profile_image_url,
        banner_image_url,
        bio,
        artist_bio,
        portfolio_links,
        onboarded_at,
        artist_appeal_message,
        accent_color,
        social_links,
        COALESCE(subscription_features, '[]'::jsonb) as subscription_features,
        subscription_price,
        yearly_subscription_price,
        admin_remarks
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [artistUserId],
      []
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    const u = rows[0];
    audit(req, { event: "artist_me_fetched", outcome: "success" });
    return res.json({
      success: true,
      artist: {
        id: u.id,
        email: u.email,
        name: u.name ?? null,
        isVerified: Boolean(u.is_verified),
        status: (u.status ?? "ACTIVE").toString(),
        artistStatus: (u.artist_status ?? "PENDING").toString(),
        profileImageUrl: u.profile_image_url ?? null,
        bannerImageUrl: u.banner_image_url ?? null,
        bio: u.bio ?? "",
        artistBio: u.artist_bio ?? null,
        portfolioLinks: Array.isArray(u.portfolio_links) ? u.portfolio_links : [],
        onboardedAt: u.onboarded_at ?? null,
        appealMessage: u.artist_appeal_message ?? null,
        adminNote: u.admin_remarks ?? null,
        accentColor: u.accent_color ?? null,
        socialLinks: u.social_links ?? null,
        subscriptionPrice: Number(u.subscription_price ?? 0),
        yearlySubscriptionPrice: Number(u.yearly_subscription_price ?? 0),
        subscriptionFeatures: Array.isArray(u.subscription_features) ? u.subscription_features : []
      },
      earlyAccessDays: EARLY_ACCESS_DAYS,
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_me_fetched", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch profile", correlationId });
  }
});

router.patch("/me", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const { name, bio, profileImageUrl, bannerImageUrl, accentColor, socialLinks } = req.body as {
      name?: string | null;
      bio?: string | null;
      profileImageUrl?: string | null;
      bannerImageUrl?: string | null;
      accentColor?: string | null;
      socialLinks?: Record<string, any> | null;
    };

    const socialLinksJson =
      socialLinks === undefined
        ? undefined
        : socialLinks
          ? JSON.stringify(socialLinks)
          : null;

    await pool.query(
      `UPDATE users
       SET name = COALESCE($2, name),
           bio = COALESCE($3, bio),
           profile_image_url = COALESCE($4, profile_image_url),
           banner_image_url = COALESCE($5, banner_image_url),
           accent_color = COALESCE($6, accent_color),
           social_links = COALESCE($7, social_links)
       WHERE id = $1 AND UPPER(role) = 'ARTIST'`,
      [
        artistUserId,
        name ?? null,
        bio ?? null,
        profileImageUrl ?? null,
        bannerImageUrl ?? null,
        accentColor ?? null,
        socialLinksJson as any
      ]
    );

    audit(req, {
      event: "artist_profile_updated",
      outcome: "success",
      fields: {
        name: typeof name === "string",
        bio: typeof bio === "string",
        profileImageUrl: typeof profileImageUrl === "string",
        bannerImageUrl: typeof bannerImageUrl === "string",
        accentColor: typeof accentColor === "string",
        socialLinks: socialLinks !== undefined
      }
    });

    AuditService.log({
      action: 'artist.profile_updated',
      entity: 'user',
      entityId: String(artistUserId),
      performedBy: artistUserId,
      role: 'artist',
      status: 'success',
      correlationId,
      metadata: { fields: ['name', 'bio', 'profileImageUrl', 'bannerImageUrl', 'accentColor', 'socialLinks'] }
    });

    await invalidateArtistCache();
    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_profile_updated", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to update profile", correlationId });
  }
});

router.get("/pricing", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const rows = await safeRows<any>(
      "SELECT COALESCE(subscription_price, 0) as subscription_price, COALESCE(yearly_subscription_price, 0) as yearly_subscription_price, COALESCE(subscription_features, '[]'::jsonb) as subscription_features FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST' LIMIT 1",
      [artistUserId],
      []
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    audit(req, { event: "artist_pricing_fetched", outcome: "success" });
    return res.json({
      success: true,
      subscriptionPrice: Number(rows[0].subscription_price ?? 0),
      yearlySubscriptionPrice: Number(rows[0].yearly_subscription_price ?? 0),
      subscriptionFeatures: Array.isArray(rows[0].subscription_features) ? rows[0].subscription_features : [],
      earlyAccessDays: EARLY_ACCESS_DAYS,
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_pricing_fetched", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch pricing", correlationId });
  }
});

router.patch("/pricing", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const { subscriptionPrice, yearlySubscriptionPrice, subscriptionFeatures } = req.body as { subscriptionPrice?: number | string; yearlySubscriptionPrice?: number | string; subscriptionFeatures?: string[] };
    const next = Number(subscriptionPrice);
    const nextYearly = Number(yearlySubscriptionPrice || 0);
    if (!Number.isFinite(next) || next < 0) {
      return res.status(400).json({
        success: false,
        message: "subscriptionPrice must be a non-negative number",
        correlationId
      });
    }

    const nextFeatures = Array.isArray(subscriptionFeatures) 
      ? subscriptionFeatures.map((s: string) => s.substring(0, 100)).slice(0, 8) 
      : [];

    await pool.query(
      "UPDATE users SET subscription_price = $2, yearly_subscription_price = $3, subscription_features = $4 WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [artistUserId, next, nextYearly, JSON.stringify(nextFeatures)]
    );

    await invalidateArtistCache();
    audit(req, { event: "artist_pricing_updated", outcome: "success", subscriptionPrice: next });
    return res.json({ success: true, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_pricing_updated", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to update pricing", correlationId });
  }
});

router.get("/dashboard/summary", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const subscribers = await (async () => {
      const n = await safeScalarNumber(
        "SELECT COUNT(*)::int as value FROM subscriptions WHERE artist_id = $1 AND UPPER(COALESCE(status, 'ACTIVE')) = 'ACTIVE'",
        [artistUserId],
        NaN
      );
      if (Number.isFinite(n)) return n;
      return await safeScalarNumber(
        "SELECT COALESCE(subscription_count, 0)::int as value FROM users WHERE id = $1",
        [artistUserId],
        0
      );
    })();

    const totalPlays = await (async () => {
      const n = await safeScalarNumber(
        "SELECT COUNT(*)::int as value FROM content_plays p JOIN content_items c ON c.id = p.content_id WHERE c.artist_id = $1",
        [artistUserId],
        NaN
      );
      return Number.isFinite(n) ? n : 0;
    })();

    const grossEarnings = await (async () => {
      // JOIN with subscriptions to get artist_id since payments table doesn't have artist_id column
      const rawAmountPaise = await safeScalarNumber(
        `SELECT COALESCE(SUM(p.amount), 0)::float as value 
         FROM payments p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE s.artist_id = $1 
         AND s.type = 'ARTIST'
         AND (UPPER(p.status) = 'SUCCESS' OR UPPER(p.status) = 'PAID' OR UPPER(p.status) = 'CAPTURED')`,
        [artistUserId],
        NaN
      );
      const grossPaise = Number.isFinite(rawAmountPaise) ? rawAmountPaise : 0;
      // Convert from paise to rupees and apply 90% revenue share
      const grossRupees = grossPaise / 100;
      const artistEarnings = Number((grossRupees * 0.9).toFixed(2));
      
      logger.info({ 
        artistId: artistUserId, 
        rawAmountPaise: grossPaise,
        grossRupees, 
        artistEarnings,
        calculation: `${grossPaise} paise → ${grossRupees} INR × 90% = ${artistEarnings} INR`
      }, "[ANALYTICS] Earnings calculation");
      
      return artistEarnings;
    })();

    audit(req, { event: "artist_dashboard_summary", outcome: "success" });
    logger.info({ 
      artistId: artistUserId, 
      subscribers, 
      totalPlays, 
      grossEarnings,
      correlationId 
    }, "[ANALYTICS] Dashboard summary generated");
    return res.json({
      success: true,
      stats: {
        subscribers,
        totalPlays,
        grossEarnings
      },
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_dashboard_summary", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch dashboard", correlationId });
  }
});

router.get("/dashboard/growth", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  const daysRequested = Number(req.query?.days ?? 30);
  const days = Number.isFinite(daysRequested) ? Math.max(1, Math.min(365, Math.floor(daysRequested))) : 30;

  const metricRaw = (req.query?.metric ?? "subscribers").toString().toLowerCase();
  const metric = ["subscribers", "plays", "earnings"].includes(metricRaw) ? metricRaw : "subscribers";

  try {
    const end = new Date();
    const points: { date: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i);
      points.push({ date: d.toISOString().slice(0, 10) });
    }

    const startIso = points[0].date + "T00:00:00.000Z";
    
    let rows: { date: string; value: number }[] = [];
    
    if (metric === "plays") {
      rows = await safeRows<{ date: string; value: number }>(
        `SELECT to_char(date_trunc('day', p.created_at), 'YYYY-MM-DD') as date, COUNT(p.id)::int as value 
         FROM content_plays p 
         JOIN content_items c ON c.id = p.content_id 
         WHERE c.artist_id = $1 AND p.created_at >= $2 
         GROUP BY 1 ORDER BY 1 ASC`,
        [artistUserId, startIso],
        []
      );
    } else if (metric === "earnings") {
      // JOIN with subscriptions to get artist_id since payments table doesn't have artist_id column
      const dbRows = await safeRows<{ date: string; value: number }>(
        `SELECT to_char(date_trunc('day', p.created_at), 'YYYY-MM-DD') as date, COALESCE(SUM(p.amount), 0)::float as value 
         FROM payments p
         JOIN subscriptions s ON s.id = p.subscription_id
         WHERE s.artist_id = $1 AND s.type = 'ARTIST' AND p.created_at >= $2 
         AND (UPPER(p.status) = 'SUCCESS' OR UPPER(p.status) = 'PAID' OR UPPER(p.status) = 'CAPTURED') 
         GROUP BY 1 ORDER BY 1 ASC`,
        [artistUserId, startIso],
        []
      );
      // Convert from paise to rupees and apply 90% revenue share
      rows = dbRows.map(r => ({ date: r.date, value: Number(((r.value / 100) * 0.9).toFixed(2)) }));
    } else {
      rows = await safeRows<{ date: string; value: number }>(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as date, COUNT(*)::int as value 
         FROM subscriptions 
         WHERE artist_id = $1 AND created_at >= $2 
         GROUP BY 1 ORDER BY 1 ASC`,
        [artistUserId, startIso],
        []
      );
    }

    const map = new Map<string, number>();
    for (const r of rows) map.set(r.date, Number(r.value) || 0);

    const data = points.map((p) => ({ date: p.date, value: map.get(p.date) ?? 0 }));
    
    const summaryTotal = data.reduce((sum, p) => sum + p.value, 0);
    const totalCurrent = metric === "earnings" ? Number(summaryTotal.toFixed(2)) : summaryTotal;

    audit(req, { event: "artist_growth", outcome: "success", days, metric });
    return res.json({ success: true, metric, days, total: totalCurrent, data, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_growth", outcome: "error", metric, message: err?.message || String(err) });
    return res.json({ success: true, metric, data: [], correlationId });
  }
});

router.get("/dashboard/recent-activity", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const rows = await safeRows<any>(
      `SELECT s.id, s.created_at,
        COALESCE(u.name, u.email) as fan_name,
        u.profile_image_url
       FROM subscriptions s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.artist_id = $1
       ORDER BY s.created_at DESC
       LIMIT 10`,
      [artistUserId],
      []
    );

    const items = rows.map((r: any) => ({
      id: r.id,
      fanName: r.fan_name ?? "",
      fanAvatarUrl: r.profile_image_url ?? null,
      createdAt: r.created_at
    }));

    audit(req, { event: "artist_recent_activity", outcome: "success" });
    return res.json({ success: true, items, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_recent_activity", outcome: "error", message: err?.message || String(err) });
    return res.json({ success: true, items: [], correlationId });
  }
});

router.get("/dashboard/new-plays", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const rows = await safeRows<any>(
      `SELECT c.id, c.title, c.thumbnail_url, COUNT(p.id)::int as plays
       FROM content_items c
       LEFT JOIN content_plays p ON p.content_id = c.id
       WHERE c.artist_id = $1
       GROUP BY c.id
       ORDER BY plays DESC, c.created_at DESC
       LIMIT 5`,
      [artistUserId],
      []
    );

    const items = rows.map((r: any) => ({
      contentId: r.id,
      title: r.title,
      artwork: r.thumbnail_url ?? null,
      plays: Number(r.plays ?? 0)
    }));

    audit(req, { event: "artist_new_plays", outcome: "success" });
    return res.json({ success: true, items, correlationId });
  } catch (err: any) {
    audit(req, { event: "artist_new_plays", outcome: "error", message: err?.message || String(err) });
    return res.json({ success: true, items: [], correlationId });
  }
});

router.get(
  "/analytics/content-performance",
  requireAuth,
  requireArtist,
  async (req: any, res: any) => {
    const correlationId = req?.correlationId || "-";
    const artistUserId = req.user?.id;

    const daysRequested = Number(req.query?.days ?? 30);
    const days = Number.isFinite(daysRequested) ? Math.max(1, Math.min(365, Math.floor(daysRequested))) : 30;

    try {

      const start = new Date();
      start.setUTCDate(start.getUTCDate() - days);

      const rows = await safeRows<any>(
        `SELECT c.id, c.title, c.thumbnail_url, COUNT(p.id)::int as plays
         FROM content_items c
         LEFT JOIN content_plays p ON p.content_id = c.id AND p.created_at >= $2
         WHERE c.artist_id = $1
         GROUP BY c.id
         ORDER BY plays DESC, c.created_at DESC
         LIMIT 7`,
        [artistUserId, start.toISOString()],
        []
      );

      const items = rows.map((r: any) => ({
        contentId: r.id,
        title: r.title,
        thumbnailUrl: r.thumbnail_url ?? null,
        plays: Number(r.plays ?? 0)
      }));

      audit(req, { event: "artist_content_performance", outcome: "success", days });
      return res.json({ success: true, days, items, correlationId });
    } catch (err: any) {
      audit(req, { event: "artist_content_performance", outcome: "error", message: err?.message || String(err) });
      return res.status(500).json({ success: false, message: "Failed to fetch content performance", correlationId });
    }
  }
);

router.get("/analytics/summary", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - 30);

    const gross = await safeScalarNumber(
      "SELECT COALESCE(SUM(amount), 0)::float as value FROM payments WHERE artist_id = $1 AND created_at >= $2 AND (UPPER(status) = 'SUCCESS' OR UPPER(status) = 'PAID')",
      [artistUserId, start.toISOString()],
      0
    );

    audit(req, { event: "artist_analytics_summary", outcome: "success" });
    return res.json({
      success: true,
      last30Days: {
        grossEarnings: Number((Number(gross || 0) * 0.9).toFixed(2))
      },
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_analytics_summary", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch analytics summary", correlationId });
  }
});

router.get("/channel-preview", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";
  const artistUserId = req.user?.id;

  try {

    const artistRows = await safeRows<any>(
      `SELECT id, email, name,
        profile_image_url,
        banner_image_url,
        COALESCE(bio, '') as bio
       FROM users
       WHERE id = $1 AND UPPER(role) = 'ARTIST'
       LIMIT 1`,
      [artistUserId],
      []
    );

    if (!artistRows.length) {
      return res.status(404).json({ success: false, message: "Artist not found", correlationId });
    }

    const now = new Date();

    const contentRows = await safeRows<any>(
      `SELECT id, title, type, thumbnail_url, created_at,
        published_at,
        COALESCE(subscription_required, false) as subscription_required,
        COALESCE(is_approved, false) as is_approved,
        COALESCE(lifecycle_state, 'DRAFT') as lifecycle_state
       FROM content_items
       WHERE artist_id = $1
         AND COALESCE(is_approved, false) = true
       ORDER BY COALESCE(published_at, created_at) DESC, created_at DESC
       LIMIT 200`,
      [artistUserId],
      []
    );

    const items = contentRows.map((r: any) => {
      const publishedAt = r.published_at ? new Date(r.published_at) : null;
      const subscriptionRequired = Boolean(r.subscription_required);
      const isEarlyAccess = Boolean(subscriptionRequired && publishedAt && publishedAt.getTime() > now.getTime());

      return {
        id: r.id,
        title: r.title,
        type: (r.type ?? "").toString(),
        thumbnailUrl: r.thumbnail_url ?? null,
        subscriptionRequired,
        publishedAt: r.published_at ?? null,
        isEarlyAccess
      };
    });

    const a = artistRows[0];
    audit(req, { event: "artist_channel_preview", outcome: "success", items: items.length });
    return res.json({
      success: true,
      artist: {
        id: a.id,
        name: a.name ?? null,
        email: a.email,
        profileImageUrl: a.profile_image_url ?? null,
        bannerImageUrl: a.banner_image_url ?? null,
        bio: a.bio ?? ""
      },
      items,
      correlationId
    });
  } catch (err: any) {
    audit(req, { event: "artist_channel_preview", outcome: "error", message: err?.message || String(err) });
    return res.status(500).json({ success: false, message: "Failed to fetch channel preview", correlationId });
  }
});

router.patch("/update-password", requireAuth, requireArtist, async (req: any, res: any) => {
  const correlationId = req?.correlationId || "-";

  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "currentPassword and newPassword are required",
        correlationId
      });
    }

    const userId = req.user?.id;

    const result = await pool.query(
      "SELECT id, password FROM users WHERE id = $1 AND UPPER(role) = 'ARTIST'",
      [userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Artist not found",
        correlationId
      });
    }

    const user = result.rows[0] as any;
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
        correlationId
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = $2 WHERE id = $1", [user.id, hashedPassword]);

    audit(req, { event: "artist_password_updated", outcome: "success" });

    return res.json({
      success: true,
      message: "Password updated successfully",
      correlationId
    });
  } catch (err: any) {
    audit(req, {
      event: "artist_password_updated",
      outcome: "error",
      message: err?.message || String(err)
    });

    return res.status(500).json({
      success: false,
      message: "Failed to update password",
      correlationId
    });
  }
});

export default router;

