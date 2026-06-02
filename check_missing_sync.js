const supabase = require('./config/supabase');

async function checkMissingSync() {
    const today = '2026-01-27'; // Hardcoded based on current time context

    console.log(`Checking for payments on ${today}...`);

    // 1. Get all credit payments for today
    const { data: payments, error } = await supabase
        .from('credit_cash_payments')
        .select(`
            *,
            customers (name)
        `)
        .eq('date', today);

    if (error) {
        console.error('Error fetching payments:', error);
        return;
    }

    console.log(`Found ${payments.length} credit payments for today.`);

    // 2. Check which ones have corresponding account_transactions
    for (const p of payments) {
        const { data: trans } = await supabase
            .from('account_transactions')
            .select('id')
            .eq('source', 'credit_payment_confirm')
            .eq('source_id', p.id);

        const hasSync = trans && trans.length > 0;
        console.log(`Payment ID ${p.id} (${p.amount} THB from ${p.customers?.name}): Synced? ${hasSync ? 'YES' : 'NO'}`);
        
        if (!hasSync) {
            console.log(`--> NEEDS BACKFILL: Payment ID ${p.id}`);
        }
    }
}

checkMissingSync();
