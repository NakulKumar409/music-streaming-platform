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

// ============================================
// PROFESSIONAL VALIDATION FUNCTIONS
// ============================================

const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

const isValidPassword = (password: string): boolean => {
  return password && password.length >= 6;
};

const isValidUsername = (username: string): boolean => {
  return username && username.trim().length >= 3;
};

export const registerFan = async (req: Request, res: Response) => {
  const correlationId = (req as any)?.correlationId || "-";

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

    const effectiveDob = dob || dateOfBirth;
    const effectiveLocation = location || locationCity;

    // ============================================
    // 1. REQUIRED FIELD VALIDATION
    // ============================================

    if (!fullName || !email || !phoneNumber || !username || !password || !effectiveDob) {
      const errors: any = {};
      if (!fullName) errors.fullName = "Full name is required";
      if (!email) errors.email = "Email is required";
      if (!phoneNumber) errors.phoneNumber = "Phone number is required";
      if (!username) errors.username = "Username is required";
      if (!password) errors.password = "Password is required";
      if (!effectiveDob) errors.dob = "Date of birth is required";

      return res.status(400).json({
        success: false,
        message: "All fields are required",
        errors,
        correlationId
      });
    }

    // ============================================
    // 2. FORMAT VALIDATION
    // ============================================

    // Email format validation
    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
        errors: { email: "Invalid email address" },
        correlationId
      });
    }

    // Phone number validation
    if (!isValidPhoneNumber(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be 7-15 digits",
        errors: { phoneNumber: "Phone number must be 7-15 digits" },
        correlationId
      });
    }

    // DOB validation
    if (!isValidDob(effectiveDob)) {
      return res.status(400).json({
        success: false,
        message: "Date of birth must be in YYYY-MM-DD format",
        errors: { dob: "Date of birth must be in YYYY-MM-DD format" },
        correlationId
      });
    }

    // ============================================
    // 3. LENGTH VALIDATION
    // ============================================

    // Password length validation
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
        errors: { password: "Password must be at least 6 characters" },
        correlationId
      });
    }

    if (password.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Password cannot exceed 50 characters",
        errors: { password: "Password cannot exceed 50 characters" },
        correlationId
      });
    }

    // Username length validation
    if (!isValidUsername(username)) {
      return res.status(400).json({
        success: false,
        message: "Username must be at least 3 characters",
        errors: { username: "Username must be at least 3 characters" },
        correlationId
      });
    }

    if (username.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Username cannot exceed 20 characters",
        errors: { username: "Username cannot exceed 20 characters" },
        correlationId
      });
    }

    // Username characters validation
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: "Username can only contain letters, numbers, and underscore",
        errors: { username: "Username can only contain letters, numbers, and underscore" },
        correlationId
      });
    }

    // Full name length validation
    if (fullName.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Full name must be at least 2 characters",
        errors: { fullName: "Full name must be at least 2 characters" },
        correlationId
      });
    }

    // ============================================
    // 4. UNIQUE VALIDATION
    // ============================================

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    const emailExists = await pool.query("SELECT id FROM public.users WHERE email = $1", [
      normalizedEmail
    ]);
    if (emailExists.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
        errors: { email: "Email already registered" },
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
        message: "Username already taken",
        errors: { username: "Username already taken" },
        correlationId
      });
    }

    // ============================================
    // 5. CREATE USER
    // ============================================

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

    // ============================================
    // 6. GENERATE TOKEN
    // ============================================

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

    // ============================================
    // 7. SUCCESS RESPONSE
    // ============================================

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
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
      message: "Registration failed. Try again.",
      correlationId
    });
  }
};