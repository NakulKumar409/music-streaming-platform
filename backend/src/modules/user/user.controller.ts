import { Response } from "express";
import { pool } from "../../common/db";
import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

export class UserController {
  async profile(req: any, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized"
        });
      }

      let userRow: any;
      try {
        const q =
          "SELECT id, name, full_name, email, profile_image_url, subscription_count, total_listen_time, audio_quality_pref, notifications_pref, status FROM users WHERE id = $1";
        const r = await pool.query(q, [userId]);
        userRow = r.rows?.[0];
      } catch (err: any) {
        if (err?.code === "42703") {
          const q = "SELECT id, name, full_name, email, status FROM users WHERE id = $1";
          const r = await pool.query(q, [userId]);
          userRow = r.rows?.[0];
        } else {
          throw err;
        }
      }

      if (!userRow) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      let subscriptionCount = 0;
      try {
        const subs = await pool.query(
          `SELECT COUNT(*)::int as c
           FROM subscriptions
           WHERE user_id = $1
             AND UPPER(COALESCE(status, '')) = 'ACTIVE'
             AND (end_date IS NULL OR end_date > now())`,
          [userId]
        );
        subscriptionCount = Number(subs.rows?.[0]?.c ?? 0);
      } catch {
        subscriptionCount = Number(userRow.subscription_count ?? 0);
      }

      return res.json({
        success: true,
        profile: {
          id: userRow.id,
          name: userRow.name ?? null,
          fullName: userRow.full_name ?? null,
          email: userRow.email,
          profileImageUrl: userRow.profile_image_url ?? null,
          audioQualityPref: userRow.audio_quality_pref ?? "HIGH",
          notificationsPref: userRow.notifications_pref ?? true,
          totalListenTimeSeconds: Number(userRow.total_listen_time ?? 0)
        },
        premium: {
          isPremium: subscriptionCount > 0,
          subscriptionCount
        }
      });
    } catch {
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }

  async transactions(req: any, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized"
        });
      }

      try {
        const rows = await pool.query(
          `SELECT id, amount, artist_name, status, date
           FROM transactions
           WHERE user_id = $1
           ORDER BY date DESC
           LIMIT 50`,
          [userId]
        );

        const transactions = (rows.rows ?? []).map((r: any) => ({
          id: String(r.id),
          amount: Number(r.amount ?? 0),
          artistName: (r.artist_name ?? '').toString(),
          date: r.date,
          status: (r.status ?? '').toString(),
        }));

        return res.json({ success: true, transactions });
      } catch {
        return res.json({ success: true, transactions: [] });
      }
    } catch {
      return res.status(500).json({
        success: false,
        message: "Server error"
      });
    }
  }

  async update(req: any, res: Response) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      const { fullName, username, bio, favoriteGenre, location } = req.body;

      // Uniqueness check for username
      if (username) {
        const usernameCheck = await pool.query(
          "SELECT id FROM users WHERE username = $1 AND id != $2",
          [username, userId]
        );
        if (usernameCheck.rows.length > 0) {
          return res.status(400).json({ success: false, message: "Username is already taken" });
        }
      }

      const updateQuery = `
        UPDATE users 
        SET 
          full_name = COALESCE($1, full_name),
          name = COALESCE($1, name),
          username = COALESCE($2, username),
          bio = COALESCE($3, bio),
          favorite_genre = COALESCE($4, favorite_genre),
          location = COALESCE($5, location)
        WHERE id = $6
        RETURNING id, name, full_name as fullName, username, bio, favorite_genre as favoriteGenre, location, profile_image_url as profileImageUrl
      `;

      const result = await pool.query(updateQuery, [
        fullName || null,
        username || null,
        bio || null,
        favoriteGenre || null,
        location || null,
        userId
      ]);

      return res.json({
        success: true,
        message: "Profile updated successfully",
        profile: result.rows[0]
      });
    } catch (error: any) {
      console.error("[UserController.update] error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async updatePassword(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { oldPassword, newPassword } = req.body;
      if (!oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: "Both old and new passwords are required" });
      }

      const userRes = await pool.query("SELECT password FROM users WHERE id = $1", [userId]);
      if (userRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      const user = userRes.rows[0];
      const bcrypt = require("bcrypt");
      
      const isValid = await bcrypt.compare(oldPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ success: false, message: "Incorrect old password" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashed, userId]);

      return res.json({ success: true, message: "Password updated successfully" });
    } catch (error: any) {
      console.error("[UserController.updatePassword] error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async updateProfileImage(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const file = req.file;
      if (!file) return res.status(400).json({ success: false, message: "No image file provided" });

      // Note: In a production cluster we should use the same provider strategy, 
      // but for direct easy integration we import Cloudinary directly here.
      const cloudinary = require("cloudinary").v2;
      
      // Convert buffer to base64
      const b64 = Buffer.from(file.buffer).toString("base64");
      const dataURI = "data:" + file.mimetype + ";base64," + b64;
      
      const uploadOptions = {
        folder: `users/${userId}/profile`,
        use_filename: true,
        unique_filename: true,
      };

      const cRes = await cloudinary.uploader.upload(dataURI, uploadOptions);
      const secureUrl = cRes.secure_url;

      await pool.query("UPDATE users SET profile_image_url = $1 WHERE id = $2", [secureUrl, userId]);

      return res.json({ 
        success: true, 
        message: "Profile image updated", 
        profileImageUrl: secureUrl 
      });
    } catch (error: any) {
      console.error("[UserController.updateProfileImage] error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
  async updateSettings(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const { pushNotifications, expoPushToken } = req.body;

      await pool.query(
        `UPDATE users SET 
          notifications_pref = COALESCE($1, notifications_pref),
          expo_push_token = COALESCE($2, expo_push_token)
         WHERE id = $3`,
        [
          pushNotifications !== undefined ? pushNotifications : null,
          expoPushToken || null,
          userId
        ]
      );

      return res.json({ success: true, message: "Settings updated" });
    } catch (error: any) {
      console.error("[UserController.updateSettings] error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  async testPush(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const userRes = await pool.query(
        "SELECT expo_push_token, notifications_pref FROM users WHERE id = $1",
        [userId]
      );

      const user = userRes.rows[0];
      const token = user?.expo_push_token;

      if (!token) {
        return res.status(400).json({ 
          success: false, 
          message: "No push token found. Please enable push notifications in the app first." 
        });
      }

      if (!user.notifications_pref) {
        return res.status(400).json({
          success: false,
          message: "Push notifications are disabled for this user."
        });
      }

      // Only bypass validation if it's a SIM_MOCK for testing
      if (!token.startsWith("ExponentPushToken[SIM_MOCK_") && !Expo.isExpoPushToken(token)) {
        return res.status(400).json({ success: false, message: "Invalid Expo push token" });
      }

      if (token.startsWith("ExponentPushToken[SIM_MOCK_")) {
        console.log(`[Push] Bypassing real send for Mock Token: ${token}`);
        return res.json({ 
          success: true, 
          message: "Test push notification 'sent' (bypassed because it's a simulator mock)!",
          mockToken: token 
        });
      }

      const messages: ExpoPushMessage[] = [{
        to: token,
        sound: "default",
        title: "🎵 Music Streaming Platform",
        body: "Hey! Your push notifications are working correctly!",
        data: { type: "test" },
      }];

      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];

      for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      return res.json({ 
        success: true, 
        message: "Test push notification sent!",
        tickets 
      });
    } catch (error: any) {
      console.error("[UserController.testPush] error:", error);
      return res.status(500).json({ success: false, message: "Server error: " + error.message });
    }
  }

  async invoice(req: any, res: Response) {
    try {
      const userId = req.user?.id;
      const txId = req.params.id;

      if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

      const txRes = await pool.query(
        `SELECT t.id, t.amount, t.currency, t.artist_name, t.status, t.date, u.name as customer_name, u.email as customer_email
         FROM transactions t
         JOIN users u ON u.id = t.user_id
         WHERE t.id = $1 AND t.user_id = $2`,
        [txId, userId]
      );

      const tx = txRes.rows[0];
      if (!tx) return res.status(404).json({ success: false, message: "Transaction not found" });

      const { InvoiceService } = require("../../shared/financials/invoice.service");
      const pdfBuffer = await InvoiceService.generateInvoiceBuffer({
        invoiceNumber: `INV-${tx.id}`,
        date: new Date(tx.date).toLocaleDateString(),
        customerName: tx.customer_name || "Valued Customer",
        customerEmail: tx.customer_email,
        artistName: tx.artist_name,
        amount: Number(tx.amount) / 100, // Convert paise to INR
        currency: tx.currency || "INR",
        status: tx.status
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=invoice-${txId}.pdf`);
      return res.send(pdfBuffer);
    } catch (error: any) {
      console.error("[UserController.invoice] error:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }
}
