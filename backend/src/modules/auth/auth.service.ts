import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../../common/db";

export class AuthService {
  async register(email: string, password: string) {
    try {
      const normalizedEmail = String(email || "")
        .trim()
        .toLowerCase();

      const existingUserQuery = "SELECT id FROM users WHERE email = $1";
      const existingUser = await pool.query(existingUserQuery, [normalizedEmail]);

      if (existingUser.rows.length > 0) {
        return { success: false, message: "Email already exists" };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const insertUserQuery = "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id";
      await pool.query(insertUserQuery, [normalizedEmail, hashedPassword]);

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
        "SELECT id, email, password, status, role, COALESCE(is_verified, verified, false) as is_verified FROM users WHERE email = $1";
      userResult = await pool.query(userQuery, [normalizedEmail]);
    } catch (err: any) {
      if (err?.code === "42703") {
        const userQuery = "SELECT id, email, password, role FROM users WHERE email = $1";
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
    const pendingApproval = role === "ARTIST" && !isVerified;

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
}