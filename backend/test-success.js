require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Redis = require('ioredis');

async function run() {
  console.log("=== End-to-End Success Test: TEST_UPLOAD ===");
  
  const connectionString = 'postgresql://neondb_owner:npg_xP6R4KpYIEGV@ep-little-sunset-aiysaj7x-pooler.c-4.us-east-1.aws.neon.tech/neondb?uselibpqcompat=true&sslmode=require';
  const pool = new Pool({ connectionString });
  
  // Truncated secret that the backend is currently using
  const secret = "MusicPlatform_SuperSecure_Admin_Key_2026_!@";

  // Using ID 2 which we know is an ARTIST and ACTIVE
  const artistId = 2; 

  const token = jwt.sign(
    { id: artistId, role: 'ARTIST' },
    secret
  );
  
  // 2. Prepare test files
  fs.writeFileSync('test_thumb.jpg', 'test thumbnail data');
  fs.writeFileSync('test_audio.mp3', 'test audio data');
  fs.writeFileSync('test_video.mp4', 'test video data');
  
  const formData = new FormData();
  formData.append('title', 'TEST_UPLOAD');
  formData.append('genre', 'Testing');
  formData.append('type', 'AUDIO_VIDEO');
  formData.append('thumbnail', new Blob([fs.readFileSync('test_thumb.jpg')], { type: 'image/jpeg' }), 'test_thumb.jpg');
  formData.append('audio', new Blob([fs.readFileSync('test_audio.mp3')], { type: 'audio/mpeg' }), 'test_audio.mp3');
  formData.append('video', new Blob([fs.readFileSync('test_video.mp4')], { type: 'video/mp4' }), 'test_video.mp4');

  // 3. API Upload
  console.log("Triggering API upload...");
  const uploadRes = await fetch('http://localhost:8000/api/v1/content/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  const uploadData = await uploadRes.json();
  console.log("API Response Status:", uploadData.success);
  if (!uploadData.success || uploadData.item?.status !== 'PROCESSING') {
    throw new Error(`API failed or status not PROCESSING: ${JSON.stringify(uploadData)}`);
  }
  
  const mediaId = uploadData.item.id;
  console.log(`New Media ID: ${mediaId}`);
  
  // 4. Redis Job Check
  const redis = new Redis('redis://127.0.0.1:6379');
  const queueKeys = await redis.keys('bull:media-upload:*');
  console.log("BullMQ Job Presence:", queueKeys.length > 0 ? "YES" : "NO");
  
  // 5. Worker Processing Wait
  console.log("Waiting for worker processing (25s)...");
  await new Promise(r => setTimeout(r, 25000));
  
  // 6. DB Verification
  const dbRes = await pool.query('SELECT status, storage_key, video_storage_key FROM public.content_items WHERE id = $1', [mediaId]);
  const item = dbRes.rows[0];
  console.log("Final DB Status:", item?.status);
  
  if (item?.status === 'PUBLISHED') {
    console.log("✅ SUCCESS: Media processed and status set to PUBLISHED.");
  } else {
    console.warn(`❌ FAILURE: Status is ${item?.status}. Check worker logs.`);
  }

  // 7. Local File Cleanup Check
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    console.log(`Files remaining in public/uploads/: ${files.length}`);
  }
  
  // Cleanup local test files
  fs.unlinkSync('test_thumb.jpg');
  fs.unlinkSync('test_audio.mp3');
  fs.unlinkSync('test_video.mp4');

  await pool.end();
  redis.disconnect();
}
run().catch(console.error);
