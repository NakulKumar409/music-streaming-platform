import "dotenv/config";
import { pool } from "../common/db";

async function discover() {
  console.log("=== DISCOVERING REAL DATA FOR MODULE 07 ===");

  // 1. Roles
  const roles = await pool.query(`
    SELECT id, email, name, role, status, artist_status, is_verified 
    FROM users 
    WHERE role IN ('ADMIN', 'FINANCE', 'ARTIST', 'FAN') AND is_deleted = false
    ORDER BY role, id ASC
  `);
  
  const admins = roles.rows.filter(r => r.role === 'ADMIN');
  const finances = roles.rows.filter(r => r.role === 'FINANCE');
  const artists = roles.rows.filter(r => r.role === 'ARTIST');
  const fans = roles.rows.filter(r => r.role === 'FAN');

  console.log(`ADMINS (${admins.length}):`, admins.slice(0, 3).map(u => ({ id: u.id, email: u.email, name: u.name })));
  console.log(`FINANCES (${finances.length}):`, finances.slice(0, 3).map(u => ({ id: u.id, email: u.email, name: u.name })));
  console.log(`ARTISTS (${artists.length}):`, artists.slice(0, 5).map(u => ({ id: u.id, email: u.email, name: u.name, artist_status: u.artist_status })));
  console.log(`FANS (${fans.length}):`, fans.slice(0, 5).map(u => ({ id: u.id, email: u.email, name: u.name })));

  // 2. Content: Audio and Video
  const content = await pool.query(`
    SELECT id, artist_id, title, type, subscription_required, media_url, audio_url, video_url, lifecycle_state, is_taken_down
    FROM content_items
    WHERE is_taken_down = false
    ORDER BY type, id ASC
    LIMIT 20
  `);
  const audioItems = content.rows.filter(c => c.type === 'AUDIO' || c.type === 'TRACK' || c.type === 'SONG');
  const videoItems = content.rows.filter(c => c.type === 'VIDEO');

  console.log(`AUDIO CONTENT (${audioItems.length}):`, audioItems.slice(0, 5).map(c => ({ id: c.id, artist_id: c.artist_id, title: c.title, sub_req: c.subscription_required, media_url: (c.audio_url || c.media_url)?.slice(0, 40) })));
  console.log(`VIDEO CONTENT (${videoItems.length}):`, videoItems.slice(0, 5).map(c => ({ id: c.id, artist_id: c.artist_id, title: c.title, sub_req: c.subscription_required, video_url: (c.video_url || c.media_url)?.slice(0, 40) })));

  // 3. Subscriptions
  const subs = await pool.query(`
    SELECT s.id, s.user_id, s.artist_id, s.status, s.plan_type, s.start_date, s.next_billing_date, u.name as artist_name, f.email as fan_email
    FROM subscriptions s
    LEFT JOIN users u ON u.id = s.artist_id
    LEFT JOIN users f ON f.id = s.user_id
    ORDER BY s.id DESC
    LIMIT 10
  `);
  console.log(`SUBSCRIPTIONS (${subs.rows.length}):`, subs.rows);

  // 4. Payments
  const payments = await pool.query(`
    SELECT p.id, p.user_id, p.subscription_id, p.amount, p.status, p.razorpay_payment_id, p.created_at
    FROM payments p
    ORDER BY p.created_at DESC
    LIMIT 10
  `);
  console.log(`PAYMENTS (${payments.rows.length}):`, payments.rows);

  // 5. Refunds
  const refunds = await pool.query(`
    SELECT r.id, r.payment_id, r.status, r.amount, r.provider_refund_id, r.requested_by, r.requested_by_role
    FROM refund_requests r
    ORDER BY r.created_at DESC
    LIMIT 10
  `);
  console.log(`REFUNDS (${refunds.rows.length}):`, refunds.rows);

  // 6. Platform config / artist pricing
  const artistPrices = await pool.query(`
    SELECT id, name, email, subscription_price, subscription_features
    FROM users
    WHERE id IN (31, 49)
  `);
  console.log(`TARGET ARTISTS (31, 49):`, artistPrices.rows);

  // 7. Audio and Video for Artist 31 and 49
  const targetContent = await pool.query(`
    SELECT id, artist_id, title, type, subscription_required, storage_key, video_storage_key, is_approved, is_taken_down, status
    FROM content_items
    WHERE artist_id IN (31, 49)
    ORDER BY type, id ASC
  `);
  console.log(`TARGET CONTENT FOR ARTIST 31 & 49:`, targetContent.rows);

  await pool.end();
}

discover().catch(e => {
  console.error(e);
  process.exit(1);
});
