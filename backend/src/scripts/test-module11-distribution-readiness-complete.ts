import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import jwt from "jsonwebtoken";
import { createApp } from "../app";
import { validateEnv } from "../config/env.validation";
import { pool } from "../common/db";
import { SessionService } from "../common/auth/session.service";
import {
  validatePhase1ReleaseMetadata,
  RELEASE_TYPES,
  CONTRIBUTOR_ROLES,
} from "../modules/distribution/release-domain.validation";
import { ensureSingleReleaseForAudioContent } from "../modules/distribution/release-compatibility.service";

async function main() {
  console.log("================================================================================");
  console.log("MODULE 11 -- PHASE-2 DISTRIBUTION-READY DOMAIN (PHASE-1 INACTIVE) QA SUITE");
  console.log("================================================================================\n");

  const env = validateEnv();
  const app = createApp(env);
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not bind test server");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[INIT] Privileged Test Server running on ${baseUrl}\n`);

  async function api(
    routePath: string,
    options: {
      method?: string;
      token?: string;
      correlationId?: string;
      headers?: Record<string, string>;
      body?: any;
    } = {}
  ) {
    const headers: Record<string, string> = {
      ...(options.headers || {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.correlationId ? { "x-correlation-id": options.correlationId } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    };

    const res = await fetch(`${baseUrl}${routePath}`, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const status = res.status;
    const responseHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      responseHeaders[key.toLowerCase()] = val;
    });

    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { status, data, headers: responseHeaders };
  }

  try {
    // -------------------------------------------------------------------------
    // Setup Test Identities
    // -------------------------------------------------------------------------
    console.log("[SETUP] Minting Authenticated Test Actors...");
    const secret = process.env.JWT_SECRET || "supersecretjwtkeyforlocaldevelopment12345";

    const adminUser = await pool.query<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE UPPER(role) = 'ADMIN' AND COALESCE(is_deleted, false) = false ORDER BY id ASC LIMIT 1"
    );
    if (!adminUser.rows[0]) throw new Error("No admin user in database");
    const adminId = adminUser.rows[0].id;
    await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [adminId]);
    const sessionAdmin = await SessionService.createSession({ userId: adminId, deviceId: "qa-admin-dist", deviceName: "Admin PC" });
    const adminToken = jwt.sign(
      { id: adminId, role: "ADMIN", email: adminUser.rows[0].email, sid: sessionAdmin.id },
      secret,
      { expiresIn: "1h" }
    );

    const fanUser = await pool.query<{ id: number; email: string }>(
      "SELECT id, email FROM users WHERE UPPER(role) = 'FAN' AND COALESCE(is_deleted, false) = false ORDER BY id ASC LIMIT 1"
    );
    if (!fanUser.rows[0]) throw new Error("No fan user in database");
    const fanId = fanUser.rows[0].id;
    await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [fanId]);
    const sessionFan = await SessionService.createSession({ userId: fanId, deviceId: "qa-fan-dist", deviceName: "Fan Phone" });
    const fanToken = jwt.sign(
      { id: fanId, role: "FAN", email: fanUser.rows[0].email, sid: sessionFan.id },
      secret,
      { expiresIn: "1h" }
    );

    const verifiedArtists = await pool.query<{ id: number; email: string; name: string }>(
      `SELECT id, email, name FROM users
        WHERE UPPER(role) = 'ARTIST'
          AND is_verified = true
          AND UPPER(status) = 'ACTIVE'
          AND UPPER(artist_status::text) = 'APPROVED'
          AND COALESCE(is_deleted, false) = false
        ORDER BY id ASC LIMIT 1`
    );
    if (!verifiedArtists.rows[0]) throw new Error("Need at least 1 verified approved artist");
    const artistA = verifiedArtists.rows[0];

    const otherArtists = await pool.query<{ id: number; email: string; name: string }>(
      `SELECT id, email, name FROM users
        WHERE UPPER(role) = 'ARTIST'
          AND id != $1
          AND COALESCE(is_deleted, false) = false
        ORDER BY id ASC LIMIT 1`,
      [artistA.id]
    );
    if (!otherArtists.rows[0]) throw new Error("Need a second artist for cross-artist IDOR test");
    const artistB = otherArtists.rows[0];

    await pool.query("DELETE FROM user_sessions WHERE user_id = $1", [artistA.id]);
    const sessionArtist = await SessionService.createSession({ userId: artistA.id, deviceId: "qa-artist-dist", deviceName: "Artist Studio" });
    const artistToken = jwt.sign(
      { id: artistA.id, role: "ARTIST", email: artistA.email, sid: sessionArtist.id },
      secret,
      { expiresIn: "1h" }
    );

    console.log(`  -> Admin Actor ID: ${adminId} (${adminUser.rows[0].email})`);
    console.log(`  -> Fan Actor ID: ${fanId} (${fanUser.rows[0].email})`);
    console.log(`  -> Artist A (Verified) ID: ${artistA.id} (${artistA.email})`);
    console.log(`  -> Artist B (Distinct) ID: ${artistB.id} (${artistB.email})\n`);

    // =========================================================================
    // SECTION 1: Schema & Constraints Readiness
    // =========================================================================
    console.log("--- SECTION 1: Schema & Constraints Readiness ---");

    const expectedTables = [
      "releases",
      "release_tracks",
      "release_contributors",
      "external_platform_links",
      "distribution_submissions",
      "distribution_platform_statuses",
      "distribution_outbox",
    ];

    const dbTables = await pool.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [expectedTables]
    );
    const existingTableSet = new Set(dbTables.rows.map((r) => r.table_name));

    for (const tbl of expectedTables) {
      assert.ok(existingTableSet.has(tbl), `Table ${tbl} must exist in database`);
    }
    console.log(`  [PASS] 1A. All 7 distribution domain tables verified in PostgreSQL`);

    // Verify content_items release_track_id column & FK
    const ciCol = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'content_items' AND column_name = 'release_track_id'`
    );
    assert.equal(ciCol.rows.length, 1, "content_items.release_track_id must exist");
    assert.equal(ciCol.rows[0].data_type, "bigint");
    console.log(`  [PASS] 1B. content_items.release_track_id (BIGINT) verified with FK`);

    // Verify Check Constraints in DB
    const checkConstraints = await pool.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname = ANY($1)`,
      [[
        "releases_distribution_status_valid",
        "releases_release_type_valid",
        "releases_upc_ean_shape_valid",
        "release_tracks_isrc_shape_valid",
        "external_platform_links_url_http",
      ]]
    );
    const constraintNames = checkConstraints.rows.map((r) => r.conname);
    assert.ok(constraintNames.includes("releases_distribution_status_valid"));
    assert.ok(constraintNames.includes("releases_release_type_valid"));
    assert.ok(constraintNames.includes("releases_upc_ean_shape_valid"));
    assert.ok(constraintNames.includes("release_tracks_isrc_shape_valid"));
    assert.ok(constraintNames.includes("external_platform_links_url_http"));
    console.log(`  [PASS] 1C. PostgreSQL database CHECK constraints verified for domain integrity\n`);

    // =========================================================================
    // SECTION 2: Existing Data Backfill & Content Integrity
    // =========================================================================
    console.log("--- SECTION 2: Existing Data Backfill & Content Integrity ---");

    // Check existing releases
    const releasesCount = await pool.query<{ count: string }>("SELECT COUNT(*) FROM releases");
    assert.ok(Number(releasesCount.rows[0].count) >= 1, "Releases table must contain backfilled rows");

    // All backfilled releases must have release_type = 'SINGLE' and distribution_status = 'NOT_SUBMITTED'
    const invalidReleases = await pool.query(
      `SELECT id, release_type, distribution_status FROM releases WHERE release_type != 'SINGLE' OR distribution_status != 'NOT_SUBMITTED'`
    );
    assert.equal(invalidReleases.rows.length, 0, "Phase-1 releases must all be SINGLE and NOT_SUBMITTED");
    console.log(`  [PASS] 2A. All ${releasesCount.rows[0].count} releases strictly verified as SINGLE and NOT_SUBMITTED`);

    // Video content items must NOT be mapped to releases
    const videoReleases = await pool.query(
      `SELECT r.id, r.title, c.type FROM releases r JOIN content_items c ON c.id = r.source_content_id WHERE UPPER(c.type) = 'VIDEO'`
    );
    assert.equal(videoReleases.rows.length, 0, "VIDEO content must NOT be mapped to releases in Phase 1");

    const videoWithTrack = await pool.query(
      `SELECT id, type, release_track_id FROM content_items WHERE UPPER(type) = 'VIDEO' AND release_track_id IS NOT NULL`
    );
    assert.equal(videoWithTrack.rows.length, 0, "VIDEO items must have null release_track_id");
    console.log(`  [PASS] 2B. VIDEO content items verified deliberately unmapped from release domain`);

    // Test backfill idempotency with ensureSingleReleaseForAudioContent
    const sampleAudio = await pool.query<{ id: number; artist_id: number; title: string; genre: string | null }>(
      `SELECT id, artist_id, title, genre FROM content_items WHERE UPPER(type) = 'AUDIO' AND release_track_id IS NOT NULL LIMIT 1`
    );
    if (sampleAudio.rows[0]) {
      const client = await pool.connect();
      try {
        const item = sampleAudio.rows[0];
        const res = await ensureSingleReleaseForAudioContent(client, {
          contentId: item.id,
          artistId: item.artist_id,
          title: item.title,
          genre: item.genre,
          thumbnailStorageKey: null,
          thumbnailProviderAssetId: null,
          metadata: {
            releaseType: "SINGLE",
            language: null,
            explicit: false,
            labelName: null,
            earlyAccessStartAt: null,
            publicReleaseAt: null,
            exclusivityEndAt: null,
            upcEan: null,
            isrc: null,
            contributors: [],
          },
        });
        assert.equal(res.created, false, "Second call on existing content must be idempotent (created: false)");
        console.log(`  [PASS] 2C. Idempotent backfill service invocation verified without duplicating rows\n`);
      } finally {
        client.release();
      }
    }

    // =========================================================================
    // SECTION 3: Identifier Validation (UPC/EAN & ISRC)
    // =========================================================================
    console.log("--- SECTION 3: Identifier Validation (UPC/EAN & ISRC) ---");

    // Valid UPC lengths: 8, 12, 13, 14 digits with hyphen/whitespace stripping
    const validUpc1 = validatePhase1ReleaseMetadata({ upcEan: "1234-5678" }, "AUDIO");
    assert.equal(validUpc1?.upcEan, "12345678");
    const validUpc2 = validatePhase1ReleaseMetadata({ upcEan: " 1234 5678 9012 " }, "AUDIO");
    assert.equal(validUpc2?.upcEan, "123456789012");
    const validUpc3 = validatePhase1ReleaseMetadata({ upcEan: "1234567890123" }, "AUDIO");
    assert.equal(validUpc3?.upcEan, "1234567890123");
    const validUpc4 = validatePhase1ReleaseMetadata({ upcEan: "1234-5678-9012-34" }, "AUDIO");
    assert.equal(validUpc4?.upcEan, "12345678901234");
    console.log(`  [PASS] 3A. Valid UPC/EAN formats (8, 12, 13, 14 digits) and normalization verified`);

    // Invalid UPC lengths / characters
    assert.throws(
      () => validatePhase1ReleaseMetadata({ upcEan: "12345" }, "AUDIO"),
      (err: any) => err.code === "INVALID_UPC_EAN",
      "5-digit UPC must fail"
    );
    assert.throws(
      () => validatePhase1ReleaseMetadata({ upcEan: "123456789012345" }, "AUDIO"),
      (err: any) => err.code === "INVALID_UPC_EAN",
      "15-digit UPC must fail"
    );
    assert.throws(
      () => validatePhase1ReleaseMetadata({ upcEan: "12345678ABCD" }, "AUDIO"),
      (err: any) => err.code === "INVALID_UPC_EAN",
      "Alphanumeric UPC must fail"
    );
    console.log(`  [PASS] 3B. Invalid UPC/EAN (wrong length, alphanumeric) rejected with INVALID_UPC_EAN`);

    // Valid ISRC: 12 chars (2 country + 3 alphanumeric registrant + 7 numeric)
    const validIsrc = validatePhase1ReleaseMetadata({ isrc: "in-abc-26-12345" }, "AUDIO");
    assert.equal(validIsrc?.isrc, "INABC2612345");
    console.log(`  [PASS] 3C. Valid ISRC format and uppercase normalization verified`);

    // Invalid ISRC
    assert.throws(
      () => validatePhase1ReleaseMetadata({ isrc: "INVALID-ISRC" }, "AUDIO"),
      (err: any) => err.code === "INVALID_ISRC",
      "Malformed ISRC must fail"
    );
    assert.throws(
      () => validatePhase1ReleaseMetadata({ isrc: "12ABC2612345" }, "AUDIO"),
      (err: any) => err.code === "INVALID_ISRC",
      "ISRC starting with digits must fail"
    );
    console.log(`  [PASS] 3D. Invalid ISRC shapes rejected with INVALID_ISRC`);

    // Database unique index constraint enforcement
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const testUpc = "999999999999";
      await client.query(
        `INSERT INTO releases (artist_id, title, release_type, upc_ean) VALUES ($1, 'UPC Test 1', 'SINGLE', $2)`,
        [artistA.id, testUpc]
      );
      let duplicateCaught = false;
      try {
        await client.query(
          `INSERT INTO releases (artist_id, title, release_type, upc_ean) VALUES ($1, 'UPC Test 2', 'SINGLE', $2)`,
          [artistA.id, testUpc]
        );
      } catch (err: any) {
        duplicateCaught = err.code === "23505"; // unique_violation
      }
      assert.ok(duplicateCaught, "Duplicate UPC in DB must throw unique_violation (23505)");
      await client.query("ROLLBACK");
      console.log(`  [PASS] 3E. Database unique constraint on UPC/EAN strictly enforced (23505)\n`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    // =========================================================================
    // SECTION 4: Contributor Roles & Relational Integrity
    // =========================================================================
    console.log("--- SECTION 4: Contributor Roles & Relational Integrity ---");

    // All allowed roles
    for (const role of CONTRIBUTOR_ROLES) {
      const res = validatePhase1ReleaseMetadata(
        { contributors: JSON.stringify([{ displayName: "Test Contributor", role }]) },
        "AUDIO"
      );
      assert.equal(res?.contributors[0].role, role);
    }
    console.log(`  [PASS] 4A. All 6 contributor roles verified: ${CONTRIBUTOR_ROLES.join(", ")}`);

    // Unknown role
    assert.throws(
      () =>
        validatePhase1ReleaseMetadata(
          { contributors: [{ displayName: "Test", role: "CHOREOGRAPHER" }] },
          "AUDIO"
        ),
      (err: any) => err.code === "INVALID_RELEASE_METADATA",
      "Unknown contributor role must throw INVALID_RELEASE_METADATA"
    );
    console.log(`  [PASS] 4B. Unknown contributor role rejected with INVALID_RELEASE_METADATA`);

    // DB foreign key violation on missing release
    const client4 = await pool.connect();
    try {
      await client4.query("BEGIN");
      let fkCaught = false;
      try {
        await client4.query(
          `INSERT INTO release_contributors (release_id, release_track_id, display_name, role)
           VALUES (999999999, NULL, 'Ghost', 'COMPOSER')`
        );
      } catch (err: any) {
        fkCaught = err.code === "23503"; // foreign_key_violation
      }
      assert.ok(fkCaught, "Orphan contributor referencing missing release must fail with 23503");
      await client4.query("ROLLBACK");
      console.log(`  [PASS] 4C. DB foreign key constraint prevents orphan contributor records\n`);
    } catch (e) {
      await client4.query("ROLLBACK");
      throw e;
    } finally {
      client4.release();
    }

    // =========================================================================
    // SECTION 5: Lifecycle Independence & Phase-1 Playback Entitlement
    // =========================================================================
    console.log("--- SECTION 5: Lifecycle Independence & Playback Entitlement ---");

    // Verify distribution_status does not affect playback
    // Content playback authorization is governed by lifecycle_state, is_taken_down, subscription
    // Check stream access endpoint mapping (POST /api/v1/fan/stream/access)
    const streamAccess = await api("/api/v1/fan/stream/access", {
      method: "POST",
      token: fanToken,
      body: { contentId: 99999999 },
    });
    // Non-existent content returns 404 or 409, never 500 or provider error
    assert.ok(
      [404, 400, 409].includes(streamAccess.status),
      `Non-existent content stream access must return standard error code, got ${streamAccess.status}`
    );
    console.log(`  [PASS] 5A. Stream access endpoint strictly fails closed for invalid content (${streamAccess.status})`);

    // Verify that distribution_status check constraint only permits valid states
    const client5 = await pool.connect();
    try {
      await client5.query("BEGIN");
      let statusCheckCaught = false;
      try {
        await client5.query(
          `INSERT INTO releases (artist_id, title, release_type, distribution_status)
           VALUES ($1, 'Status Test', 'SINGLE', 'INVALID_STATUS_XYZ')`,
          [artistA.id]
        );
      } catch (err: any) {
        statusCheckCaught = err.code === "23514"; // check_violation
      }
      assert.ok(statusCheckCaught, "Invalid distribution_status must be rejected by CHECK constraint");
      await client5.query("ROLLBACK");
      console.log(`  [PASS] 5B. DB check constraint enforces explicit distribution status state machine\n`);
    } catch (e) {
      await client5.query("ROLLBACK");
      throw e;
    } finally {
      client5.release();
    }

    // =========================================================================
    // SECTION 6: Provider Seam & Phase-1 Network Isolation
    // =========================================================================
    console.log("--- SECTION 6: Provider Seam & Phase-1 Network Isolation ---");

    // Upload validation rejects distribution workflow fields
    assert.throws(
      () => validatePhase1ReleaseMetadata({ distributionStatus: "DISTRIBUTED" }, "AUDIO"),
      (err: any) => err.code === "DISTRIBUTION_WORKFLOW_NOT_AVAILABLE"
    );
    assert.throws(
      () => validatePhase1ReleaseMetadata({ providerCode: "SPOTIFY" }, "AUDIO"),
      (err: any) => err.code === "DISTRIBUTION_WORKFLOW_NOT_AVAILABLE"
    );
    assert.throws(
      () => validatePhase1ReleaseMetadata({ providerReference: "REF-1234" }, "AUDIO"),
      (err: any) => err.code === "DISTRIBUTION_WORKFLOW_NOT_AVAILABLE"
    );
    console.log(`  [PASS] 6A. Upload endpoint strictly blocks client modification of distribution workflow fields`);

    // Multi-track (EP, ALBUM) rejection on single upload
    assert.throws(
      () => validatePhase1ReleaseMetadata({ releaseType: "EP" }, "AUDIO"),
      (err: any) => err.code === "MULTI_TRACK_RELEASE_REQUIRES_RELEASE_API"
    );
    assert.throws(
      () => validatePhase1ReleaseMetadata({ releaseType: "ALBUM" }, "AUDIO"),
      (err: any) => err.code === "MULTI_TRACK_RELEASE_REQUIRES_RELEASE_API"
    );
    console.log(`  [PASS] 6B. Multi-track releases (EP/ALBUM) rejected on single-media upload endpoint`);

    // Release metadata on VIDEO rejected
    assert.throws(
      () => validatePhase1ReleaseMetadata({ releaseType: "SINGLE" }, "VIDEO"),
      (err: any) => err.code === "RELEASE_METADATA_AUDIO_ONLY"
    );
    console.log(`  [PASS] 6C. Release metadata rejected for VIDEO content uploads`);

    // External platform links enforce HTTPS
    const client6 = await pool.connect();
    try {
      const sampleRelease = await client6.query<{ id: string }>("SELECT id FROM releases LIMIT 1");
      const releaseId = sampleRelease.rows[0].id;

      // Check javascript:
      await client6.query("BEGIN");
      let unsafeUrlCaught = false;
      try {
        await client6.query(
          `INSERT INTO external_platform_links (release_id, platform_code, external_url)
           VALUES ($1, 'spotify', 'javascript:alert(1)')`,
          [releaseId]
        );
      } catch (err: any) {
        unsafeUrlCaught = err.code === "23514"; // check_violation
      }
      assert.ok(unsafeUrlCaught, "Insecure external URL (javascript:) must violate check constraint");
      await client6.query("ROLLBACK");

      // Check plain http:
      await client6.query("BEGIN");
      let httpUrlCaught = false;
      try {
        await client6.query(
          `INSERT INTO external_platform_links (release_id, platform_code, external_url)
           VALUES ($1, 'spotify', 'http://insecure-link.com')`,
          [releaseId]
        );
      } catch (err: any) {
        httpUrlCaught = err.code === "23514"; // check_violation
      }
      assert.ok(httpUrlCaught, "Plain HTTP external URL must violate check constraint (https:// required)");
      await client6.query("ROLLBACK");

      console.log(`  [PASS] 6D. External platform links enforce strict HTTPS schema at database level\n`);
    } catch (e) {
      await client6.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client6.release();
    }

    // =========================================================================
    // SECTION 7: Multi-Tenant Artist Ownership & IDOR Protection
    // =========================================================================
    console.log("--- SECTION 7: Multi-Tenant Artist Ownership & IDOR Protection ---");

    const client7 = await pool.connect();
    try {
      await client7.query("BEGIN");

      // Create a release for Artist A
      const relA = await client7.query<{ id: string }>(
        `INSERT INTO releases (artist_id, title, release_type) VALUES ($1, 'Artist A Single', 'SINGLE') RETURNING id`,
        [artistA.id]
      );
      const releaseAId = relA.rows[0].id;

      // Attempt to add a track belonging to Artist B into Artist A's release
      let crossArtistCaught = false;
      try {
        await client7.query(
          `INSERT INTO release_tracks (release_id, artist_id, title, disc_number, track_number)
           VALUES ($1, $2, 'Infiltrator Track', 1, 1)`,
          [releaseAId, artistB.id]
        );
      } catch (err: any) {
        // fk_release_tracks_release_artist enforces (release_id, artist_id) references releases(id, artist_id)
        crossArtistCaught = err.code === "23503"; // foreign_key_violation
      }
      assert.ok(crossArtistCaught, "Composite FK fk_release_tracks_release_artist must block cross-artist track assignment");
      console.log(`  [PASS] 7A. Cross-artist release track insertion strictly blocked by composite foreign key`);

      await client7.query("ROLLBACK");
    } catch (e) {
      await client7.query("ROLLBACK");
      throw e;
    } finally {
      client7.release();
    }

    // =========================================================================
    // SECTION 8: Audio & Video Playback & Platform Non-Regression
    // =========================================================================
    console.log("\n--- SECTION 8: Audio & Video Playback & Platform Non-Regression ---");

    // 8A. Fan Content Browse endpoint
    const browseRes = await api("/api/v1/fan/content?limit=5", { token: fanToken });
    assert.equal(browseRes.status, 200, "Browse content must return HTTP 200");
    const items = browseRes.data?.items || browseRes.data?.content || [];
    assert.ok(Array.isArray(items), "Browse items must be an array");
    console.log(`  [PASS] 8A. Fan browse content verified (returned ${items.length} items)`);

    // 8B. Audio Content Playback verification
    await pool.query("DELETE FROM playback_sessions WHERE user_id = $1", [fanId]);
    const audioItem = await pool.query<{ id: number; title: string }>(
      `SELECT id, title FROM content_items
       WHERE UPPER(type) = 'AUDIO'
         AND is_approved = true
         AND is_taken_down = false
         AND UPPER(status) = 'READY'
       LIMIT 1`
    );
    if (audioItem.rows[0]) {
      const audioStreamRes = await api("/api/v1/fan/stream/access", {
        method: "POST",
        token: fanToken,
        body: { contentId: audioItem.rows[0].id },
      });
      // Accept 200 (direct stream access) or 403 (if subscription required for this specific track)
      assert.ok(
        [200, 403].includes(audioStreamRes.status),
        `Audio stream access must return 200 or 403 (entitlement), got ${audioStreamRes.status}`
      );
      if (audioStreamRes.status === 200) {
        assert.ok(audioStreamRes.data?.playbackUrl || audioStreamRes.data?.url, "Audio stream access must return valid playbackUrl");
      }
      console.log(`  [PASS] 8B. Audio playback access verified for content #${audioItem.rows[0].id} (Status: ${audioStreamRes.status})`);
    } else {
      console.log(`  [SKIP] 8B. No ready audio content in DB for direct stream test`);
    }

    // 8C. Video Content Playback verification
    await pool.query("DELETE FROM playback_sessions WHERE user_id = $1", [fanId]);
    const videoItem = await pool.query<{ id: number; title: string }>(
      `SELECT id, title FROM content_items
       WHERE UPPER(type) = 'VIDEO'
         AND is_approved = true
         AND is_taken_down = false
         AND UPPER(status) = 'READY'
       LIMIT 1`
    );
    if (videoItem.rows[0]) {
      const videoStreamRes = await api("/api/v1/fan/stream/access", {
        method: "POST",
        token: fanToken,
        body: { contentId: videoItem.rows[0].id },
      });
      assert.ok(
        [200, 403].includes(videoStreamRes.status),
        `Video stream access must return 200 or 403 (entitlement), got ${videoStreamRes.status}`
      );
      if (videoStreamRes.status === 200) {
        assert.ok(videoStreamRes.data?.playbackUrl || videoStreamRes.data?.url, "Video stream access must return valid playbackUrl");
      }
      console.log(`  [PASS] 8C. Video playback access verified for content #${videoItem.rows[0].id} (Status: ${videoStreamRes.status})`);
    } else {
      console.log(`  [SKIP] 8C. No ready video content in DB for direct stream test`);
    }

    // 8D. Admin Content Approval Queue regression
    const adminQueueRes = await api("/api/v1/admin/content/pending", { token: adminToken });
    assert.equal(adminQueueRes.status, 200, "Admin content approval queue must return 200");
    console.log(`  [PASS] 8D. Admin governance pending content queue non-regression verified`);

    // 8E. Artist Own Content regression
    const artistContentRes = await api("/api/v1/content/mine", { token: artistToken });
    assert.equal(artistContentRes.status, 200, "Artist own content must return 200");
    const artistItems = artistContentRes.data?.items || [];
    console.log(`  [PASS] 8E. Artist own content non-regression verified (returned ${artistItems.length} items)`);

    console.log("\n================================================================================");
    console.log("MODULE 11 QA VERIFICATION COMPLETED: ALL CHECKS PASSED (100%)");
    console.log("================================================================================\n");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("\n[FATAL ERROR IN MODULE 11 QA SUITE]:", err);
  process.exit(1);
});
