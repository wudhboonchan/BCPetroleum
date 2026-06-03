// Cash Management Routes
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all cash routes
router.use(authMiddleware);

// ============================================
// GET Cash Record for specific date
// ============================================
router.get('/cash/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // Execute all queries in parallel for performance
        const [
            cashRecordRes,
            fuelUsageRes,
            creditPaymentsRes,
            metricsRes,
            dailyRecordRes,
            creditSalesRes
        ] = await Promise.all([
            // 1. Cash Record
            supabase.from('daily_cash_records').select('*').eq('date', date).single(),
            // 2. Personal Fuel Usage
            supabase.from('personal_fuel_usage').select('*').eq('date', date),
            // 3. Credit Cash Payments
            supabase.from('credit_cash_payments').select('*, customer:customers(id, name, code)').eq('date', date),
            // 4. Daily Metrics (for expected sales)
            supabase.from('daily_metrics').select('*').eq('date', date).single(),
            // 5. Daily Records (for Prices)
            supabase.from('daily_records').select('e91_sell_price, e95_sell_price, b7_sell_price').eq('date', date).single(),
            // 6. Credit Sales (for Total Amount)
            supabase.from('credit_sales').select('amount').eq('date', date)
        ]);

        // Calculate Total Credit Sales
        const totalCreditSales = creditSalesRes.data?.reduce((sum, sale) => sum + parseFloat(sale.amount), 0) || 0;

        res.json({
            cashRecord: cashRecordRes.data || null,
            fuelUsage: fuelUsageRes.data || [],
            creditPayments: creditPaymentsRes.data || [],
            metrics: metricsRes.data || {},
            prices: dailyRecordRes.data || {},
            totalCreditSales
        });

    } catch (error) {
        console.error('Get comprehensive cash data error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// POST/UPDATE Cash Record
// ============================================
router.post('/cash', async (req, res) => {
    try {
        const {
            date,
            bills_1000, bills_500, bills_100, bills_50, bills_20,
            coins_10, coins_5, coins_2, coins_1,
            bank_transfer_amount,
            note
        } = req.body;

        const userId = req.user.id;

        // Calculate total counted cash
        const total_counted_cash =
            (bills_1000 || 0) * 1000 +
            (bills_500 || 0) * 500 +
            (bills_100 || 0) * 100 +
            (bills_50 || 0) * 50 +
            (bills_20 || 0) * 20 +
            (coins_10 || 0) * 10 +
            (coins_5 || 0) * 5 +
            (coins_2 || 0) * 2 +
            (coins_1 || 0) * 1;

        const working_change = 1000;
        const net_cash_sales = total_counted_cash - working_change;
        const total_revenue = net_cash_sales + (bank_transfer_amount || 0);

        // Get daily metrics for the date (nozzle sales)
        const { data: metrics, error: metricsError } = await supabase
            .from('daily_metrics')
            .select('total_sales')
            .eq('date', date)
            .single();

        const expected_sales = metrics?.total_sales || 0;

        // Get credit sales for the date
        const { data: creditSales, error: creditError } = await supabase
            .from('credit_sales')
            .select('amount')
            .eq('date', date)
            .eq('paid', false);

        const credit_sales = creditSales?.reduce((sum, sale) => sum + parseFloat(sale.amount), 0) || 0;

        // Get personal fuel usage for the date
        const { data: fuelUsage, error: fuelError } = await supabase
            .from('personal_fuel_usage')
            .select('fuel_type, liters, total_value')
            .eq('date', date);

        const personal_fuel_value = fuelUsage?.reduce((sum, usage) => sum + parseFloat(usage.total_value), 0) || 0;

        // Calculate difference
        // Expected = nozzle sales - credit sales - personal fuel
        // Actual = total revenue (cash + bank transfer)
        const adjusted_expected = expected_sales - credit_sales - personal_fuel_value;
        const difference = total_revenue - adjusted_expected;

        const cashData = {
            date,
            bills_1000: bills_1000 || 0,
            bills_500: bills_500 || 0,
            bills_100: bills_100 || 0,
            bills_50: bills_50 || 0,
            bills_20: bills_20 || 0,
            coins_10: coins_10 || 0,
            coins_5: coins_5 || 0,
            coins_2: coins_2 || 0,
            coins_1: coins_1 || 0,
            total_counted_cash,
            working_change,
            net_cash_sales,
            bank_transfer_amount: bank_transfer_amount || 0,
            total_revenue,
            expected_sales,
            credit_sales,
            personal_fuel_value,
            difference,
            note,
            user_id: userId
        };

        // Upsert (insert or update)
        const { data, error } = await supabase
            .from('daily_cash_records')
            .upsert(cashData, { onConflict: 'date' })
            .select()
            .single();

        if (error) throw error;

        // ============================================
        // AUTO-SYNC: Create account_transactions
        // ============================================

        // Delete existing synced transactions for this date (to handle updates)
        await supabase
            .from('account_transactions')
            .delete()
            .eq('source', 'cash_management')
            .eq('source_id', data.id);

        const transactionsToCreate = [];

        // 1. Cash Sales Transaction
        if (net_cash_sales > 0) {
            transactionsToCreate.push({
                date,
                transaction_type: 'cash_sales',
                category: 'Sales',
                description: 'ขายเงินสด',
                amount: net_cash_sales,
                payment_method: 'cash',
                account_type: 'cash',
                source: 'cash_management',
                source_id: data.id,
                user_id: userId
            });
        }

        // 2. Transfer Sales Transaction
        if (bank_transfer_amount && bank_transfer_amount > 0) {
            transactionsToCreate.push({
                date,
                transaction_type: 'transfer_sales',
                category: 'Sales',
                description: 'ขายเงินโอน',
                amount: bank_transfer_amount,
                payment_method: 'transfer',
                account_type: 'bank',
                source: 'cash_management',
                source_id: data.id,
                user_id: userId
            });
        }

        // Get confirmed credit payments for the day
        const { data: creditPaymentsSync, error: creditSyncError } = await supabase
            .from('credit_cash_payments')
            .select('*, customers(name), invoices(invoice_number)')
            .eq('date', date)
            .eq('is_confirmed', true);

        if (!creditSyncError && creditPaymentsSync && creditPaymentsSync.length > 0) {
            // Collect IDs to clear old transactions
            const paymentIds = creditPaymentsSync.map(p => p.id);

            // Delete existing transactions for these payments (idempotency)
            if (paymentIds.length > 0) {
                await supabase
                    .from('account_transactions')
                    .delete()
                    .eq('source', 'credit_payment_confirm')
                    .in('source_id', paymentIds);
            }

            // Create new transactions
            for (const payment of creditPaymentsSync) {
                let customerNameDisplay = payment.customers?.name || 'ลูกค้า';

                if (customerNameDisplay.includes('รายย่อย') && payment.invoice_id) {
                    const { data: firstBill } = await supabase
                        .from('credit_sales')
                        .select('note')
                        .eq('invoice_id', payment.invoice_id)
                        .order('date', { ascending: true })
                        .limit(1)
                        .single();

                    if (firstBill && firstBill.note) {
                        customerNameDisplay = `${payment.customers.name} (${firstBill.note})`;
                    }
                }

                const invoiceNumberStr = payment.invoices?.invoice_number ? ` - ใบวางบิล ${payment.invoices.invoice_number}` : '';
                const accountType = payment.payment_method === 'transfer' ? 'bank' : 'cash';
                transactionsToCreate.push({
                    date: payment.date,
                    transaction_type: 'customer_payment',
                    category: 'Payment',
                    description: `รับชำระเงินจาก ${customerNameDisplay} (${payment.payment_method === 'transfer' ? 'เงินโอน' : 'เงินสด'})${invoiceNumberStr}`,
                    amount: payment.amount,
                    payment_method: payment.payment_method || 'cash',
                    account_type: accountType,
                    customer_id: payment.customer_id,
                    source: 'credit_payment_confirm',
                    source_id: payment.id,
                    user_id: userId
                });
            }
        }

        // Insert transactions if any
        if (transactionsToCreate.length > 0) {
            const { error: transError } = await supabase
                .from('account_transactions')
                .insert(transactionsToCreate);

            if (transError) {
                console.error('Error creating account transactions:', transError);
                // Don't fail the whole request, just log the error
            }
        }

        // ============================================
        // AUTO PROFIT TRANSFER (After Cash Record is Saved)
        // ============================================
        // This logic runs after saving cash record to automatically calculate
        // and transfer net profit to the profit account, taking into account
        // any personal fuel usage that should be deducted from total profit.

        console.log(`[Profit Transfer] Processing for date: ${date}`);

        // 1. Get daily metrics for total profit (fresh query, no cache)
        const { data: dailyMetrics, error: metricsQueryError } = await supabase
            .from('daily_metrics')
            .select('total_profit')
            .eq('date', date)
            .single();

        console.log(`[Profit Transfer] Daily metrics:`, dailyMetrics);
        console.log(`[Profit Transfer] Query error:`, metricsQueryError);

        if (!metricsQueryError && dailyMetrics && dailyMetrics.total_profit > 0) {
            // 2. Calculate profit deduction from personal fuel usage
            let personalFuelProfitDeduction = 0;

            console.log(`[Profit Transfer] Fuel usage data:`, fuelUsage);
            console.log(`[Profit Transfer] Fuel usage length:`, fuelUsage?.length);

            if (fuelUsage && fuelUsage.length > 0) {
                // Get prices from daily_records
                const { data: dailyRecord, error: pricesError } = await supabase
                    .from('daily_records')
                    .select('e91_cost_price, e91_sell_price, e95_cost_price, e95_sell_price, b7_cost_price, b7_sell_price')
                    .eq('date', date)
                    .single();

                if (!pricesError && dailyRecord) {
                    fuelUsage.forEach(usage => {
                        const fuelType = usage.fuel_type; // 'e91', 'e95', 'b7'
                        const liters = parseFloat(usage.liters) || 0;
                        const costPrice = parseFloat(dailyRecord[`${fuelType}_cost_price`]) || 0;
                        const sellPrice = parseFloat(dailyRecord[`${fuelType}_sell_price`]) || 0;
                        const profitPerLiter = sellPrice - costPrice;
                        personalFuelProfitDeduction += liters * profitPerLiter;
                    });
                }
            }

            // 3. Calculate adjusted profit
            // Net profit = Total profit from nozzles - Profit from personal fuel usage
            const adjustedProfit = dailyMetrics.total_profit - personalFuelProfitDeduction;
            const roundedProfit = Math.round(adjustedProfit);

            console.log(`[Profit Transfer] Calculation:`, {
                totalProfit: dailyMetrics.total_profit,
                personalFuelDeduction: personalFuelProfitDeduction,
                adjustedProfit,
                roundedProfit
            });

            if (roundedProfit > 0) {
                // 4. Delete existing profit transfer for this date (idempotency)
                console.log(`[Profit Transfer] Deleting old profit transfer for date: ${date}`);
                await supabase
                    .from('account_transactions')
                    .delete()
                    .eq('date', date)
                    .eq('source', 'daily_profit_transfer');

                // 5. Create profit transfer transactions
                const profitTransactions = [
                    // Debit from Cash (money out)
                    {
                        date,
                        transaction_type: 'profit_transfer',
                        category: 'Profit Transfer',
                        description: 'หักเก็บกำไรรายวัน (อัตโนมัติ)',
                        amount: -roundedProfit,
                        payment_method: null,
                        account_type: 'cash',
                        source: 'daily_profit_transfer',
                        user_id: userId
                    },
                    // Credit to Profit (money in)
                    {
                        date,
                        transaction_type: 'profit_transfer',
                        category: 'Profit Transfer',
                        description: 'รับกำไรรายวันจากเงินสด (อัตโนมัติ)',
                        amount: roundedProfit,
                        payment_method: null,
                        account_type: 'profit',
                        source: 'daily_profit_transfer',
                        user_id: userId
                    }
                ];

                const { error: profitTransferError } = await supabase
                    .from('account_transactions')
                    .insert(profitTransactions);

                if (profitTransferError) {
                    console.error('[Profit Transfer] Error creating transactions:', profitTransferError);
                    // Don't fail the whole request, just log the error
                } else {
                    console.log(`[Profit Transfer] Successfully created profit transfer of ${roundedProfit} Baht`);
                }
            } else {
                console.log(`[Profit Transfer] Skipped - rounded profit is ${roundedProfit}`);
            }
        } else {
            console.log(`[Profit Transfer] Skipped - no valid daily metrics or profit is 0`);
        }

        res.json({ success: true, data });
    } catch (error) {
        console.error('Save cash record error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// POST Personal Fuel Usage
// ============================================
router.post('/personal-fuel', async (req, res) => {
    try {
        const { date, fuel_type, amount, note } = req.body;
        const userId = req.user.id;

        // Get the price for the fuel type from daily_records
        const { data: dailyRecord, error: priceError } = await supabase
            .from('daily_records')
            .select(`${fuel_type}_sell_price`)
            .eq('date', date)
            .single();

        if (priceError) {
            return res.status(400).json({
                error: `ไม่พบข้อมูลราคาน้ำมันสำหรับวันที่ ${date}`
            });
        }

        const price_per_liter = dailyRecord[`${fuel_type}_sell_price`];

        // Calculate liters from amount to preserve exact amount value
        const total_value = parseFloat(amount);
        const liters = total_value / parseFloat(price_per_liter);

        const fuelData = {
            date,
            fuel_type,
            liters: liters,
            price_per_liter,
            total_value,
            note,
            user_id: userId
        };

        const { data, error } = await supabase
            .from('personal_fuel_usage')
            .insert(fuelData)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Add personal fuel error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// DELETE Personal Fuel Usage
// ============================================
router.delete('/personal-fuel/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('personal_fuel_usage')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Delete personal fuel error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ============================================
// Credit Cash Payment Routes (with Confirmation)
// ============================================

// Add new credit payment (manual entry)
router.post('/credit-payment/cash', async (req, res) => {
    try {
        const { date, customer_id, amount, note, payment_method } = req.body;
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('credit_cash_payments')
            .insert({
                date,
                customer_id,
                amount,
                note,
                user_id: userId,
                payment_method: payment_method || 'cash',
                is_confirmed: false // Require manual confirmation
            })
            .select('*, customers(name, code)')
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Add credit payment error:', error);
        res.status(500).json({ error: error.message });
    }
});


// Confirm Credit Payment (Mark as confirmed only - Sync happens on Save All)
router.put('/credit-payment/:id/confirm', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 1. Get the payment details
        const { data: payment, error: fetchError } = await supabase
            .from('credit_cash_payments')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!payment) return res.status(404).json({ error: 'Payment not found' });
        if (payment.is_confirmed) return res.status(400).json({ error: 'Payment already confirmed' });

        // 2. Mark as Confirmed
        const { data: updatedPayment, error: updateError } = await supabase
            .from('credit_cash_payments')
            .update({ is_confirmed: true })
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;

        // 3. Create account transaction immediately
        const accountType = payment.payment_method === 'transfer' ? 'bank' : 'cash';
        const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', payment.customer_id)
            .single();

        let customerNameDisplay = customer?.name || 'ลูกค้า';

        // Check for retail customer sub-name
        if (customer && customer.name && customer.name.includes('รายย่อย') && payment.invoice_id) {
            const { data: firstBill } = await supabase
                .from('credit_sales')
                .select('note')
                .eq('invoice_id', payment.invoice_id)
                .order('date', { ascending: true })
                .limit(1)
                .single();

            if (firstBill && firstBill.note) {
                customerNameDisplay = `${customer.name} (${firstBill.note})`;
            }
        }

        let invoiceNumberStr = '';
        if (payment.invoice_id) {
            const { data: invoiceData } = await supabase
                .from('invoices')
                .select('invoice_number')
                .eq('id', payment.invoice_id)
                .single();
            if (invoiceData) {
                invoiceNumberStr = ` - ใบวางบิล ${invoiceData.invoice_number}`;
            }
        }

        const { error: transError } = await supabase
            .from('account_transactions')
            .insert({
                date: payment.date,
                transaction_type: 'customer_payment',
                category: 'Payment',
                description: `รับชำระเงินจาก ${customerNameDisplay} (${payment.payment_method === 'transfer' ? 'เงินโอน' : 'เงินสด'})${invoiceNumberStr}`,
                amount: payment.amount,
                payment_method: payment.payment_method || 'cash',
                account_type: accountType,
                customer_id: payment.customer_id,
                source: 'credit_payment_confirm',
                source_id: payment.id,
                user_id: userId
            });

        if (transError) {
            console.error('Error creating account transaction:', transError);
            // Rollback confirmation if transaction creation fails
            await supabase
                .from('credit_cash_payments')
                .update({ is_confirmed: false })
                .eq('id', id);
            throw transError;
        }

        res.json({ success: true, data: updatedPayment });

    } catch (error) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete credit payment
router.delete('/credit-payment/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get payment details before deleting
        const { data: payment, error: fetchError } = await supabase
            .from('credit_cash_payments')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        // 2. If payment is confirmed, delete the associated transaction
        if (payment.is_confirmed) {
            await supabase
                .from('account_transactions')
                .delete()
                .eq('source', 'credit_payment_confirm')
                .eq('source_id', id);
        }

        // 3. Revert the credit_sales status back to unpaid
        if (payment.invoice_id) {
            // Payment was made through invoice - revert all associated credit sales
            const { error: revertError } = await supabase
                .from('credit_sales')
                .update({
                    paid: false,
                    invoice_status: 'pending',
                    paid_at: null
                })
                .eq('invoice_id', payment.invoice_id);

            if (revertError) {
                console.error('Error reverting credit sales:', revertError);
            }

            // Get invoice total amount before reverting
            const { data: invoice } = await supabase
                .from('invoices')
                .select('total_amount')
                .eq('id', payment.invoice_id)
                .single();

            // Revert the invoice status
            const { error: invoiceRevertError } = await supabase
                .from('invoices')
                .update({
                    status: 'pending',
                    paid_amount: 0,
                    remaining_amount: invoice?.total_amount || 0,
                    paid_date: null
                })
                .eq('id', payment.invoice_id);

            if (invoiceRevertError) {
                console.error('Error reverting invoice status:', invoiceRevertError);
            }
        } else if (payment.sale_id) {
            // Direct payment to specific sale (if this field exists)
            await supabase
                .from('credit_sales')
                .update({ paid: false, paid_at: null })
                .eq('id', payment.sale_id);
        } else {
            // Fallback: Update by customer and date
            await supabase
                .from('credit_sales')
                .update({ paid: false, paid_at: null })
                .eq('customer_id', payment.customer_id)
                .eq('date', payment.date)
                .eq('paid', true);
        }

        // 4. Delete payment record
        const { error: deleteError } = await supabase
            .from('credit_cash_payments')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({ success: true, message: 'Payment deleted and bill status reverted to pending' });
    } catch (error) {
        console.error('Delete credit payment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET Safe Record for specific date
// ============================================
router.get('/safe/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // Get today's safe record
        const { data: safeRecord } = await supabase
            .from('safe_records')
            .select('*')
            .eq('date', date)
            .single();

        // Get yesterday's closing balance (prev_closing_balance for today)
        const yesterday = new Date(date);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: prevRecord } = await supabase
            .from('safe_records')
            .select('closing_balance, closing_bills')
            .eq('date', yesterdayStr)
            .single();

        res.json({
            safeRecord: safeRecord || null,
            prevClosingBalance: prevRecord?.closing_balance ?? 0,
            prevClosingBills: prevRecord?.closing_bills ?? {},
        });
    } catch (error) {
        console.error('Get safe record error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// POST/UPDATE Safe Record
// ============================================
router.post('/safe', async (req, res) => {
    try {
        const { date, prev_closing_balance, opening_balance, closing_balance, closing_bills, note } = req.body;
        const userId = req.user.id;

        const { data, error } = await supabase
            .from('safe_records')
            .upsert({
                date,
                prev_closing_balance: prev_closing_balance || 0,
                opening_balance: opening_balance || 0,
                closing_balance: closing_balance || 0,
                closing_bills: closing_bills || {},
                note,
                user_id: userId,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'date' })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Save safe record error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// GET Reconciliation Summary
// ============================================
router.get('/cash/summary/:date', async (req, res) => {
    try {
        const { date } = req.params;

        // Get daily metrics
        const { data: metrics } = await supabase
            .from('daily_metrics')
            .select('*')
            .eq('date', date)
            .single();

        // Get credit sales
        const { data: creditSales } = await supabase
            .from('credit_sales')
            .select('amount')
            .eq('date', date);

        // Get personal fuel
        const { data: fuelUsage } = await supabase
            .from('personal_fuel_usage')
            .select('*')
            .eq('date', date);

        // Get cash record
        const { data: cashRecord } = await supabase
            .from('daily_cash_records')
            .select('*')
            .eq('date', date)
            .single();

        const totalCreditSales = creditSales?.reduce((sum, s) => sum + parseFloat(s.amount), 0) || 0;
        const totalFuelValue = fuelUsage?.reduce((sum, f) => sum + parseFloat(f.total_value), 0) || 0;

        res.json({
            metrics: metrics || null,
            totalCreditSales,
            fuelUsage: fuelUsage || [],
            totalFuelValue,
            cashRecord: cashRecord || null
        });
    } catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
