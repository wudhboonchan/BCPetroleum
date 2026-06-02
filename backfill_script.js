const supabase = require('./config/supabase');

async function backfillTransactions() {
    const paymentIds = [21, 22, 23];
    
    // 1. Get a valid user ID (admin)
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .single();
        
    if (userError || !user) {
        console.error('Could not find a valid admin user:', userError);
        return;
    }
    
    const validUserId = user.id;
    console.log('Using User ID:', validUserId);

    console.log('Starting backfill for IDs:', paymentIds);

    const { data: payments, error } = await supabase
        .from('credit_cash_payments')
        .select(`
            *,
            customers (name)
        `)
        .in('id', paymentIds);

    if (error) {
        console.error('Error fetching payments:', error);
        return;
    }

    const transactions = payments.map(p => ({
        date: p.date,
        transaction_type: 'customer_payment',
        category: 'Payment',
        description: `รับชำระเงินจาก ${p.customers?.name || 'ลูกค้า'}`,
        amount: p.amount,
        payment_method: p.payment_method || 'cash',
        account_type: (p.payment_method || 'cash') === 'transfer' ? 'bank' : 'cash',
        customer_id: p.customer_id,
        source: 'credit_payment_confirm',
        source_id: p.id,
        user_id: validUserId // Use VALID user_id
    }));

    console.log('Inserting transactions...');

    const { data, error: insertError } = await supabase
        .from('account_transactions')
        .insert(transactions)
        .select();

    if (insertError) {
        console.error('Backfill failed:', insertError);
    } else {
        console.log('Backfill successful!');
        console.log('Inserted IDs:', data.map(d => d.id));
        
        // Also update them to be confirmed
        await supabase
            .from('credit_cash_payments')
            .update({ is_confirmed: true })
            .in('id', paymentIds);
            
        console.log('Ensured payments are marked confirmed.');
    }
}

backfillTransactions();
