import "dotenv/config";
import { pool } from "../common/db";

async function discover() {
  console.log("=== DISCOVERING REAL DATA FOR MODULE 08 ===");

  // 1. Privileged & Non-privileged Users
  const roles = await pool.query(`
    SELECT id, email, name, role, status, artist_status, is_verified, is_deleted 
    FROM users 
    WHERE is_deleted = false
    ORDER BY role, id ASC
  `);
  
  const admins = roles.rows.filter(r => r.role === 'ADMIN');
  const moderators = roles.rows.filter(r => r.role === 'MODERATOR');
  const finances = roles.rows.filter(r => r.role === 'FINANCE');
  const artists = roles.rows.filter(r => r.role === 'ARTIST');
  const fans = roles.rows.filter(r => r.role === 'FAN');

  console.log(`ADMINS (${admins.length}):`, admins.map(u => ({ id: u.id, email: u.email, name: u.name, status: u.status })));
  console.log(`MODERATORS (${moderators.length}):`, moderators.map(u => ({ id: u.id, email: u.email, name: u.name, status: u.status })));
  console.log(`FINANCES (${finances.length}):`, finances.map(u => ({ id: u.id, email: u.email, name: u.name, status: u.status })));
  console.log(`ARTISTS (${artists.length}):`, artists.slice(0, 5).map(u => ({ id: u.id, email: u.email, name: u.name, artist_status: u.artist_status, is_verified: u.is_verified })));
  console.log(`FANS (${fans.length}):`, fans.slice(0, 5).map(u => ({ id: u.id, email: u.email, name: u.name, status: u.status })));

  // 2. Pending / Applied Artists for Governance (Approve/Reject)
  const pendingArtists = await pool.query(`
    SELECT id, email, name, artist_status, is_verified, agreement_status
    FROM users
    WHERE role = 'ARTIST' AND (artist_status = 'PENDING' OR artist_status = 'REJECTED' OR artist_status = 'DRAFT')
    LIMIT 10
  `);
  console.log("PENDING/APPLIED ARTISTS:", pendingArtists.rows);

  // 3. Content items by lifecycle state (DRAFT, PUBLISHED, TAKEDOWN)
  const contents = await pool.query(`
    SELECT id, artist_id, title, type, lifecycle_state, is_approved, is_taken_down, status
    FROM content_items
    ORDER BY id ASC
    LIMIT 15
  `);
  console.log("CONTENT ITEMS:", contents.rows);

  // 4. Terms and Commission Plan versions
  const terms = await pool.query(`
    SELECT id, version, effective_from, created_at FROM terms_versions ORDER BY id DESC LIMIT 5
  `);
  console.log("TERMS VERSIONS:", terms.rows);

  const commission = await pool.query(`
    SELECT id, version, artist_share, platform_share FROM revenue_share_configs ORDER BY id DESC LIMIT 5
  `);
  console.log("REVENUE SHARE CONFIGS:", commission.rows);

  // 5. Audit logs count and samples
  const audits = await pool.query(`
    SELECT id, action, entity, entity_id, actor_id, actor_role, status, correlation_id, created_at
    FROM audit_logs
    ORDER BY id DESC
    LIMIT 5
  `);
  console.log("RECENT AUDIT LOGS:", audits.rows);

  // 6. Existing payments
  const payments = await pool.query(`
    SELECT id, user_id, amount, status, razorpay_payment_id, created_at
    FROM payments
    ORDER BY id DESC
    LIMIT 5
  `);
  console.log("RECENT PAYMENTS:", payments.rows);

  await pool.end();
}

discover().catch(e => {
  console.error(e);
  process.exit(1);
});
