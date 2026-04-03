import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { pool } from "../../common/db";

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, fullName } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password required"
        });
      }

      const result = await authService.register(email, password, name || fullName);

      if (result.success) {
        return res.status(201).json(result);
      }

      return res.status(400).json(result);
    } catch {
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      const result = await authService.login(email, password);

      const correlationId = (req as any)?.correlationId || "-";
      const role = (result as any)?.user?.role ?? null;
      const userId = (result as any)?.user?.id ?? null;
      const pendingApproval = Boolean((result as any)?.pendingApproval);

      console.log(
        `[AUDIT] ${JSON.stringify({
          event: "user_login",
          correlationId,
          email,
          userId,
          role: role ? role.toString().toUpperCase() : null,
          pendingApproval
        })}`
      );

      return res.json(result);
    } catch (err: any) {
      const correlationId = (req as any)?.correlationId || "-";
      console.log(
        `[AUDIT] ${JSON.stringify({
          event: "user_login",
          outcome: "failed",
          correlationId,
          email: (req as any)?.body?.email ?? null,
          message: err?.message || "Invalid credentials"
        })}`
      );

      return res.status(err?.status || 401).json({
        success: false,
        message: err?.message || "Invalid credentials"
      });
    }
  }

  async session(req: any, res: Response) {
    try {
      const tokenUser = req.user;

      let dbUser: any = null;
      try {
        try {
            const userQuery =
              "SELECT id, name, email, status, role, COALESCE(is_verified, verified, false) as is_verified FROM public.users WHERE id = $1";
            const userResult = await pool.query(userQuery, [tokenUser?.id]);
          dbUser = userResult.rows?.[0] || null;
        } catch (err2: any) {
          if (err2?.code !== "42703") throw err2;
          try {
              const userQuery =
                "SELECT id, name, email, status, role, COALESCE(verified, false) as is_verified FROM public.users WHERE id = $1";
              const userResult = await pool.query(userQuery, [tokenUser?.id]);
            dbUser = userResult.rows?.[0] || null;
          } catch (err3: any) {
            if (err3?.code !== "42703") throw err3;
              const userQuery = "SELECT id, name, email, status, role FROM public.users WHERE id = $1";
              const userResult = await pool.query(userQuery, [tokenUser?.id]);
            dbUser = userResult.rows?.[0] || null;
          }
        }
      } catch (err: any) {
        if (err?.code === "42703") {
            const userQuery = "SELECT id, name, email, role FROM public.users WHERE id = $1";
            const userResult = await pool.query(userQuery, [tokenUser?.id]);
          dbUser = userResult.rows?.[0] || null;
        } else {
          throw err;
        }
      }

      return res.json({
        success: true,
        user: {
          ...(tokenUser || {}),
          ...(dbUser || {}),
          name: dbUser?.name ?? (tokenUser as any)?.name ?? null,
          role: (dbUser?.role ?? (tokenUser as any)?.role ?? null) || null,
          isVerified: Boolean(dbUser?.is_verified ?? (tokenUser as any)?.isVerified ?? false),
          status: dbUser?.status ?? (tokenUser as any)?.status ?? "ACTIVE"
        }
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Session error"
      });
    }
  }
}
