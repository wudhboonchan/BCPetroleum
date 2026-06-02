const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function debugData() {
    console.log('--- Debugging Data Types ---');

    // 1. Fetch Customers
    const { data: customers, error: cError } = await supabase
        .from('customers')
        .select('id, name')
        .limit(3);

    if (cError) console.error('Customers Error:', cError);
    else {
        console.log('Customers Sample:', customers);
        if (customers.length > 0) {
            console.log('Customer ID Type:', typeof customers[0].id);
        }
    }

    // 2. Fetch Unpaid Credit Sales
    const { data: sales, error: sError } = await supabase
        .from('credit_sales')
        .select('id, customer_id, amount')
        .eq('paid', false)
        .limit(3);

    if (sError) console.error('Sales Error:', sError);
    else {
        console.log('Unpaid Sales Sample:', sales);
        if (sales.length > 0) {
            console.log('Sale Customer_ID Type:', typeof sales[0].customer_id);
            console.log('Sale Amount Type:', typeof sales[0].amount);
        }
    }

    // 3. Test Matching
    if (customers && sales && sales.length > 0) {
        const sampleSale = sales[0];
        const match = customers.find(c => c.id == sampleSale.customer_id); // Loose
        const strictMatch = customers.find(c => c.id === sampleSale.customer_id); // Strict
        console.log(`Matching sale customer_id ${sampleSale.customer_id}:`);
        console.log(`- Loose match (==): ${!!match}`);
        console.log(`- Strict match (===): ${!!strictMatch}`);
    }
}

debugData();
