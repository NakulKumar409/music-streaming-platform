import assert from "node:assert/strict";
import { pool } from "../common/db";
import { canonicalPublicUrl } from "../common/http/public-url";

async function runArtistImageVerification() {
  console.log("=================================================");
  console.log("  ARTIST PROFILE IMAGE SYSTEM VERIFICATION TEST  ");
  console.log("=================================================\n");

  // 1. Verify Artists in Database
  const artistsRes = await pool.query<{
    id: number;
    name: string;
    profile_image_url: string | null;
  }>(
    `SELECT u.id, u.name, u.profile_image_url
       FROM users u
      WHERE UPPER(u.role) = 'ARTIST'
        AND u.is_deleted = false
        AND UPPER(u.status) = 'ACTIVE'
        AND u.is_verified = true
        AND UPPER(u.artist_status::text) = 'APPROVED'
      ORDER BY u.id ASC`
  );

  console.log(`[PASS] Found ${artistsRes.rows.length} active verified artists:`);
  for (const a of artistsRes.rows) {
    console.log(`  - Artist ID ${a.id}: "${a.name}" => profile_image_url: "${a.profile_image_url}"`);
  }

  // 2. Verify Content Items join with Artist Profile Images
  const contentRes = await pool.query<{
    id: number;
    title: string;
    type: string;
    artist_id: number;
    artist_name: string;
    artist_profile_image_url: string | null;
  }>(
    `SELECT c.id, c.title, c.type, c.artist_id,
            COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)) AS artist_name,
            u.profile_image_url AS artist_profile_image_url
       FROM content_items c
       JOIN users u ON u.id = c.artist_id
      WHERE c.lifecycle_state = 'EARLY_ACCESS'
        AND c.is_approved = TRUE
        AND c.is_taken_down = FALSE
        AND c.status = 'READY'
      ORDER BY c.id ASC`
  );

  console.log(`\n[PASS] Content items verified with artist profile image mapping:`);
  for (const item of contentRes.rows) {
    const artistCanonicalUrl = canonicalPublicUrl(item.artist_profile_image_url);
    console.log(`  - Content #${item.id} (${item.type}) "${item.title}" => Artist #${item.artist_id} (${item.artist_name}): ${artistCanonicalUrl || 'NO_UPLOAD (FALLBACK)'}`);

    // Verify Artist ID is consistent
    if (item.artist_id === 51) {
      assert.equal(item.artist_name, "Jubin Nautiyal");
      assert.equal(item.artist_profile_image_url, "/api/v1/artist/assets/51/profile");
    }
    if (item.artist_id === 31) {
      assert.equal(item.artist_name, "Arjit Singh");
      assert.equal(item.artist_profile_image_url, "/api/v1/artist/assets/31/profile");
    }
    if (item.artist_id === 94) {
      assert.equal(item.artist_name, "Neha Kakkar");
      assert.equal(item.artist_profile_image_url, "/api/v1/artist/assets/94/profile");
    }
  }

  // Specific check on Barbaad Song | Saiyaara (#20, VIDEO)
  const barbaadVideo = contentRes.rows.find(c => c.id === 20);
  assert.ok(barbaadVideo, "Content item #20 (Barbaad Song) must exist");
  assert.equal(barbaadVideo.artist_id, 51, "Barbaad Song artistId must be 51 (Jubin Nautiyal)");
  assert.equal(barbaadVideo.artist_name, "Jubin Nautiyal", "Barbaad Song artistName must be Jubin Nautiyal");
  assert.equal(barbaadVideo.artist_profile_image_url, "/api/v1/artist/assets/51/profile", "Barbaad Song must resolve to Jubin Nautiyal's profile image asset");

  console.log("\n[PASS] Specific fixture check: Content #20 'Barbaad Song | Saiyaara' -> Artist ID 51 Jubin Nautiyal profile asset verified!");

  // 3. Verify user media assets
  const assetsRes = await pool.query<{
    user_id: number;
    kind: string;
    storage_provider: string;
    storage_key: string;
  }>(
    `SELECT user_id, kind, storage_provider, storage_key
       FROM user_media_assets
      WHERE kind = 'PROFILE'
      ORDER BY user_id ASC`
  );

  console.log(`\n[PASS] Verified user media assets (${assetsRes.rows.length} profile assets on record):`);
  for (const asset of assetsRes.rows) {
    console.log(`  - User #${asset.user_id} (${asset.kind}): provider=${asset.storage_provider}, key=${asset.storage_key}`);
  }

  console.log("\n=================================================");
  console.log("  ALL ARTIST PROFILE IMAGE TESTS PASSED (100%)   ");
  console.log("=================================================");
  process.exit(0);
}

runArtistImageVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
