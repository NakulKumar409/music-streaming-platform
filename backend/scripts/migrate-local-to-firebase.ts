/**
 * One-off migration: upload all files from local ./storage to Firebase Storage.
 * Run with: npx ts-node -r dotenv/config scripts/migrate-local-to-firebase.ts
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

async function getAllFiles(dir: string): Promise<string[]> {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      files.push(...await getAllFiles(full));
    } else if (!e.name.endsWith(".meta.json")) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const admin = await import("firebase-admin");

  const projectId = process.env.FIREBASE_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET!;

  if (!projectId || !clientEmail || !privateKey || !storageBucket) {
    console.error("❌ Missing Firebase env vars. Check your .env file.");
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  }

  const bucket = admin.storage().bucket(storageBucket);
  const localRoot = path.resolve(__dirname, "../storage");

  if (!fs.existsSync(localRoot)) {
    console.error(`❌ Local storage directory not found: ${localRoot}`);
    process.exit(1);
  }

  const files = await getAllFiles(localRoot);
  console.log(`\n📦 Found ${files.length} local files to migrate\n`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    // Storage key = relative path from localRoot (e.g. artists/2/thumbnails/2026/03/abc.jpg)
    const storageKey = filePath.replace(localRoot + path.sep, "").replace(/\\/g, "/");

    try {
      const [exists] = await bucket.file(storageKey).exists();
      if (exists) {
        console.log(`  ⏭️  Skip (already exists): ${storageKey}`);
        skipped++;
        continue;
      }

      // Read local file and detect content type
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentTypeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
      };
      const contentType = contentTypeMap[ext] || "application/octet-stream";

      await bucket.file(storageKey).save(buffer, { metadata: { contentType } });
      console.log(`  ✅ Uploaded: ${storageKey}`);
      uploaded++;
    } catch (err: any) {
      console.error(`  ❌ Failed: ${storageKey} — ${err?.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 Migration complete!`);
  console.log(`   Uploaded : ${uploaded}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Failed   : ${failed}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
