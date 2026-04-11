/**
 * Debug Script: Check Thumbnail URLs
 */

import 'dotenv/config';
import { pool } from '../src/common/db';
import { getMediaConfig } from '../src/config/media.config';

async function checkThumbnails() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Thumbnail URLs\n');
    
    // Get media config
    const mediaCfg = getMediaConfig();
    console.log('1️⃣ Media Config:');
    console.log(`   APP_BASE_URL: ${mediaCfg.appBaseUrl}`);
    
    // Get reported content
    console.log('\n2️⃣ Reported Content:');
    const content = await client.query(`
      SELECT c.id, c.title, c.thumbnail_url, c.thumbnail_storage_key, c.storage_provider, c.status, c.report_count
      FROM content_items c
      WHERE (UPPER(COALESCE(c.status, '')) = 'FLAGGED' OR c.report_count > 0)
        AND UPPER(COALESCE(c.status, '')) != 'DELETED'
      ORDER BY c.created_at DESC
    `);
    
    const baseUrl = mediaCfg.appBaseUrl.replace(/\/$/, "");
    
    content.rows.forEach(c => {
      const thumbnailKey = c.thumbnail_storage_key || c.thumbnail_url;
      let finalUrl = null;
      
      if (c.thumbnail_url && (c.thumbnail_url.startsWith("http://") || c.thumbnail_url.startsWith("https://"))) {
        finalUrl = c.thumbnail_url;
      } else if (thumbnailKey) {
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if (cloudName && !thumbnailKey.startsWith("http")) {
          finalUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${thumbnailKey}`;
        } else {
          finalUrl = thumbnailKey;
        }
      }
      
      console.log(`\n   📄 "${c.title}"`);
      console.log(`   Raw thumbnail_url: ${c.thumbnail_url}`);
      console.log(`   Raw thumbnail_storage_key: ${c.thumbnail_storage_key}`);
      console.log(`   Storage provider: ${c.storage_provider}`);
      console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET'}`);
      console.log(`   Constructed URL: ${finalUrl}`);
    });
    
    // Check if URLs are accessible
    console.log('\n3️⃣ Testing URL accessibility...');
    
    console.log('\n✅ Check complete!');
    
  } catch (err: any) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkThumbnails();
