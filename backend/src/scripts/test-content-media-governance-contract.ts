import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const srcRoot = path.resolve(__dirname, "..");
const backendRoot = path.resolve(srcRoot, "..");
const repoRoot = path.resolve(backendRoot, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(srcRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function backend(relativePath: string) {
  return fs.readFileSync(path.join(backendRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function repo(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function exists(relativePath: string) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function main() {
  const app = source("app.ts");
  const adminIndex = source("routes/admin/index.ts");
  const adminMediaRoute = source("routes/admin/media.ts");
  const artistMediaRoute = source("routes/artist/media.ts");
  const artistMediaController = source("controllers/artist/artistMediaController.ts");
  const contentRoutes = source("routes/content.ts");
  const fanContentRoutes = source("modules/content/content.routes.ts");
  const governance = source("modules/content/content-governance.service.ts");
  const moderationQuery = source("modules/content/content-moderation-query.service.ts");
  const webhook = source("controllers/media/WebhookController.ts");
  const webhookSecurity = source("modules/media/cloudinary-webhook.security.ts");
  const mediaAuthz = source("shared/security/media-authz.service.ts");
  const streamRoutes = source("modules/streaming/stream.routes.ts");
  const artistAssets = source("modules/artist/artist-assets.routes.ts");
  const cloudinary = source("shared/storage/providers/cloudinary-storage.provider.ts");
  const s3 = source("shared/storage/providers/s3-storage.provider.ts");
  const firebase = source("shared/storage/providers/firebase-storage.provider.ts");
  const local = source("shared/storage/providers/local-storage.provider.ts");
  const env = source("config/env.validation.ts");
  const migration7 = backend("db/migrations/20260913_0007_content_governance_integrity.sql");
  const migration8 = backend("db/migrations/20260913_0008_user_media_assets.sql");
  const schemaReadiness = source("common/db/schema-readiness.ts");
  const featured = source("routes/admin/featured-artists.ts");
  const adminFeaturedPage = repo("web-admin/src/pages/AdminFeaturedArtistsPage.tsx");
  const artistApp = repo("web-artist/src/App.tsx");
  const artistHistory = repo("web-artist/src/pages/ArtistContentHistoryPage.tsx");
  const player = repo("mobile/apps/fan/src/screens/ContentPlayerScreen.tsx");

  assert.equal(app.includes("express.static"), false, "Generic public static media serving must not be mounted");
  assert.equal(app.includes('/api/v1/content/upload'), false, "Legacy unscoped artist content upload route must not be preserved");
  assert.equal(app.includes('"/api/v1/artist/media"') && app.includes("requireVerifiedArtist"), true, "Artist content upload must be mounted behind verified-artist authorization");
  assert.equal(app.includes("artistAssetUploadRouter"), true, "Artist public-brand assets must use the governed provider-backed router");
  assert.equal(app.includes("artistPublicAssetRouter"), true, "Artist public-brand assets need a stable governed delivery route");

  assert.equal(adminIndex.includes('requireRoles("ADMIN", "MODERATOR")'), true, "Content moderation must remain ADMIN/MODERATOR scoped");
  assert.equal(adminIndex.includes('router.use("/media", requireAuth, requireRoles("ADMIN")'), true, "Retired admin upload compatibility route must remain privileged");
  assert.equal(adminIndex.includes("image-upload"), false, "Direct Cloudinary admin image uploader must not be mounted");

  assert.equal(adminMediaRoute.includes("ADMIN_CONTENT_UPLOAD_RETIRED"), true, "Admin binary content upload must be explicitly retired");
  assert.equal(artistMediaRoute.includes("multer.diskStorage"), true, "Large artist uploads must spool to disk instead of buffering in memory");
  assert.equal(artistMediaRoute.includes("uploadLimiter"), true, "Artist media upload must be rate limited");
  assert.equal(artistMediaController.includes("validateSpooledFile"), true, "Artist uploads must validate signature as well as declared MIME");
  assert.equal(artistMediaController.includes("'EARLY_ACCESS', TRUE"), true, "Artist-owned uploads must not enter a manual approval lifecycle");
  assert.equal(artistMediaController.includes("'UPLOADING'"), true, "Upload must start in a technical upload state");
  assert.equal(artistMediaController.includes("published_at = CASE WHEN $2 = 'READY'"), true, "READY uploads must become published automatically");
  assert.equal(artistMediaController.includes("contentLength: media.size"), true, "Provider streaming must receive known media length");
  assert.equal(artistMediaController.includes("media_url = NULL"), true, "Protected media must not persist a raw delivery URL");
  assert.equal(artistMediaController.includes("'ARTIST', 'success'"), true, "Artist-owned uploads must be audited as ARTIST actions");

  assert.equal(governance.includes("content.takedown"), true, "Takedown must remain audited");
  assert.equal(moderationQuery.includes("report_count"), true, "Reported published content must be queryable for moderator review");

  assert.equal(contentRoutes.includes('router.post("/report"'), true, "Fan reports must remain available");
  assert.equal(contentRoutes.includes("status = 'FLAGGED'"), false, "Moderation signals must not overwrite technical media status");
  assert.equal(contentRoutes.includes('router.get(\n  "/mine"'), true, "Artists need canonical content history");
  assert.equal(contentRoutes.includes('router.post("/upload"'), false, "Legacy unscoped content upload must not exist");
  assert.equal(contentRoutes.includes("router.delete("), false, "Artist content hard-delete path must not exist");

  assert.equal(fanContentRoutes.includes("mediaUrl: null"), true, "Catalog/detail APIs must not expose protected media URLs");
  assert.equal(fanContentRoutes.includes("c.lifecycle_state = 'EARLY_ACCESS'"), true, "Fan discovery must require governed lifecycle state");
  assert.equal(fanContentRoutes.includes("c.status = 'READY'"), true, "Fan discovery must require technical readiness");
  assert.equal(fanContentRoutes.includes("artist_status::text) = 'APPROVED'"), true, "Fan discovery must require approved artist state");

  assert.equal(webhookSecurity.includes("timingSafeEqual"), true, "Webhook signature comparison must be timing safe");
  assert.equal(webhook.includes("CLOUDINARY_ASSET_MAPPING_PENDING"), true, "Unknown eager callbacks must retry instead of being consumed during mapping races");
  assert.equal(webhook.includes("processed_webhook_events"), true, "Webhook handling must be idempotent");
  assert.equal(webhook.includes("content.media_status_changed"), true, "Provider media-state changes must be audited");

  assert.equal(mediaAuthz.includes("JOIN users"), true, "Direct playback authorization must include the owning user row");
  assert.equal(mediaAuthz.includes("artist_status::text) = 'APPROVED'"), true, "Direct playback authorization must require approved artist state");
  assert.equal(mediaAuthz.includes("is_verified = TRUE"), true, "Direct playback authorization must require verified artist state");
  assert.equal(streamRoutes.includes("getContentForAccess(contentId)"), true, "Artwork delivery must use canonical current-state authorization lookup");
  assert.equal(streamRoutes.includes("isContentEligibleForPlayback"), true, "Artwork delivery must reuse lifecycle/technical eligibility policy");

  assert.equal(artistAssets.includes("multer.diskStorage"), true, "Artist branding assets must spool to disk");
  assert.equal(artistAssets.includes("user_media_assets"), true, "Artist branding assets must persist provider-neutral mapping");
  assert.equal(artistAssets.includes("stableAssetUrl"), true, "Artist profile/banner DB fields must use stable app URLs");
  assert.equal(artistAssets.includes("validateSpooledFile"), true, "Artist branding image bytes must be signature validated");

  assert.equal(cloudinary.includes("upload_stream"), true, "Cloudinary uploads must stream");
  assert.equal(s3.includes("Body: body"), true, "S3 uploads must pass the stream directly");
  assert.equal(s3.includes("streamToBuffer"), false, "S3 must not buffer full media uploads");
  assert.equal(firebase.includes("body.pipe(write)"), true, "Firebase uploads must stream");
  assert.equal(firebase.includes("streamToBuffer"), false, "Firebase must not buffer full media uploads");
  assert.equal(local.includes("pipeline"), true, "Local provider must use streaming file pipeline");

  assert.equal(env.includes('CLOUDINARY_WEBHOOK_URL is required when STORAGE_PROVIDER=cloudinary'), true, "Cloudinary video processing webhook must fail fast when missing");
  assert.equal(migration7.includes("content_items_technical_status_valid"), true, "DB must constrain technical media states");
  assert.equal(migration7.includes("content_items_media_key_valid"), true, "DB must constrain AUDIO/VIDEO storage-key shape");
  assert.equal(migration8.includes("CREATE TABLE user_media_assets"), true, "Provider-neutral artist asset mapping must be migrated");
  assert.equal(schemaReadiness.includes("20260913_0008_user_media_assets"), true, "Startup schema gate must require the latest Phase 05 migration");

  assert.equal(featured.includes("name && avatar"), false, "Manual/orphan featured artists are outside approved scope");
  assert.equal(featured.includes("artist_status) = 'APPROVED'"), true, "Featured artists must be approved accounts");
  assert.equal(adminFeaturedPage.includes("ImageUpload"), false, "Admin featured UI must not use a parallel image-upload path");
  assert.equal(exists("backend/src/routes/admin/image-upload.ts"), false, "Direct admin Cloudinary image route must be removed");
  assert.equal(exists("web-admin/src/components/ImageUpload.tsx"), false, "Obsolete manual featured image component must be removed");

  assert.equal(exists("backend/src/common/queue.ts"), false, "Legacy media upload queue must be removed");
  assert.equal(exists("backend/src/workers/upload.worker.ts"), false, "Legacy auto-publish upload worker must be removed");
  assert.equal(exists("web-artist/src/pages/ArtistContentUploadPage.tsx"), true, "Artist Studio must expose ownership-scoped content upload UI");
  assert.equal(artistApp.includes('path="/artist/content-upload"'), true, "Artist router must expose the verified self-service upload page");
  assert.equal(artistHistory.includes("/api/v1/content/mine"), true, "Artist content page must use canonical history endpoint");
  assert.equal(exists("web-admin/src/pages/AdminMediaUploadPage.tsx"), false, "Admin content upload page must be removed");

  assert.equal(player.includes("navigation.replace('FullPlayer'"), true, "Legacy audio route must delegate to the hardened global player");
  const heartbeat = repo("mobile/apps/fan/src/services/heartbeatService.ts");
  assert.equal(heartbeat.includes("currentPosition:"), true, "Playback heartbeat must include current position");
  assert.equal(heartbeat.includes("duration:"), true, "Playback heartbeat must include duration");

  console.log("Content/media governance contract checks passed.");
}

main();
