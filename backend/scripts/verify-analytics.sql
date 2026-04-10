-- Analytics System Verification Script
-- Run this to check if all tables are correctly set up for analytics

-- 1. Check content_plays table
SELECT 'content_plays table count' as check_name, COUNT(*) as total_records FROM content_plays;

-- 2. Check plays by artist (via content_items join)
SELECT 'plays by artist' as check_name, 
       c.artist_id, 
       u.name as artist_name, 
       COUNT(*) as total_plays
FROM content_plays p
JOIN content_items c ON c.id = p.content_id
JOIN users u ON u.id = c.artist_id
GROUP BY c.artist_id, u.name
ORDER BY total_plays DESC;

-- 3. Check subscriptions by artist
SELECT 'subscriptions by artist' as check_name,
       artist_id,
       COUNT(*) as total_subscribers
FROM subscriptions
WHERE status = 'ACTIVE'
GROUP BY artist_id;

-- 4. Check payments with subscription join (to verify artist linkage)
SELECT 'payments via subscription join' as check_name,
       s.artist_id,
       COUNT(*) as total_payments,
       SUM(p.amount)/100 as total_amount_inr
FROM payments p
JOIN subscriptions s ON s.id = p.subscription_id
WHERE s.type = 'ARTIST'
  AND (UPPER(p.status) = 'SUCCESS' OR UPPER(p.status) = 'PAID' OR UPPER(p.status) = 'CAPTURED')
GROUP BY s.artist_id;

-- 5. Check if payments table has artist_id column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments';

-- 6. Check content_items for artists
SELECT artist_id, COUNT(*) as content_count 
FROM content_items 
GROUP BY artist_id;

-- 7. Verify playback_sessions (source of plays)
SELECT 'playback_sessions count' as check_name, COUNT(*) as total_sessions FROM playback_sessions;

-- 8. Check artist_stats (should be updated by creditArtistEarnings)
SELECT * FROM artist_stats;
