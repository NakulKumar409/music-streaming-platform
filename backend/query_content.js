require('dotenv').config({ path: '.env' });
const { pool } = require('./src/common/db');
pool.query('SELECT type, audio_url, video_url, media_url, storage_key, video_storage_key FROM content_items WHERE title = \'album song\'')
  .then(res => console.log(res.rows))
  .catch(console.error)
  .finally(() => process.exit());
