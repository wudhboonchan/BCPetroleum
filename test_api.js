const supabase = require('./config/supabase');

async function testApiLogic() {
    console.log('=== TEST DASHBOARD API LOGIC ===');
    
    try {
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        console.log(`Query Range: ${sevenDaysAgo} to ${today}`);

        const { data: weekRecords, error } = await supabase
            .from('daily_records')
            .select('*')
            .gte('date', sevenDaysAgo)
            .lte('date', today)
            .order('date', { ascending: true });

        if (error) {
            console.error('Supabase Error:', error);
            return;
        }

        console.log(`Records Found: ${weekRecords?.length}`);
        
        if (weekRecords?.length > 0) {
             const mapped = weekRecords.map(record => ({
                 date: record.date,
                 raw_nozzle_1: record.nozzle_1_today
             }));
             console.log('Sample Data:', JSON.stringify(mapped, null, 2));
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

testApiLogic();
