import { Request, Response } from "express";
import { poolRead } from "../../common/db";

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { 
      page = "1", 
      limit = "50", 
      action, 
      entity, 
      role, 
      status, 
      search 
    } = req.query;
    
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    const limitNum = parseInt(limit as string);

    // Build dynamic query
    let baseQuery = `FROM audit_logs WHERE 1=1`;
    const values: any[] = [];
    let paramIndex = 1;

    if (action) {
      baseQuery += ` AND action = $${paramIndex++}`;
      values.push(action);
    }
    
    if (entity) {
      baseQuery += ` AND entity = $${paramIndex++}`;
      values.push(entity);
    }
    
    if (role) {
      baseQuery += ` AND actor_role = $${paramIndex++}`;
      values.push(role);
    }

    if (status) {
      baseQuery += ` AND status = $${paramIndex++}`;
      values.push(status);
    }

    if (search) {
      baseQuery += ` AND (correlation_id = $${paramIndex} OR entity_id = $${paramIndex} OR action ILIKE $${paramIndex + 1})`;
      values.push(search);
      values.push(`%${search}%`);
      paramIndex += 2;
    }

    const dataQuery = `SELECT * ${baseQuery} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    
    const result = await poolRead.query(dataQuery, [...values, limitNum, offset]);
    const totalResult = await poolRead.query(countQuery, values);

    res.status(200).json({
      success: true,
      data: result.rows,
      meta: {
        total: parseInt(totalResult.rows[0].count),
        page: parseInt(page as string),
        limit: limitNum
      }
    });
  } catch (error) {
    console.error("[AuditController] Error fetching audit logs:", error);
    res.status(500).json({ success: false, message: "Failed to fetch logs" });
  }
};
