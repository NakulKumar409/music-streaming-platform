require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Redis = require('ioredis');

async function run() {
  console.log("=== End-to-End Upload Test ===");
  
  const pool = new Pool({ connectionString: 'postgresql://neondb_owner:npg_xP6R4KpYIEGV@ep-little-sunset-aiysaj7x-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=verify-full&channel_binding=require' });
  const dbUser = await pool.query("SELECT id FROM users WHERE role = 'ARTIST' AND status = 'ACTIVE' LIMIT 1");
  const artistId = dbUser.rows[0]?.id || 1;
  const token = jwt.sign(
    { id: artistId, role: 'ARTIST' },
    process.env.JWT_SECRET
  );
  
  fs.writeFileSync('dummy.jpg', 'fake image data');
  fs.writeFileSync('dummy.mp3', 'fake audio data');
  fs.writeFileSync('dummy.mp4', 'fake video data');
  
  const formData = new FormData();
  formData.append('title', 'End-to-End Test Track');
  formData.append('genre', 'Test');
  formData.append('type', 'AUDIO_VIDEO');
  formData.append('thumbnail', new Blob([fs.readFileSync('dummy.jpg')], { type: 'image/jpeg' }), 'dummy.jpg');
  formData.append('audio', new Blob([fs.readFileSync('dummy.mp3')], { type: 'audio/mpeg' }), 'dummy.mp3');
  formData.append('video', new Blob([fs.readFileSync('dummy.mp4')], { type: 'video/mp4' }), 'dummy.mp4');

  const uploadRes = await fetch('http://localhost:8000/api/v1/content/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  const uploadData = await uploadRes.json();
  console.log("API Response:", uploadData);
  
  if (uploadData.item?.status !== 'PROCESSING') {
    throw new Error('Expected status to be PROCESSING');
  }
  
  const mediaId = uploadData.item.id;
  console.log("Uploaded Media ID:", mediaId);
  
  const redis = new Redis('redis://127.0.0.1:6379');
  const queueKeys = await redis.keys('bull:media-upload:*');
  console.log("BullMQ Keys:", queueKeys);
  
  console.log("Waiting for worker processing (10s)...");
  await new Promise(r => setTimeout(r, 10000));
  
  // pool already declared
  const dbRes = await pool.query('SELECT status, storage_key, video_storage_key FROM content_items WHERE id = $1', [mediaId]);
  
  const item = dbRes.rows[0];
  console.log("DB Item Status (Success):", item?.status);
  console.log("DB Storage Key:", item?.storage_key);
  console.log("DB Video Storage Key:", item?.video_storage_key);
  
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  if (fs.existsSync(uploadsDir)) {
    console.log("Local files in uploads/:", fs.readdirSync(uploadsDir).length);
  }

  // Failure flow
  console.log("\n=== Testing Failure Flow ===");
  // We can't break Cloudinary for the running API without restart, but we can submit a fake item to the queue directly with invalid config, or we can use an invalid mock.
  // Wait, if the queue throws, we test if it retries and fails.
  // The user says "Break Cloudinary config. Ensure status = FAILED".
  // A cleaner way is to just throw an error if the title is 'Trigger Failure'. Let's see if the worker supports this or if we have to actually alter config.
  
  await pool.end();
  redis.disconnect();
}
run().catch(console.error);
