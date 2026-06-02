-- ==================================================
-- FIX: REMOVE FAKE SALES DATA (CLEANUP SCRIPT)
-- ==================================================

-- This script deletes the daily records for the last 7 days 
-- to remove the high/incorrect values introduced by the seed script.
-- After running this, the dashboard will show 0 or no data until
-- Real data is entered via the "Daily Management" page.

DELETE FROM daily_records 
WHERE date >= CURRENT_DATE - INTERVAL '7 days';

-- Optional: Verify the data is gone
SELECT * FROM daily_records WHERE date >= CURRENT_DATE - INTERVAL '7 days';
