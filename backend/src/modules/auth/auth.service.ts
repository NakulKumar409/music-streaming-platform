import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../common/db";

export class AuthService {
  async register(email: string, password: string, name?: string) {
    try {
      const normalizedEmail = String(email || "")
        .trim()
        .toLowerCase();

      const existingUserQuery = "SELECT id FROM public.users WHERE email = $1";
      const existingUser = await pool.query(existingUserQuery, [normalizedEmail]);

      if (existingUser.rows.length > 0) {
        return { success: false, message: "Email already exists" };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const normalizedName = name ? String(name).trim() : null;

      const insertUserQuery = "INSERT INTO public.users (email, password, name) VALUES ($1, $2, $3) RETURNING id";
      await pool.query(insertUserQuery, [normalizedEmail, hashedPassword, normalizedName]);

      return { success: true, message: "User registered successfully" };
    } catch (error) {
      return { success: false, message: "Registration failed" };
    }
  }

  async login(email: string, password: string) {
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    let userResult;
    try {
      const userQuery =
        "SELECT id, email, password, status, role, COALESCE(is_verified, verified, false) as is_verified, COALESCE(is_deleted, false) as is_deleted FROM public.users WHERE email = $1";
      userResult = await pool.query(userQuery, [normalizedEmail]);
    } catch (err: any) {
      if (err?.code === "42703") {
        const userQuery = "SELECT id, email, password, role FROM public.users WHERE email = $1";
        userResult = await pool.query(userQuery, [normalizedEmail]);
      } else {
        throw err;
      }
    }

    if (userResult.rows.length === 0) {
      const e: any = new Error("Invalid credentials");
      e.status = 401;
      throw e;
    }

    const user = userResult.rows[0] as any;
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      const e: any = new Error("Invalid credentials");
      e.status = 401;
      throw e;
    }

    const role = (user.role ?? "USER").toString().toUpperCase();
    const status = (user.status ?? "ACTIVE").toString().toUpperCase();
    const isVerified = Boolean((user as any).is_verified);
    const isDeleted = Boolean((user as any).is_deleted);
    const pendingApproval = role === "ARTIST" && !isVerified;

    if (role === "ARTIST" && isDeleted) {
      const e: any = new Error("Artist account is inactive");
      e.status = 403;
      throw e;
    }

    if (role === "ARTIST" && status === "SUSPENDED") {
      const e: any = new Error("Artist account is suspended");
      e.status = 403;
      throw e;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    return {
      success: true,
      token,
      pendingApproval,
      user: {
        id: user.id,
        email: user.email,
        role,
        isVerified,
        status
      }
    };
  }

  async checkAndRegisterSession(userId: number, deviceId: string, deviceName?: string) {
    try {
      // 1. Check existing sessions for this user
      const sessions = await pool.query(
        "SELECT id, device_id FROM user_sessions WHERE user_id = $1 ORDER BY last_active_at DESC",
        [userId]
      );

      const existingSession = sessions.rows.find(s => s.device_id === deviceId);

      if (existingSession) {
        // Update last_active_at
        await pool.query(
          "UPDATE user_sessions SET last_active_at = now(), device_name = $1 WHERE id = $2",
          [deviceName || "Unknown Device", existingSession.id]
        );
        return { success: true };
      }

      // 2. Enforce limit (max 2)
      if (sessions.rows.length >= 2) {
        return { 
          success: false, 
          message: "DEVICE_LIMIT_REACHED",
          activeDevices: sessions.rows.map(s => s.device_id)
        };
      }

      // 3. Register new session
      await pool.query(
        "INSERT INTO user_sessions (user_id, device_id, device_name) VALUES ($1, $2, $3)",
        [userId, deviceId, deviceName || "Unknown Device"]
      );

      return { success: true };
    } catch (error) {
      console.error("[AUTH] Session registration failed", error);
      return { success: false, message: "Session registration failed" };
    }
  }

  async removeSession(userId: number, deviceId: string) {
    try {
      await pool.query(
        "DELETE FROM user_sessions WHERE user_id = $1 AND device_id = $2",
        [userId, deviceId]
      );
      return { success: true };
    } catch (error) {
      return { success: false, message: "Failed to remove session" };
    }
  }
}