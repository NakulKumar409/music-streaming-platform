require('dotenv').config();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Redis = require('ioredis');

async function run() {
  console.log("=== End-to-End Success Test: TEST_UPLOAD (Truncated Secret Check) ===");
  
  const connectionString = 'postgresql://neondb_owner:npg_xP6R4KpYIEGV@ep-little-sunset-aiysaj7x-pooler.c-4.us-east-1.aws.neon.tech/neondb?uselibpqcompat=true&sslmode=require';
  const pool = new Pool({ connectionString });
  
  // Truncated secret as used by the backend currently due to .env parsing bug
  const secret = "MusicPlatform_SuperSecure_Admin_Key_2026_!@";

  const artistId = 10; 
  const token = jwt.sign(
    { id: artistId, role: 'ARTIST' },
    secret
  );
  
  const formData = new FormData();
  formData.append('title', 'TEST_UPLOAD');
  formData.append('genre', 'Testing');
  formData.append('type', 'AUDIO_VIDEO');
  formData.append('thumbnail', new Blob(['fake'], { type: 'image/jpeg' }), 'test_thumb.jpg');
  formData.append('audio', new Blob(['fake'], { type: 'audio/mpeg' }), 'test_audio.mp3');
  formData.append('video', new Blob(['fake'], { type: 'video/mp4' }), 'test_video.mp4');

  console.log("Triggering API upload with truncated secret...");
  const uploadRes = await fetch('http://localhost:8000/api/v1/content/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  const uploadData = await uploadRes.json();
  console.log("API Response:", JSON.stringify(uploadData));
  
  await pool.end();
}
run().catch(console.error);
