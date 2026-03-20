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
        "SELECT id, role, COALESCE(status, 'ACTIVE') as status, COALESCE(is_deleted, false) as is_deleted FROM users WHERE id = $1",
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
