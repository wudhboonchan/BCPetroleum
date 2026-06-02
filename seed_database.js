// Script to seed the database with 7 days of sample data
// Run with: node seed_database.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function seedDatabase() {
  console.log('Starting database seed...');
  
  const today = new Date();
  const records = [];
  
  // Generate 7 days of data
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    // Base meter readings that increase over time
    const baseReading = 10000 + (6 - i) * 700;
    
    // Calculate nozzle readings with realistic progression
    const nozzle1Yesterday = baseReading + (i * 100);
    const nozzle1Today = nozzle1Yesterday + 600 + Math.random() * 100;
    
    const nozzle2Yesterday = baseReading + 200 + (i * 150);
    const nozzle2Today = nozzle2Yesterday + 700 + Math.random() * 100;
    
    const nozzle3Yesterday = baseReading - 200 + (i * 90);
    const nozzle3Today = nozzle3Yesterday + 600 + Math.random() * 100;
    
    const nozzle4Yesterday = baseReading + 100 + (i * 120);
    const nozzle4Today = nozzle4Yesterday + 700 + Math.random() * 100;
    
    const nozzle5Yesterday = baseReading - 300 + (i * 130);
    const nozzle5Today = nozzle5Yesterday + 650 + Math.random() * 100;
    
    const nozzle6Yesterday = baseReading - 100 + (i * 140);
    const nozzle6Today = nozzle6Yesterday + 700 + Math.random() * 100;
    
    const nozzle7Yesterday = baseReading - 400 + (i * 110);
    const nozzle7Today = nozzle7Yesterday + 650 + Math.random() * 100;
    
    const nozzle8Yesterday = baseReading + (i * 125);
    const nozzle8Today = nozzle8Yesterday + 700 + Math.random() * 100;
    
    const record = {
      date: dateStr,
      e91_cost_price: 32.50 + (i < 3 ? 0.25 : 0),
      e91_sell_price: 35.00 + (i < 3 ? 0.25 : 0),
      e95_cost_price: 35.00 + (i < 3 ? 0.25 : 0),
      e95_sell_price: 38.00 + (i < 3 ? 0.25 : 0),
      b7_cost_price: 28.50 + (i < 3 ? 0.25 : 0),
      b7_sell_price: 31.00 + (i < 3 ? 0.25 : 0),
      nozzle_1_today: parseFloat(nozzle1Today.toFixed(3)),
      nozzle_2_today: parseFloat(nozzle2Today.toFixed(3)),
      nozzle_3_today: parseFloat(nozzle3Today.toFixed(3)),
      nozzle_4_today: parseFloat(nozzle4Today.toFixed(3)),
      nozzle_5_today: parseFloat(nozzle5Today.toFixed(3)),
      nozzle_6_today: parseFloat(nozzle6Today.toFixed(3)),
      nozzle_7_today: parseFloat(nozzle7Today.toFixed(3)),
      nozzle_8_today: parseFloat(nozzle8Today.toFixed(3)),
      nozzle_1_yesterday: parseFloat(nozzle1Yesterday.toFixed(3)),
      nozzle_2_yesterday: parseFloat(nozzle2Yesterday.toFixed(3)),
      nozzle_3_yesterday: parseFloat(nozzle3Yesterday.toFixed(3)),
      nozzle_4_yesterday: parseFloat(nozzle4Yesterday.toFixed(3)),
      nozzle_5_yesterday: parseFloat(nozzle5Yesterday.toFixed(3)),
      nozzle_6_yesterday: parseFloat(nozzle6Yesterday.toFixed(3)),
      nozzle_7_yesterday: parseFloat(nozzle7Yesterday.toFixed(3)),
      nozzle_8_yesterday: parseFloat(nozzle8Yesterday.toFixed(3)),
    };
    
    records.push(record);
  }
  
  // Insert records one by one
  for (const record of records) {
    const { data, error } = await supabase
      .from('daily_records')
      .upsert(record, { onConflict: 'date' });
    
    if (error) {
      console.error(`Error inserting record for ${record.date}:`, error);
    } else {
      console.log(`✓ Inserted record for ${record.date}`);
    }
  }
  
  // Verify the data
  console.log('\nVerifying inserted data...');
  const { data: verifyData, error: verifyError } = await supabase
    .from('daily_records')
    .select('date, e91_sell_price, e95_sell_price, b7_sell_price')
    .gte('date', records[0].date)
    .order('date', { ascending: true });
  
  if (verifyError) {
    console.error('Error verifying data:', verifyError);
  } else {
    console.log('\nInserted records:');
    console.table(verifyData);
    console.log(`\n✓ Successfully seeded ${verifyData.length} days of data!`);
  }
}

seedDatabase().catch(console.error);
