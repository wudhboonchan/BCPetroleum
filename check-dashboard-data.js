const supabase = require('./config/supabase');

async function checkDashboardData() {
    try {
        console.log('=== Checking Dashboard API Data ===\n');
        
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        console.log('Date range:', sevenDaysAgo, 'to', today);
        console.log('');
        
        // Check what the API is querying
        console.log('1. Testing API query (with total_sales, total_profit, total_liters):');
        const { data: apiQuery, error: apiError } = await supabase
            .from('daily_records')
            .select('date, total_sales, total_profit, total_liters')
            .gte('date', sevenDaysAgo)
            .lte('date', today)
            .order('date', { ascending: true });
        
        if (apiError) {
            console.log('❌ API Query Error:', apiError.message);
        } else {
            console.log('✅ API Query Result:', apiQuery);
        }
        console.log('');
        
        // Check all data with all columns
        console.log('2. Getting all records with ALL columns:');
        const { data: allData, error: allError } = await supabase
            .from('daily_records')
            .select('*')
            .gte('date', sevenDaysAgo)
            .lte('date', today)
            .order('date', { ascending: true });
        
        if (allError) {
            console.log('❌ Error:', allError.message);
        } else {
            console.log('✅ Found', allData.length, 'records');
            if (allData.length > 0) {
                console.log('Sample record columns:', Object.keys(allData[0]));
                console.log('First record:', JSON.stringify(allData[0], null, 2));
            }
        }
        console.log('');
        
        // Check table schema
        console.log('3. Checking if calculated columns exist:');
        if (allData && allData.length > 0) {
            const firstRecord = allData[0];
            console.log('Has total_sales column?', 'total_sales' in firstRecord);
            console.log('Has total_profit column?', 'total_profit' in firstRecord);
            console.log('Has total_liters column?', 'total_liters' in firstRecord);
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkDashboardData();
