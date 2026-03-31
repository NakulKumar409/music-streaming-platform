import { Request, Response } from 'express';
import { pool } from '../../common/db';

export const handleMediaWebhook = async (req: Request | any, res: Response) => {
  const correlationId = req?.correlationId || "-";
  try {
    const body = req.body;
    
    // Cloudinary sends `notification_type` to describe the event. 
    // For our streaming profile, we look for `eager_ready` or `upload` if eager transform happened inline.
    // `eager_ready` is dispatched when HLS generation completes for Video.
    // `upload` is dispatched for instantaneous uploads like Audio where no async eager profile is running.
    if (
      body.notification_type === 'eager_ready' || 
      (body.notification_type === 'upload' && body.format !== 'mp4' && body.format !== 'mov') 
    ) {
      const providerAssetId = body.public_id || body.asset_id;
      const status = body.status || body.eager_status; // Cloudinary might emit eager_status depending on format

      if (!providerAssetId) {
        return res.status(400).json({ success: false, message: 'public_id missing from payload' });
      }

      // If it's a notification from upload and status isn't explicitly defined, it typically means it synchronously succeeded
      const technicalStatus = (status === 'success' || status === 'completed' || !status) ? 'READY' : 'FAILED';
      
      const updateQuery = `
        UPDATE content_items 
        SET technical_status = $1 
        WHERE provider_asset_id = $2 AND technical_status != 'READY'
        RETURNING id
      `;

      const dbResult = await pool.query(updateQuery, [technicalStatus, providerAssetId]);
      
      if (dbResult.rows.length > 0) {
        console.log(`[WebhookController] Media ${providerAssetId} status updated to ${technicalStatus}`);
      }
    }
    
    // Always respond 200 OK so Cloudinary knows we got it, even if ignored
    return res.status(200).json({ received: true });

  } catch (error: any) {
    console.error("[WebhookController] Webhook Error", correlationId, error);
    // Returning 200 even on some internal failures to prevent webhook retries crashing the route.
    return res.status(200).send("Processed with errors");
  }
};
