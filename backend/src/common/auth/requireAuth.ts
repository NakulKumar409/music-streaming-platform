import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db";

export const requireAuth = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "Token missing"
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    const userId = decoded?.id ?? decoded?.userId;
    console.log(`[Auth Debug] ID: ${userId}, Role: ${decoded?.role}, Secret Prefix: ${process.env.JWT_SECRET?.substring(0, 10)}`);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload"
      });
    }

    const tokenRole = (decoded?.role ?? "").toString().toUpperCase();

    // For admins we trust the token and skip DB lookups.
    if (tokenRole === "ADMIN") {
      req.user = {
        ...decoded,
        id: userId,
        role: "ADMIN",
        status: "ACTIVE"
      };
      return next();
    }

    let dbUser: any = null;
    try {
      const result = await pool.query(
        "SELECT id, role, COALESCE(status, 'ACTIVE') as status, COALESCE(is_deleted, false) as is_deleted FROM public.users WHERE id = $1",
        [userId]
      );
      dbUser = result.rows?.[0] ?? null;
    } catch {
      dbUser = null;
    }

    if (!dbUser) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    const role = (dbUser.role ?? tokenRole ?? "").toString().toUpperCase();
    const status = (dbUser.status ?? decoded.status ?? "ACTIVE").toString().toUpperCase();

    const isDeleted = Boolean((dbUser as any)?.is_deleted);
    if (role === "ARTIST" && isDeleted) {
      return res.status(403).json({
        success: false,
        message: "Artist account is inactive"
      });
    }

    if (role === "ARTIST" && status === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message: "Artist account is suspended"
      });
    }

    req.user = {
      ...decoded,
      id: dbUser.id,
      role,
      status,
      isDeleted
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token"
    });
  }
};

/**
 * Optional authentication middleware.
 * If a valid token is provided, populates req.user.
 * If token is missing or invalid, proceeds without req.user.
 */
export const optionalAuth = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return next();

    const token = authHeader.split(" ")[1];
    if (!token) return next();

    const decoded: any = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    );

    const userId = decoded?.id ?? decoded?.userId;
    if (!userId) return next();

    // Attach user but don't perform heavy DB checks to keep it fast
    req.user = {
      ...decoded,
      id: userId,
      role: (decoded.role || "FAN").toString().toUpperCase()
    };

    next();
  } catch (error) {
    // On JWT error, just treat as guest
    next();
  }
};
