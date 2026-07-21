const { requestPlaybackAccess } = require('../src/modules/media/media-access.service');
const { pool } = require('../src/common/db');

async function run() {
  console.log('Testing requestPlaybackAccess for content ID 1...');
  try {
    const result = await requestPlaybackAccess({
      contentId: 1,
      userId: 1, // Let's pass a dummy userId
      kind: 'video',
      quality: 'Auto',
      allowPreview: true
    });
    console.log('✅ Success! Result:', result);
  } catch (error) {
    console.error('❌ Failed:', error.stack || error.message);
  } finally {
    await pool.end();
  }
}

run();
