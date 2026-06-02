const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// ============================================================================
// Invoice Number Generation
// ============================================================================

async function generateInvoiceNumber() {
    try {
        // Get all existing invoice numbers, sorted
        const { data: invoices, error: fetchError } = await supabase
            .from('invoices')
            .select('invoice_number')
            .order('invoice_number', { ascending: true });

        if (fetchError) throw fetchError;

        // If no invoices exist, start from 001
        if (!invoices || invoices.length === 0) {
            return 'INV-001';
        }

        // Extract numbers and find gaps
        const existingNumbers = invoices.map(inv => {
            const num = parseInt(inv.invoice_number.split('-')[1]);
            return num;
        });

        // Find the first missing number (gap)
        let nextNumber = 1;
        for (const num of existingNumbers) {
            if (num === nextNumber) {
                nextNumber++;
            } else if (num > nextNumber) {
                // Found a gap! Use this number
                break;
            }
        }

        return `INV-${String(nextNumber).padStart(3, '0')}`;
    } catch (error) {
        console.error('Generate invoice number error:', error);
        throw error;
    }
}

// ============================================================================
// Create Invoice
// ============================================================================

router.post('/', async (req, res) => {
    try {
        const { customer_id, credit_sale_ids, issue_date, note } = req.body;

        // Validation
        if (!customer_id || !credit_sale_ids || credit_sale_ids.length === 0) {
            return res.status(400).json({ error: 'customer_id and credit_sale_ids are required' });
        }

        // Check if customer already has an active invoice
        const { data: existingInvoice, error: checkError } = await supabase
            .from('invoices')
            .select('id, invoice_number')
            .eq('customer_id', customer_id)
            .eq('status', 'active')
            .single();

        if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
            throw checkError;
        }

        if (existingInvoice) {
            return res.status(400).json({
                error: `ลูกค้ารายนี้มีใบวางบิล ${existingInvoice.invoice_number} ที่ยังไม่ได้ชำระอยู่แล้ว กรุณาชำระหรือยกเลิกใบวางบิลเดิมก่อน`
            });
        }

        // Fetch selected credit sales
        const { data: creditSales, error: fetchError } = await supabase
            .from('credit_sales')
            .select('*')
            .in('id', credit_sale_ids);

        if (fetchError) throw fetchError;

        if (!creditSales || creditSales.length === 0) {
            return res.status(404).json({ error: 'ไม่พบบิลที่เลือก' });
        }

        // Validate all bills belong to same customer
        const invalidBills = creditSales.filter(sale => sale.customer_id !== customer_id);
        if (invalidBills.length > 0) {
            return res.status(400).json({ error: 'บิลที่เลือกต้องเป็นของลูกค้าคนเดียวกันทั้งหมด' });
        }

        // Validate all bills are unpaired
        const pairedBills = creditSales.filter(sale => sale.invoice_status !== 'unpaired');
        if (pairedBills.length > 0) {
            return res.status(400).json({ error: 'มีบิลที่เลือกถูกผูกกับใบวางบิลอื่นอยู่แล้ว' });
        }

        // Calculate total amount
        const total_amount = creditSales.reduce((sum, sale) => sum + parseFloat(sale.amount), 0);

        // Generate invoice number
        const invoice_number = await generateInvoiceNumber();

        // สร้าง public token แบบสุ่ม (ใช้แทน ID ใน public URL)
        const crypto = require('crypto');
        const public_token = crypto.randomBytes(24).toString('hex');

        // Create invoice
        const { data: invoice, error: createError } = await supabase
            .from('invoices')
            .insert({
                invoice_number,
                customer_id,
                status: 'active',
                total_amount,
                paid_amount: 0,
                remaining_amount: total_amount,
                issue_date: issue_date || new Date().toISOString().split('T')[0],
                note,
                created_by: req.user.id,
                public_token,
            })
            .select()
            .single();

        if (createError) throw createError;

        // Update credit sales
        const { error: updateError } = await supabase
            .from('credit_sales')
            .update({
                invoice_id: invoice.id,
                invoice_status: 'invoiced'
            })
            .in('id', credit_sale_ids);

        if (updateError) throw updateError;

        res.json({
            success: true,
            invoice,
            message: `สร้างใบวางบิล ${invoice_number} สำเร็จ (${creditSales.length} บิล, ยอดรวม ฿${total_amount.toFixed(2)})`
        });
    } catch (error) {
        console.error('Create invoice error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
});

// ============================================================================
// Get All Invoices
// ============================================================================

router.get('/', async (req, res) => {
    try {
        const { customer_id, status } = req.query;

        let query = supabase
            .from('invoices')
            .select(`
                *,
                customers (
                    id,
                    code,
                    name,
                    phone
                ),
                credit_sales (
                    date,
                    note
                )
            `);

        if (customer_id) {
            query = query.eq('customer_id', customer_id);
        }

        if (status) {
            query = query.eq('status', status);
        }

        query = query.order('invoice_number', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        // Append retail customer note from the first bill
        const processedData = data.map(inv => {
            if (inv.customers && inv.customers.name && inv.customers.name.includes('รายย่อย')) {
                if (inv.credit_sales && inv.credit_sales.length > 0) {
                    // Sort by date to get the first one
                    const sortedBills = inv.credit_sales.sort((a, b) => new Date(a.date) - new Date(b.date));
                    const firstNote = sortedBills[0].note;
                    if (firstNote) {
                        inv.customers.name = `${inv.customers.name} (${firstNote})`;
                    }
                }
            }
            // Clean up to save bandwidth
            delete inv.credit_sales;
            return inv;
        });

        res.json({ invoices: processedData });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================================
// Get Invoice Details
// ============================================================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get invoice
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select(`
                *,
                customers (
                    id,
                    code,
                    name,
                    phone,
                    contact_person
                )
            `)
            .eq('id', id)
            .single();

        if (invoiceError) throw invoiceError;

        if (!invoice) {
            return res.status(404).json({ error: 'ไม่พบใบวางบิล' });
        }

        // Get associated credit sales
        const { data: bills, error: billsError } = await supabase
            .from('credit_sales')
            .select('*')
            .eq('invoice_id', id)
            .order('date', { ascending: true });

        if (billsError) throw billsError;

        invoice.bills = bills || [];

        // Append retail customer note from the first bill
        if (invoice.customers && invoice.customers.name && invoice.customers.name.includes('รายย่อย')) {
            if (invoice.bills.length > 0) {
                const firstNote = invoice.bills[0].note;
                if (firstNote) {
                    invoice.customers.name = `${invoice.customers.name} (${firstNote})`;
                }
            }
        }

        // Get confirmed user for paid invoices
        if (invoice.status === 'paid') {
            const { data: paymentInfo } = await supabase
                .from('credit_cash_payments')
                .select('user_id')
                .eq('invoice_id', id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (paymentInfo && paymentInfo.user_id) {
                const { data: userData } = await supabase
                    .from('users')
                    .select('name, username')
                    .eq('id', paymentInfo.user_id)
                    .single();

                if (userData) {
                    invoice.confirmed_by = userData.name || userData.username || 'System';
                }
            }
        }

        res.json({ invoice });
    } catch (error) {
        console.error('Get invoice details error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================================================
// Pay Invoice
// ============================================================================

router.post('/:id/pay', async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_date, payment_method, note } = req.body;
        const userId = req.user.id;

        // Get invoice
        const { data: invoice, error: fetchError } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!invoice) {
            return res.status(404).json({ error: 'ไม่พบใบวางบิล' });
        }

        if (invoice.status !== 'active' && invoice.status !== 'pending') {
            return res.status(400).json({ error: 'ใบวางบิลนี้ไม่สามารถชำระได้ (ชำระแล้วหรือถูกยกเลิก)' });
        }

        // Update invoice
        const { data: updatedInvoice, error: updateInvoiceError } = await supabase
            .from('invoices')
            .update({
                status: 'paid',
                paid_amount: invoice.total_amount,
                remaining_amount: 0,
                paid_date: payment_date || new Date().toISOString().split('T')[0],
                payment_method,
                note: note || invoice.note
            })
            .eq('id', id)
            .select()
            .single();

        if (updateInvoiceError) throw updateInvoiceError;

        // Update all associated credit sales
        const { error: updateBillsError } = await supabase
            .from('credit_sales')
            .update({
                invoice_status: 'paid',
                paid: true,
                paid_at: payment_date || new Date().toISOString()
            })
            .eq('invoice_id', id);

        if (updateBillsError) throw updateBillsError;

        if (updateBillsError) throw updateBillsError;

        // Insert into Credit Cash Payments (CONFIRMED AUTOMATICALLY)
        const { data: creditPayment, error: creditPaymentError } = await supabase
            .from('credit_cash_payments')
            .insert({
                date: payment_date || new Date().toISOString().split('T')[0],
                customer_id: invoice.customer_id,
                amount: invoice.total_amount,
                note: `ชำระใบวางบิล ${invoice.invoice_number}`,
                payment_method: payment_method || 'cash',
                is_confirmed: true, // Auto-confirm
                invoice_id: id,
                user_id: userId
            })
            .select()
            .single();

        if (creditPaymentError) throw creditPaymentError;

        // Create Account Transaction IMMEDIATELY
        const accountType = (payment_method || 'cash') === 'transfer' ? 'bank' : 'cash';

        // Get customer name for description
        const { data: customer } = await supabase
            .from('customers')
            .select('name')
            .eq('id', invoice.customer_id)
            .single();

        let customerNameDisplay = customer?.name || 'ลูกค้า';

        // Check for retail customer sub-name
        if (customer && customer.name && customer.name.includes('รายย่อย')) {
            const { data: firstBill } = await supabase
                .from('credit_sales')
                .select('note')
                .eq('invoice_id', id)
                .order('date', { ascending: true })
                .limit(1)
                .single();

            if (firstBill && firstBill.note) {
                customerNameDisplay = `${customer.name} (${firstBill.note})`;
            }
        }

        const { error: transError } = await supabase
            .from('account_transactions')
            .insert({
                date: payment_date || new Date().toISOString().split('T')[0],
                transaction_type: 'customer_payment',
                category: 'Payment',
                description: `รับชำระเงินจาก ${customerNameDisplay} (${payment_method === 'transfer' ? 'เงินโอน' : 'เงินสด'}) - ใบวางบิล ${invoice.invoice_number}`,
                amount: invoice.total_amount,
                payment_method: payment_method || 'cash',
                account_type: accountType,
                customer_id: invoice.customer_id,
                source: 'credit_payment_confirm', // Matches source in cash.js for idempotency
                source_id: creditPayment.id,
                user_id: userId
            });

        if (transError) {
            console.error('Error creating transaction:', transError);
            // Non-blocking error, but should be noted
        }

        res.json({
            success: true,
            invoice: updatedInvoice,
            message: `ชำระใบวางบิล ${invoice.invoice_number} สำเร็จ (฿${invoice.total_amount.toFixed(2)}) และบันทึกบัญชีเรียบร้อย`
        });
    } catch (error) {
        console.error('Pay invoice error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
});

// ============================================================================
// Revert Invoice Payment
// ============================================================================

router.post('/:id/revert-payment', async (req, res) => {
    try {
        const { id } = req.params;

        // Get invoice
        const { data: invoice, error: fetchError } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!invoice) {
            return res.status(404).json({ error: 'ไม่พบใบวางบิล' });
        }

        if (invoice.status !== 'paid') {
            return res.status(400).json({ error: 'ใบวางบิลนี้ยังไม่ได้ชำระ ไม่สามารถยกเลิกการชำระเงินได้' });
        }

        // Revert invoice status
        const { error: updateInvoiceError } = await supabase
            .from('invoices')
            .update({
                status: 'active',
                paid_amount: 0,
                remaining_amount: invoice.total_amount,
                paid_date: null,
                payment_method: null,
                updated_at: new Date()
            })
            .eq('id', id);

        if (updateInvoiceError) throw updateInvoiceError;

        // Revert associated credit sales — back to 'invoiced' (still attached to invoice, just not paid)
        const { error: updateBillsError } = await supabase
            .from('credit_sales')
            .update({
                invoice_status: 'invoiced',
                paid: false,
                paid_at: null
            })
            .eq('invoice_id', id);

        if (updateBillsError) throw updateBillsError;

        // Void (Delete) the accounting transaction

        // 1. Handle Legacy Transactions (Direct Invoice Payment)
        const { error: deleteLegacyTransactionError } = await supabase
            .from('account_transactions')
            .delete()
            .eq('source', 'invoice_payment')
            .eq('source_id', id);

        if (deleteLegacyTransactionError) console.error('Error deleting legacy transaction:', deleteLegacyTransactionError);

        // 2. Handle New Flow (Confirmed via Cash Management)
        // Find associated credit cash payment
        const { data: creditPayment } = await supabase
            .from('credit_cash_payments')
            .select('id')
            .eq('invoice_id', id)
            .single();

        if (creditPayment) {
            // Delete transaction generated from confirmation
            const { error: deleteConfirmTransactionError } = await supabase
                .from('account_transactions')
                .delete()
                .eq('source', 'credit_payment_confirm')
                .eq('source_id', creditPayment.id);

            if (deleteConfirmTransactionError) console.error('Error deleting confirm transaction:', deleteConfirmTransactionError);

            // Delete the credit cash payment record itself
            const { error: deleteCreditPaymentError } = await supabase
                .from('credit_cash_payments')
                .delete()
                .eq('id', creditPayment.id);

            if (deleteCreditPaymentError) throw deleteCreditPaymentError;
        }

        res.json({
            success: true,
            message: `ยกเลิกการชำระเงินใบวางบิล ${invoice.invoice_number} สำเร็จ (กลับสู่สถานะรอชำระ)`
        });
    } catch (error) {
        console.error('Revert payment error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
});

// ============================================================================
// Cancel Invoice
// ============================================================================

router.post('/:id/cancel', async (req, res) => {
    try {
        const { id } = req.params;

        // Get invoice
        const { data: invoice, error: fetchError } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        if (!invoice) {
            return res.status(404).json({ error: 'ไม่พบใบวางบิล' });
        }

        if (invoice.status === 'paid') {
            return res.status(400).json({ error: 'ไม่สามารถยกเลิกใบวางบิลที่ชำระแล้ว' });
        }

        const invoiceNumber = invoice.invoice_number;

        // Release all associated credit sales FIRST (before deleting invoice)
        const { error: updateBillsError } = await supabase
            .from('credit_sales')
            .update({
                invoice_id: null,
                invoice_status: 'unpaired'
            })
            .eq('invoice_id', id);

        if (updateBillsError) throw updateBillsError;

        // DELETE the invoice (this frees up the invoice_number for reuse)
        const { error: deleteError } = await supabase
            .from('invoices')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;

        res.json({
            success: true,
            message: `ยกเลิกใบวางบิล ${invoiceNumber} สำเร็จ (บิลทั้งหมดกลับมาเป็น unpaired และเลข ${invoiceNumber} สามารถนำกลับมาใช้ใหม่ได้)`
        });
    } catch (error) {
        console.error('Cancel invoice error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
});

module.exports = router;
