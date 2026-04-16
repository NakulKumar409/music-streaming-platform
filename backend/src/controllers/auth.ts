import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../common/db";
import { AuditService } from "../shared/audit/audit.service";

const isValidDob = (dob: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const d = new Date(`${dob}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return false;

  const [yyyy, mm, dd] = dob.split("-").map((n) => Number(n));
  if (!yyyy || !mm || !dd) return false;

  const normalized = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;

  return normalized === dob;
};

const isValidPhoneNumber = (phoneNumber: string) => {
  const trimmed = phoneNumber.trim();
  // E.164-ish: optional leading +, 7-15 digits
  return /^\+?[0-9]{7,15}$/.test(trimmed);
};

export const registerFan = async (req: Request, res: Response) => {
  const correlationId = (req as any)?.correlationId || "-";

  // Log raw request body for debugging
  console.error("[REGISTER_FAN] Request received", {
    correlationId,
    body: req.body,
    keys: Object.keys(req.body || {})
  });

  try {
    const {
      fullName,
      email,
      phoneNumber,
      username,
      password,
      dob,
      dateOfBirth,
      favoriteGenre,
      location,
      locationCity
    } = req.body as {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      username?: string;
      password?: string;
      dob?: string;
      dateOfBirth?: string;
      favoriteGenre?: string;
      location?: string;
      locationCity?: string;
    };

    // Support both dob and dateOfBirth from different clients
    const effectiveDob = dob || dateOfBirth;
    // Support both location and locationCity from different clients
    const effectiveLocation = location || locationCity;

    if (!fullName || !email || !phoneNumber || !username || !password || !effectiveDob) {
      console.error("[REGISTER_FAN] Validation failed - missing required fields", {
        correlationId,
        hasFullName: !!fullName,
        hasEmail: !!email,
        hasPhoneNumber: !!phoneNumber,
        hasUsername: !!username,
        hasPassword: !!password,
        hasDob: !!effectiveDob,
        dobValue: effectiveDob
      });
      return res.status(400).json({
        success: false,
        message:
          "fullName, email, phoneNumber, username, password, and dob are required",
        correlationId
      });
    }

    if (!isValidDob(effectiveDob)) {
      console.error("[REGISTER_FAN] Validation failed - invalid DOB format", {
        correlationId,
        dobValue: effectiveDob
      });
      return res.status(400).json({
        success: false,
        message: "dob must be in YYYY-MM-DD format",
        correlationId
      });
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      console.error("[REGISTER_FAN] Validation failed - invalid phone number", {
        correlationId,
        phoneNumber
      });
      return res.status(400).json({
        success: false,
        message:
          "phoneNumber must be a valid phone number (7-15 digits, optional leading +)",
        correlationId
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    const emailExists = await pool.query("SELECT id FROM public.users WHERE email = $1", [
      normalizedEmail
    ]);
    if (emailExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already exists",
        correlationId
      });
    }

    const usernameExists = await pool.query(
      "SELECT id FROM public.users WHERE username = $1",
      [normalizedUsername]
    );
    if (usernameExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Username already exists",
        correlationId
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO public.users (
        full_name,
        email,
        phone_number,
        username,
        password,
        dob,
        favorite_genre,
        location,
        role
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING id, email, username, role
    `;

    const result = await pool.query(insertQuery, [
      fullName.trim(),
      normalizedEmail,
      phoneNumber.trim(),
      normalizedUsername,
      hashedPassword,
      effectiveDob,
      favoriteGenre ? String(favoriteGenre).trim() : null,
      effectiveLocation ? String(effectiveLocation).trim() : null,
      "FAN"
    ]);

    const user = result.rows?.[0];

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: (user.role ?? "FAN").toString().toUpperCase()
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "1d" }
    );

    AuditService.log({
      action: 'user.register',
      entity: 'user',
      entityId: String(user.id),
      performedBy: user.id,
      role: 'fan',
      status: 'success',
      correlationId,
      metadata: { username: user.username, email: user.email }
    });

    return res.status(201).json({
      success: true,
      message: "Fan registered successfully",
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: (user.role ?? "FAN").toString().toUpperCase()
      },
      correlationId
    });
  } catch (err: any) {
    console.error("[REGISTER_FAN] CRITICAL ERROR", {
      correlationId,
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      error: String(err)
    });

    AuditService.log({
      action: 'system.error',
      entity: 'system',
      entityId: 'register_fan',
      role: 'system',
      status: 'failed',
      correlationId,
      metadata: { error: err?.message || "Unknown error", stack: err?.stack }
    });

    return res.status(500).json({
      success: false,
      message: "Registration failed: " + (err?.message || "Unknown error"),
      correlationId
    });
  }
};
