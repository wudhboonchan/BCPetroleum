const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkSchema() {
    console.log('--- Credit Sales Columns ---');
    const { data, error } = await supabase
        .from('credit_sales')
        .select('*')
        .limit(1);

    if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
    } else {
        console.log('No data found, cannot infer columns.');
    }

    console.log('--- Customers Columns ---');
    const { data: cData } = await supabase.from('customers').select('*').limit(1);
    if (cData && cData.length > 0) console.log(Object.keys(cData[0]));
}

checkSchema();
