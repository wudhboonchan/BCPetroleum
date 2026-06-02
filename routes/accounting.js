// Accounting Management Routes
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all accounting routes
router.use(authMiddleware);

// ============================================================================
// TRANSACTIONS
// ============================================================================

// Get all transactions for a specific date
router.get('/transactions/:date', async (req, res) => {
    try {
        const { date } = req.params;

        const { data, error } = await supabase
            .from('account_transactions')
            .select(`
                *,
                customer:customers(id, name, code)
            `)
            .eq('date', date)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ transactions: data || [] });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new transaction
router.post('/transaction', async (req, res) => {
    try {
        const {
            date,
            transaction_type,
            category,
            description,
            amount,
            payment_method,
            account_type,
            customer_id
        } = req.body;

        const { data, error } = await supabase
            .from('account_transactions')
            .insert([{
                date,
                transaction_type,
                category,
                description,
                amount,
                payment_method,
                account_type,
                customer_id,
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        res.json({ transaction: data });
    } catch (error) {
        console.error('Create transaction error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete transaction
router.delete('/transaction/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('account_transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// FUEL INVESTMENTS
// ============================================================================

// Get fuel investments for a specific date
router.get('/fuel-investments/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { status } = req.query;

        let query = supabase
            .from('fuel_investments')
            .select('*');

        if (status === 'unpaid') {
            // Get all unpaid/partial investments up to this date
            query = query
                .lte('date', date)
                .in('payment_status', ['unpaid', 'partial']);
        } else {
            // Default: Get only for specific date
            query = query.eq('date', date);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ investments: data || [] });
    } catch (error) {
        console.error('Get fuel investments error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create fuel investment
router.post('/fuel-investment', async (req, res) => {
    try {
        const {
            date,
            fuel_type,
            liters,
            cost_per_liter,
            payment_status,
            payment_method,
            note
        } = req.body;

        const total_cost = parseFloat(liters) * parseFloat(cost_per_liter);
        const paid_amount = payment_status === 'paid' ? total_cost : 0;
        const remaining_amount = total_cost - paid_amount;

        const { data, error } = await supabase
            .from('fuel_investments')
            .insert([{
                date,
                fuel_type,
                liters,
                cost_per_liter,
                total_cost,
                payment_status,
                payment_method,
                paid_amount,
                remaining_amount,
                note,
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        // Create account transaction entry for unpaid amount (increases receivables)
        if (remaining_amount > 0) {
            const descriptionParts = [`ลงทุนน้ำมัน ${fuel_type.toUpperCase()} ${liters} ลิตร @ ฿${cost_per_liter}/ลิตร`];
            if (note) descriptionParts.push(`(${note})`);

            await supabase
                .from('account_transactions')
                .insert([{
                    date,
                    transaction_type: 'fuel_investment',
                    category: 'Fuel Investment',
                    description: descriptionParts.join(' '),
                    amount: remaining_amount, // Positive amount increases receivables
                    payment_method: null,
                    account_type: 'receivables',
                    created_by: req.user.id
                }]);
        }

        // If paid immediately, create expense transaction from cash/bank
        if (paid_amount > 0 && payment_method) {
            const account_type = payment_method === 'cash' ? 'cash' : 'bank';
            await supabase
                .from('account_transactions')
                .insert([{
                    date,
                    transaction_type: 'fuel_payment',
                    category: 'Fuel Investment',
                    description: `จ่ายค่าน้ำมัน ${fuel_type} ${liters} ลิตร @ ฿${Number(cost_per_liter).toFixed(2)}/ลิตร`,
                    amount: -paid_amount, // Negative amount decreases cash/bank
                    payment_method,
                    account_type,
                    created_by: req.user.id
                }]);
        }

        res.json({ investment: data });
    } catch (error) {
        console.error('Create fuel investment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update fuel investment payment
router.patch('/fuel-investment/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_amount, payment_method } = req.body;

        // Get current investment
        const { data: investment, error: fetchError } = await supabase
            .from('fuel_investments')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const new_paid_amount = parseFloat(investment.paid_amount) + parseFloat(payment_amount);
        const new_remaining = investment.total_cost - new_paid_amount;
        const new_status = new_remaining <= 0 ? 'paid' : (new_paid_amount > 0 ? 'partial' : 'unpaid');

        const { data, error } = await supabase
            .from('fuel_investments')
            .update({
                paid_amount: new_paid_amount,
                remaining_amount: new_remaining,
                payment_status: new_status,
                payment_method: new_status === 'paid' ? payment_method : investment.payment_method,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Create an account transaction for the payment
        if (payment_amount > 0) {
            const account_type = payment_method === 'cash' ? 'cash' : 'bank'; // Assuming 'bank' for other methods
            const { error: transactionError } = await supabase
                .from('account_transactions')
                .insert([{
                    date: new Date().toISOString().split('T')[0], // Use current date for payment transaction
                    transaction_type: 'expense',
                    category: 'fuel',
                    description: `Fuel Investment Payment - ID: ${id}`,
                    amount: -parseFloat(payment_amount), // Negative for expense
                    payment_method,
                    account_type,
                    created_by: req.user.id
                }]);

            if (transactionError) {
                console.error('Error creating associated account transaction for fuel investment payment:', transactionError);
            }
        }

        res.json({ investment: data });
    } catch (error) {
        console.error('Update fuel investment payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete fuel investment
router.delete('/fuel-investment/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('fuel_investments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Fuel investment deleted successfully' });
    } catch (error) {
        console.error('Delete fuel investment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// WATER INVESTMENTS
// ============================================================================

// Get water investments for a specific date
router.get('/water-investments/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { status } = req.query;

        let query = supabase
            .from('water_investments')
            .select('*');

        if (status === 'unpaid') {
            // Get all unpaid/partial investments up to this date
            query = query
                .lte('date', date)
                .in('payment_status', ['unpaid', 'partial']);
        } else {
            // Default: Get only for specific date
            query = query.eq('date', date);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ investments: data || [] });
    } catch (error) {
        console.error('Get water investments error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create water investment
router.post('/water-investment', async (req, res) => {
    try {
        const {
            date,
            packs,
            cost_per_pack,
            note
        } = req.body;

        const total_cost = parseInt(packs) * parseFloat(cost_per_pack || 60);
        const remaining_amount = total_cost; // Always unpaid initially

        const { data, error } = await supabase
            .from('water_investments')
            .insert([{
                date,
                packs,
                cost_per_pack: cost_per_pack || 60,
                total_cost,
                payment_status: 'unpaid',
                paid_amount: 0,
                remaining_amount,
                note,
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        // Create account transaction entry (increases receivables)
        const descriptionParts = [`น้ำดื่มสมนาคุณ ${packs} แพ็ค @ ฿${cost_per_pack || 60}/แพ็ค`];
        if (note) descriptionParts.push(`(${note})`);

        await supabase
            .from('account_transactions')
            .insert([{
                date,
                transaction_type: 'water_investment',
                category: 'Water Investment',
                description: descriptionParts.join(' '),
                amount: total_cost, // Positive amount increases receivables
                payment_method: null,
                account_type: 'receivables',
                created_by: req.user.id
            }]);

        res.json({ investment: data });
    } catch (error) {
        console.error('Create water investment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update water investment payment
router.patch('/water-investment/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_amount } = req.body;

        // Get current investment
        const { data: investment, error: fetchError } = await supabase
            .from('water_investments')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const new_paid_amount = parseFloat(investment.paid_amount) + parseFloat(payment_amount);
        const new_remaining = investment.total_cost - new_paid_amount;
        const new_status = new_remaining <= 0 ? 'paid' : (new_paid_amount > 0 ? 'partial' : 'unpaid');

        const { data, error } = await supabase
            .from('water_investments')
            .update({
                paid_amount: new_paid_amount,
                remaining_amount: new_remaining,
                payment_status: new_status,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ investment: data });
    } catch (error) {
        console.error('Update water investment payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete water investment
router.delete('/water-investment/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('water_investments')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Water investment deleted successfully' });
    } catch (error) {
        console.error('Delete water investment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// LOANS (Temporary Borrowing)
// ============================================================================

// Get loans
router.get('/loans/:date', async (req, res) => {
    try {
        const { date } = req.params;
        const { status } = req.query;

        let query = supabase
            .from('loans')
            .select('*');

        if (status === 'unpaid') {
            // Get all unpaid/partial loans up to this date
            query = query
                .lte('date', date)
                .in('payment_status', ['unpaid', 'partial']);
        } else {
            // Default: Get only for specific date
            query = query.eq('date', date);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ loans: data || [] });
    } catch (error) {
        console.error('Get loans error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create loan
router.post('/loan', async (req, res) => {
    try {
        const {
            date,
            description,
            amount,
            account_type, // 'cash' or 'bank'
            note
        } = req.body;

        const loanAmount = parseFloat(amount);
        if (loanAmount <= 0) {
            return res.status(400).json({ error: 'Amount must be greater than 0' });
        }

        // Create loan record
        const { data, error } = await supabase
            .from('loans')
            .insert([{
                date,
                description,
                amount: loanAmount,
                account_type,
                payment_status: 'unpaid',
                paid_amount: 0,
                remaining_amount: loanAmount,
                note,
                created_by: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;

        // Create account transaction: Add money to the selected account (cash/bank)
        const descParts = [`เงินกู้ยืม: ${description}`];
        if (note) descParts.push(`(${note})`);

        await supabase
            .from('account_transactions')
            .insert([{
                date,
                transaction_type: 'loan_received',
                category: 'Loan',
                description: descParts.join(' '),
                amount: loanAmount, // Positive: money comes IN to account
                payment_method: null,
                account_type: account_type, // 'cash' or 'bank'
                created_by: req.user.id
            }]);

        // Create receivables transaction: Increase receivables (we owe this money)
        await supabase
            .from('account_transactions')
            .insert([{
                date,
                transaction_type: 'loan_received',
                category: 'Loan',
                description: descParts.join(' '),
                amount: loanAmount, // Positive: increases receivables balance
                payment_method: null,
                account_type: 'receivables',
                created_by: req.user.id
            }]);

        res.json({ loan: data });
    } catch (error) {
        console.error('Create loan error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update loan payment
router.patch('/loan/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_amount, payment_method } = req.body;

        // Get current loan
        const { data: loan, error: fetchError } = await supabase
            .from('loans')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const new_paid_amount = parseFloat(loan.paid_amount) + parseFloat(payment_amount);
        const new_remaining = loan.amount - new_paid_amount;
        const new_status = new_remaining <= 0 ? 'paid' : (new_paid_amount > 0 ? 'partial' : 'unpaid');

        const { data, error } = await supabase
            .from('loans')
            .update({
                paid_amount: new_paid_amount,
                remaining_amount: new_remaining,
                payment_status: new_status,
                updated_at: new Date()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ loan: data });
    } catch (error) {
        console.error('Update loan payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete loan
router.delete('/loan/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('loans')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Loan deleted successfully' });
    } catch (error) {
        console.error('Delete loan error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// BALANCES & SUMMARY
// ============================================================================

// Get consolidated accounting summary (Transactions + Balances) - OPTIMIZED PARALLEL
router.get('/summary/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // Execute all queries in parallel
        const [
            transListRes,
            balanceTransRes,
            fuelInvRes,
            waterInvRes,
            loanRes,
            creditSalesRes
        ] = await Promise.all([
            // 1. Transactions List for the specific date
            supabase
                .from('account_transactions')
                .select('*, customer:customers(id, name, code)')
                .eq('date', date)
                .order('created_at', { ascending: false }),

            // 2. Transactions for Balance Calc (Cumulative <= date)
            supabase
                .from('account_transactions')
                .select('account_type, amount')
                .lte('date', date),

            // 3. Fuel Investments for Receivables (unpaid/partial <= date)
            supabase
                .from('fuel_investments')
                .select('remaining_amount')
                .lte('date', date)
                .in('payment_status', ['unpaid', 'partial']),

            // 4. Water Investments for Receivables (unpaid/partial <= date)
            supabase
                .from('water_investments')
                .select('remaining_amount')
                .lte('date', date)
                .in('payment_status', ['unpaid', 'partial']),

            // 5. Loans for Receivables (unpaid/partial <= date)
            supabase
                .from('loans')
                .select('remaining_amount')
                .lte('date', date)
                .in('payment_status', ['unpaid', 'partial']),

            // 6. Credit Sales for Payables (unpaid <= date)
            supabase
                .from('credit_sales')
                .select('amount')
                .lte('date', date)
                .eq('paid', false)
        ]);

        // Process Transactions List
        const transactions = transListRes.data || [];

        // Process Balances
        let cash_balance = 0;
        let profit_balance = 0;
        let bank_balance = 0;

        (balanceTransRes.data || []).forEach(t => {
            const amount = parseFloat(t.amount);
            if (t.account_type === 'cash') cash_balance += amount;
            else if (t.account_type === 'profit') profit_balance += amount;
            else if (t.account_type === 'bank') bank_balance += amount;
        });

        const fuel_receivables = (fuelInvRes.data || []).reduce((sum, f) => sum + parseFloat(f.remaining_amount || 0), 0);
        const water_receivables = (waterInvRes.data || []).reduce((sum, w) => sum + parseFloat(w.remaining_amount || 0), 0);
        const loan_receivables = (loanRes.data || []).reduce((sum, l) => sum + parseFloat(l.remaining_amount || 0), 0);
        const total_receivables = fuel_receivables + water_receivables + loan_receivables;

        const total_payables = (creditSalesRes.data || []).reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

        res.json({
            transactions,
            balances: {
                cash_balance,
                profit_balance,
                bank_balance,
                total_receivables,
                total_payables
            }
        });

    } catch (error) {
        console.error('Get accounting summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get account balances for a specific date (Legacy - kept for compatibility)
router.get('/balances/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // Calculate CUMULATIVE balances from all transactions up to this date
        const { data: transactions, error: transError } = await supabase
            .from('account_transactions')
            .select('account_type, amount')
            .lte('date', date);

        if (transError) throw transError;

        // Calculate loan receivables (cumulative unpaid amounts)
        const { data: loanData, error: loanError } = await supabase
            .from('loans')
            .select('remaining_amount')
            .lte('date', date)
            .in('payment_status', ['unpaid', 'partial']);

        if (loanError) throw loanError;

        // Calculate fuel investment receivables (cumulative unpaid amounts) - fuel on consignment
        const { data: fuelInvestments, error: fuelError } = await supabase
            .from('fuel_investments')
            .select('remaining_amount')
            .lte('date', date)
            .in('payment_status', ['unpaid', 'partial']);

        if (fuelError) throw fuelError;

        // Calculate water investment receivables (cumulative unpaid amounts) - water on consignment
        const { data: waterInvestments, error: waterError } = await supabase
            .from('water_investments')
            .select('remaining_amount')
            .lte('date', date)
            .in('payment_status', ['unpaid', 'partial']);

        if (waterError) throw waterError;

        // Get credit sales (cumulative payables from customers)
        const { data: creditSales, error: creditError } = await supabase
            .from('credit_sales')
            .select('amount')
            .lte('date', date)
            .eq('paid', false);

        if (creditError) throw creditError;

        // Calculate balances
        let cash_balance = 0;
        let profit_balance = 0;
        let bank_balance = 0;

        transactions?.forEach(t => {
            const amount = parseFloat(t.amount);
            if (t.account_type === 'cash') cash_balance += amount;
            else if (t.account_type === 'profit') profit_balance += amount;
            else if (t.account_type === 'bank') bank_balance += amount;
        });

        const fuel_receivables = fuelInvestments?.reduce((sum, f) => sum + parseFloat(f.remaining_amount || 0), 0) || 0;
        const water_receivables = waterInvestments?.reduce((sum, w) => sum + parseFloat(w.remaining_amount || 0), 0) || 0;
        const loan_receivables_total = loanData?.reduce((sum, l) => sum + parseFloat(l.remaining_amount || 0), 0) || 0;
        const total_receivables = fuel_receivables + water_receivables + loan_receivables_total;
        const credit_payables = creditSales?.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) || 0;
        const total_payables = credit_payables;

        res.json({
            balances: {
                cash_balance,
                profit_balance,
                bank_balance,
                total_receivables,
                total_payables
            }
        });
    } catch (error) {
        console.error('Get balances error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get receivables summary
router.get('/receivables/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // Fuel investment receivables
        const { data: fuelData, error: fuelError } = await supabase
            .from('fuel_investments')
            .select('*')
            .lte('date', date)
            .in('payment_status', ['unpaid', 'partial']);

        if (fuelError) throw fuelError;

        // Water investment receivables
        const { data: waterData, error: waterError } = await supabase
            .from('water_investments')
            .select('*')
            .lte('date', date)
            .in('payment_status', ['unpaid', 'partial']);

        if (waterError) throw waterError;

        // Loan receivables
        const { data: loanData, error: loanError } = await supabase
            .from('loans')
            .select('*')
            .lte('date', date)
            .in('payment_status', ['unpaid', 'partial']);

        if (loanError) throw loanError;

        const fuel_total = fuelData?.reduce((sum, f) => sum + parseFloat(f.remaining_amount || 0), 0) || 0;
        const water_total = waterData?.reduce((sum, w) => sum + parseFloat(w.remaining_amount || 0), 0) || 0;
        const loan_total = loanData?.reduce((sum, l) => sum + parseFloat(l.remaining_amount || 0), 0) || 0;

        res.json({
            receivables: {
                fuel: fuelData || [],
                water: waterData || [],
                loan: loanData || [],
                fuel_total,
                water_total,
                loan_total,
                total: fuel_total + water_total + loan_total
            }
        });
    } catch (error) {
        console.error('Get receivables error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get payables summary (all unpaid credit sales)
router.get('/payables/:date', async (req, res) => {
    try {

        // Fetch ALL unpaid credit sales (not just for this date)
        const { data: creditData, error: creditError } = await supabase
            .from('credit_sales')
            .select(`
                *,
                customer:customers(id, name, code)
            `)
            .eq('paid', false)
            .order('date', { ascending: false });

        if (creditError) throw creditError;

        // Group by date and customer
        const grouped = {};
        (creditData || []).forEach(sale => {
            const dateKey = sale.date;
            if (!grouped[dateKey]) {
                grouped[dateKey] = {};
            }

            const customerId = sale.customer_id;
            if (!grouped[dateKey][customerId]) {
                grouped[dateKey][customerId] = {
                    date: sale.date,
                    customer_id: customerId,
                    customer: sale.customer,
                    total_amount: 0,
                    bill_count: 0,
                    bills: []
                };
            }

            grouped[dateKey][customerId].total_amount += parseFloat(sale.amount);
            grouped[dateKey][customerId].bill_count += 1;
            grouped[dateKey][customerId].bills.push(sale);
        });

        // Flatten to array
        const creditGrouped = [];
        Object.values(grouped).forEach(dateGroup => {
            creditGrouped.push(...Object.values(dateGroup));
        });

        const credit_total = creditData?.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) || 0;

        res.json({
            payables: {
                credit: creditGrouped,
                credit_total,
                total: credit_total
            }
        });
    } catch (error) {
        console.error('Get payables error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get detailed transactions for a specific account
router.get('/account-details/:account/:date', async (req, res) => {
    try {
        const { account, date } = req.params;

        const { data, error } = await supabase
            .from('account_transactions')
            .select(`
                *,
                customer:customers(name, code)
            `)
            .eq('account_type', account)
            .lte('date', date)
            .order('date', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw error;

        let transactions = data || [];

        // For bank account, sort to put credits (deposits) before debits (withdrawals) on same date
        // This prevents negative balance display
        if (account === 'bank') {
            transactions.sort((a, b) => {
                // First sort by date
                const dateCompare = new Date(a.date) - new Date(b.date);
                if (dateCompare !== 0) return dateCompare;

                // On same date: credits (positive amounts) come first
                const aAmount = parseFloat(a.amount);
                const bAmount = parseFloat(b.amount);

                // If one is credit and one is debit, credit comes first
                if (aAmount > 0 && bAmount < 0) return -1;
                if (aAmount < 0 && bAmount > 0) return 1;

                // Otherwise maintain created_at order
                return new Date(a.created_at) - new Date(b.created_at);
            });
        }

        // Calculate running balance
        let runningBalance = 0;
        const transactionsWithBalance = transactions.map(t => {
            runningBalance += parseFloat(t.amount);
            return {
                ...t,
                running_balance: runningBalance
            };
        });

        res.json({ transactions: transactionsWithBalance });
    } catch (error) {
        console.error('Get account details error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Pay debt (fuel or water investment)
router.post('/pay-debt', async (req, res) => {
    try {
        const {
            date,
            debt_type,      // 'fuel', 'water', or 'loan'
            debt_id,        // ID of fuel_investment, water_investment, or loan
            payment_amount,
            payment_account, // 'cash' or 'bank'
            note
        } = req.body;

        const amount = parseFloat(payment_amount);
        if (amount <= 0) {
            return res.status(400).json({ error: 'Payment amount must be greater than 0' });
        }

        const table = debt_type === 'fuel' ? 'fuel_investments' : (debt_type === 'water' ? 'water_investments' : 'loans');
        const account_type_debt = 'receivables'; // fuel, water and loan are all receivables

        // Get current debt record
        const { data: debt, error: fetchError } = await supabase
            .from(table)
            .select('*')
            .eq('id', debt_id)
            .single();

        if (fetchError) throw fetchError;
        if (!debt) return res.status(404).json({ error: 'Debt not found' });

        // Calculate new amounts
        const new_paid_amount = parseFloat(debt.paid_amount || 0) + amount;
        const total_amount = debt_type === 'loan' ? parseFloat(debt.amount) : parseFloat(debt.total_cost);
        const new_remaining = total_amount - new_paid_amount;
        const new_status = new_remaining <= 0 ? 'paid' : (new_paid_amount > 0 ? 'partial' : 'unpaid');

        if (amount > parseFloat(debt.remaining_amount)) {
            return res.status(400).json({ error: 'Payment amount exceeds remaining debt' });
        }

        // Update debt record
        const { data: updatedDebt, error: updateError } = await supabase
            .from(table)
            .update({
                paid_amount: new_paid_amount,
                remaining_amount: new_remaining,
                payment_status: new_status,
                updated_at: new Date()
            })
            .eq('id', debt_id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Create transaction: Deduct from payment account (cash/bank)
        let descParts;
        if (debt_type === 'fuel') {
            descParts = [`จ่ายค่าน้ำมัน ${debt.fuel_type}`];
        } else if (debt_type === 'water') {
            descParts = [`จ่ายค่าน้ำดื่ม ${debt.packs} แพ็ค`];
        } else {
            descParts = [`ชำระเงินกู้ยืม: ${debt.description}`];
        }
        if (note) descParts.push(`(${note})`);

        await supabase
            .from('account_transactions')
            .insert([{
                date,
                transaction_type: 'debt_payment',
                category: debt_type === 'fuel' ? 'Fuel Payment' : (debt_type === 'water' ? 'Water Payment' : 'Loan Payment'),
                description: descParts.join(' '),
                amount: -amount, // Negative to decrease cash/bank
                payment_method: payment_account,
                account_type: payment_account,
                created_by: req.user.id
            }]);

        // Create transaction: Reduce payables/receivables
        await supabase
            .from('account_transactions')
            .insert([{
                date,
                transaction_type: 'debt_payment',
                category: debt_type === 'fuel' ? 'Fuel Payment' : (debt_type === 'water' ? 'Water Payment' : 'Loan Payment'),
                description: `ลดหนี้: ${descParts[0]}`,
                amount: -amount, // Negative to decrease payables/receivables
                payment_method: null,
                account_type: account_type_debt,
                created_by: req.user.id
            }]);

        res.json({
            debt: updatedDebt,
            message: 'Payment recorded successfully'
        });
    } catch (error) {
        console.error('Pay debt error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete transaction with related transactions cleanup
router.delete('/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get the transaction to delete
        const { data: transaction, error: fetchError } = await supabase
            .from('account_transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const relatedTransactions = [transaction];
        const restoredInvestments = [];

        // Find related transactions based on transaction type
        if (transaction.transaction_type === 'fuel_investment') {
            // Find the receivables transaction created at the same time
            const { data: related } = await supabase
                .from('account_transactions')
                .select('*')
                .eq('date', transaction.date)
                .eq('transaction_type', 'fuel_investment')
                .eq('account_type', 'receivables')
                .neq('id', id);

            if (related && related.length > 0) {
                // Match by amount for precision
                const matchAmount = Math.abs(transaction.amount);
                const paired = related.filter(t => Math.abs(t.amount) === matchAmount);
                if (paired.length > 0) {
                    relatedTransactions.push(paired[0]);
                } else {
                    relatedTransactions.push(...related);
                }
            }

            // Extract fuel type and liters from description for precise matching
            const descMatch = transaction.description.match(/ลงทุนน้ำมัน (\w+) ([\d.]+) ลิตร/);

            if (descMatch) {
                const fuel_type = descMatch[1].toLowerCase();
                const liters = parseFloat(descMatch[2]);

                const { data: deletedInvestments, error: deleteInvError } = await supabase
                    .from('fuel_investments')
                    .delete()
                    .eq('date', transaction.date)
                    .eq('fuel_type', fuel_type)
                    .eq('liters', liters)
                    .eq('created_by', transaction.created_by)
                    .select();

                if (!deleteInvError && deletedInvestments && deletedInvestments.length > 0) {
                    deletedInvestments.forEach(inv => {
                        restoredInvestments.push({ type: 'fuel', ...inv });
                    });
                }
            } else {
                // Fallback: match by date, amount (total_cost), and created_by
                const matchAmount = Math.abs(transaction.amount);
                const { data: deletedInvestments, error: deleteInvError } = await supabase
                    .from('fuel_investments')
                    .delete()
                    .eq('date', transaction.date)
                    .eq('total_cost', matchAmount)
                    .eq('created_by', transaction.created_by)
                    .select();

                if (!deleteInvError && deletedInvestments && deletedInvestments.length > 0) {
                    deletedInvestments.forEach(inv => {
                        restoredInvestments.push({ type: 'fuel', ...inv });
                    });
                } else {
                    console.warn('Could not find fuel investment to delete for description:', transaction.description);
                }
            }

        } else if (transaction.transaction_type === 'water_investment') {
            // Find the receivables transaction
            const { data: related } = await supabase
                .from('account_transactions')
                .select('*')
                .eq('date', transaction.date)
                .eq('transaction_type', 'water_investment')
                .eq('account_type', 'receivables')
                .neq('id', id);

            if (related && related.length > 0) {
                const matchAmount = Math.abs(transaction.amount);
                const paired = related.filter(t => Math.abs(t.amount) === matchAmount);
                if (paired.length > 0) {
                    relatedTransactions.push(paired[0]);
                } else {
                    relatedTransactions.push(...related);
                }
            }

            // Extract packs from description for precise matching
            const descMatch = transaction.description.match(/ลงทุนน้ำดื่ม (\d+) แพ็ค/);

            if (descMatch) {
                const packs = parseInt(descMatch[1]);

                const { data: deletedInvestments, error: deleteInvError } = await supabase
                    .from('water_investments')
                    .delete()
                    .eq('date', transaction.date)
                    .eq('packs', packs)
                    .eq('created_by', transaction.created_by)
                    .select();

                if (!deleteInvError && deletedInvestments && deletedInvestments.length > 0) {
                    deletedInvestments.forEach(inv => {
                        restoredInvestments.push({ type: 'water', ...inv });
                    });
                }
            } else {
                // Fallback: match by date, amount (total_cost), and created_by
                const matchAmount = Math.abs(transaction.amount);
                const { data: deletedInvestments, error: deleteInvError } = await supabase
                    .from('water_investments')
                    .delete()
                    .eq('date', transaction.date)
                    .eq('total_cost', matchAmount)
                    .eq('created_by', transaction.created_by)
                    .select();

                if (!deleteInvError && deletedInvestments && deletedInvestments.length > 0) {
                    deletedInvestments.forEach(inv => {
                        restoredInvestments.push({ type: 'water', ...inv });
                    });
                } else {
                    console.warn('Could not find water investment to delete for description:', transaction.description);
                }
            }

        } else if (transaction.transaction_type === 'loan_received') {
            // Find the paired transaction (cash/bank entry + receivables entry)
            const { data: related } = await supabase
                .from('account_transactions')
                .select('*')
                .eq('date', transaction.date)
                .eq('transaction_type', 'loan_received')
                .neq('id', id);

            if (related && related.length > 0) {
                const matchAmount = Math.abs(transaction.amount);
                const paired = related.filter(t => Math.abs(t.amount) === matchAmount);
                if (paired.length > 0) {
                    relatedTransactions.push(paired[0]);
                } else {
                    relatedTransactions.push(...related);
                }
            }

            // Delete corresponding loan record
            const matchAmount = Math.abs(transaction.amount);
            const { data: deletedLoans, error: deleteLoanError } = await supabase
                .from('loans')
                .delete()
                .eq('date', transaction.date)
                .eq('amount', matchAmount)
                .eq('created_by', transaction.created_by)
                .select();

            if (!deleteLoanError && deletedLoans && deletedLoans.length > 0) {
                deletedLoans.forEach(loan => {
                    restoredInvestments.push({ type: 'loan', ...loan });
                });
            }

        } else if (transaction.transaction_type === 'debt_payment') {
            // Find the paired transaction (payment account + receivables reduction)
            const { data: related } = await supabase
                .from('account_transactions')
                .select('*')
                .eq('date', transaction.date)
                .eq('transaction_type', 'debt_payment')
                .neq('id', id);

            if (related && related.length > 0) {
                // Find the one with matching description
                const paired = related.filter(t =>
                    t.description.includes(transaction.description.split(' ')[0]) ||
                    transaction.description.includes(t.description.split(' ')[0])
                );
                relatedTransactions.push(...paired);
            }

            // Restore investment amount
            const amount = Math.abs(transaction.amount);
            const isFuel = transaction.category === 'Fuel Payment';
            const isWater = transaction.category === 'Water Payment';
            const isLoan = transaction.category === 'Loan Payment';
            const table = isFuel ? 'fuel_investments' : (isWater ? 'water_investments' : 'loans');

            // Find the investment to restore
            let investmentQuery = supabase
                .from(table)
                .select('*')
                .order('created_at', { ascending: false });

            if (isLoan) {
                // For loans, match by description content
                investmentQuery = investmentQuery.in('payment_status', ['partial', 'paid']);
            } else {
                investmentQuery = investmentQuery.eq('date', transaction.date);
            }

            const { data: investments } = await investmentQuery.limit(5);

            if (investments && investments.length > 0) {
                // Find the best match - look for one where paid_amount makes sense
                const investment = investments[0];
                const totalField = isLoan ? 'amount' : 'total_cost';
                const newPaidAmount = Math.max(0, parseFloat(investment.paid_amount || 0) - amount);
                const newRemainingAmount = parseFloat(investment[totalField]) - newPaidAmount;
                const newStatus = newPaidAmount === 0 ? 'unpaid' :
                    newRemainingAmount === 0 ? 'paid' : 'partial';

                const { data: restored, error: restoreError } = await supabase
                    .from(table)
                    .update({
                        paid_amount: newPaidAmount,
                        remaining_amount: newRemainingAmount,
                        payment_status: newStatus,
                        updated_at: new Date()
                    })
                    .eq('id', investment.id)
                    .select()
                    .single();

                if (!restoreError && restored) {
                    restoredInvestments.push({
                        type: isFuel ? 'fuel' : (isWater ? 'water' : 'loan'),
                        ...restored
                    });
                }
            }
        } else if (transaction.transaction_type === 'profit_transfer' || transaction.transaction_type === 'deposit_to_bank') {
            // For profit_transfer and deposit_to_bank, find the paired transaction
            // These always come in pairs: one negative (from cash) and one positive (to profit/bank)
            const { data: related } = await supabase
                .from('account_transactions')
                .select('*')
                .eq('date', transaction.date)
                .eq('transaction_type', transaction.transaction_type)
                .neq('id', id);

            if (related && related.length > 0) {
                // Find the matching pair (same amount, different sign)
                const matchingAmount = Math.abs(transaction.amount);
                const paired = related.filter(t => Math.abs(t.amount) === matchingAmount);
                relatedTransactions.push(...paired);
            }
        }

        // Delete all related transactions
        const idsToDelete = relatedTransactions.map(t => t.id);
        const { error: deleteError } = await supabase
            .from('account_transactions')
            .delete()
            .in('id', idsToDelete);

        if (deleteError) throw deleteError;

        res.json({
            deleted_transactions: relatedTransactions,
            restored_investments: restoredInvestments,
            message: 'Transaction(s) deleted successfully'
        });

    } catch (error) {
        console.error('Delete transaction error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
