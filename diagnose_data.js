const supabase = require('./config/supabase');

async function diagnose() {
    console.log('=== DIAGNOSING DAILY RECORDS ===');
    
    const { data: records, error } = await supabase
        .from('daily_records')
        .select('*')
        .order('date', { ascending: true });

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`Found ${records.length} records.`);
    
    records.forEach(r => {
        const metrics = calculateMetrics(r);
        console.log(`\nDate: ${r.date}`);
        console.log(`Total Sales: ${metrics.totalSales.toFixed(2)}`);
        console.log(`Total Liters: ${metrics.totalLiters.toFixed(2)}`);
        
        // Check for anomalies
        if (metrics.totalSales < 0) console.log('⚠️ NEGATIVE SALES DETECTED');
        
        // Show nozzle breakdown
        console.log('Nozzle Diffs (Today - Yesterday):');
        metrics.nozzles.forEach((val, i) => {
           console.log(`  N${i+1}: ${val.toFixed(2)}`); 
        });
    });
}

function calculateMetrics(record) {
    const prices = {
        e91Cost: parseFloat(record.e91_cost_price) || 0,
        e91Sell: parseFloat(record.e91_sell_price) || 0,
        e95Cost: parseFloat(record.e95_cost_price) || 0,
        e95Sell: parseFloat(record.e95_sell_price) || 0,
        b7Cost: parseFloat(record.b7_cost_price) || 0,
        b7Sell: parseFloat(record.b7_sell_price) || 0,
    };

    const nozzleLiters = [];
    for (let i = 1; i <= 8; i++) {
        const today = parseFloat(record[`nozzle_${i}_today`]) || 0;
        const yesterday = parseFloat(record[`nozzle_${i}_yesterday`]) || 0;
        nozzleLiters.push(today - yesterday);
    }

    const e91Liters = nozzleLiters[0] + nozzleLiters[2];
    const b7Liters = nozzleLiters[1] + nozzleLiters[3] + nozzleLiters[5] + nozzleLiters[7];
    const e95Liters = nozzleLiters[4] + nozzleLiters[6];

    const e91Sales = e91Liters * prices.e91Sell;
    const b7Sales = b7Liters * prices.b7Sell;
    const e95Sales = e95Liters * prices.e95Sell;

    return {
        totalSales: e91Sales + e95Sales + b7Sales,
        totalLiters: e91Liters + e95Liters + b7Liters,
        nozzles: nozzleLiters
    };
}

diagnose();
