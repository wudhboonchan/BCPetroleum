// Debug script to check what the API query is returning
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function debugQuery() {
  const today = new Date().toISOString().split('T')[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  console.log('Today:', today);
  console.log('Seven days ago:', sevenDaysAgo);
  console.log('\nQuerying daily_records...\n');
  
  // Exact same query as in routes/dashboard.js
  const { data: last7Days, error: weekError } = await supabase
    .from('daily_records')
    .select('date, e91_sell_price, e95_sell_price, b7_sell_price')
    .gte('date', sevenDaysAgo)
    .lte('date', today)
    .order('date', { ascending: true });
  
  if (weekError) {
    console.error('Error:', weekError);
  } else {
    console.log('Query result:');
    console.table(last7Days);
    console.log(`\nTotal records returned: ${last7Days?.length || 0}`);
  }
  
  // Also check all records in the table
  console.log('\n--- All records in daily_records table ---');
  const { data: allRecords, error: allError } = await supabase
    .from('daily_records')
    .select('date, e91_sell_price')
    .order('date', { ascending: false });
  
  if (allError) {
    console.error('Error fetching all records:', allError);
  } else {
    console.table(allRecords);
    console.log(`\nTotal records in table: ${allRecords?.length || 0}`);
  }
}

debugQuery().catch(console.error);
