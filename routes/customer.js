const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');
const INVOICE_FILE = path.join(__dirname, '../data/invoices.json');

router.use(authMiddleware);

// Get all customers with outstanding balance, active invoice, and unbilled count
router.get('/', async (req, res) => {
    try {
        // 1. Get all customers
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('*')
            .order('id', { ascending: true });

        if (customersError) throw customersError;

        // 2. Get all unpaid credit sales (with invoice_id)
        const { data: unpaidSales, error: salesError } = await supabase
            .from('credit_sales')
            .select('customer_id, amount, invoice_id')
            .eq('paid', false);

        if (salesError) throw salesError;

        // 3. Get all active invoices
        const { data: activeInvoices, error: invError } = await supabase
            .from('invoices')
            .select('id, invoice_number, customer_id, total_amount')
            .eq('status', 'active');

        if (invError) throw invError;

        // 4. Build lookup maps
        const activeInvoiceByCustomer = {};
        (activeInvoices || []).forEach(inv => {
            activeInvoiceByCustomer[inv.customer_id] = inv;
        });

        // 5. Calculate per-customer stats
        const customersWithBalance = customers.map(customer => {
            const customerSales = unpaidSales.filter(sale => sale.customer_id === customer.id);
            const unpaidAmount = customerSales.reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
            const activeInvoice = activeInvoiceByCustomer[customer.id] || null;
            // unbilled = unpaid sales with no invoice_id (outside any active invoice)
            const unbilledCount = customerSales.filter(sale => !sale.invoice_id).length;

            return {
                ...customer,
                unpaidAmount,
                activeInvoice,
                unbilledCount,
            };
        });

        res.json({ data: customersWithBalance });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get customer by ID with credit history
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get customer info
        const { data: customer, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .eq('id', id)
            .single();

        if (customerError) throw customerError;

        // Get customer's credit sales
        const { data: creditSales, error: creditError } = await supabase
            .from('credit_sales')
            .select('*')
            .eq('customer_id', id)
            .order('date', { ascending: false });

        if (creditError) throw creditError;

        const totalAmount = creditSales.reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
        const paidAmount = creditSales
            .filter(sale => sale.paid)
            .reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
        const unpaidAmount = totalAmount - paidAmount;
        const totalBills = creditSales.length;
        const paidBills = creditSales.filter(sale => sale.paid).length;
        const unpaidBills = totalBills - paidBills;

        res.json({
            customer,
            creditSales,
            summary: {
                totalAmount,
                paidAmount,
                unpaidAmount,
                totalBills,
                paidBills,
                unpaidBills
            }
        });
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add customer
router.post('/', async (req, res) => {
    try {
        // HACK: Check if this is actually a Credit Sale request (Bypassing 404 issues on credit route)
        if (req.body.bill_book && req.body.amount) {
            const {
                customer_id, // Ensure frontend sends snake_case
                bill_book,
                bill_number,
                amount,
                vehicle_number,
                note
            } = req.body;

            // 1. Validate & Cast
            const customerIdInt = parseInt(customer_id);
            const amountFloat = parseFloat(amount);

            if (isNaN(customerIdInt) || isNaN(amountFloat)) {
                return res.status(400).json({ error: 'Invalid data format (ID or Amount)' });
            }

            // 2. Insert
            const { data, error } = await supabase
                .from('credit_sales')
                .insert({
                    date: new Date().toISOString(),
                    customer_id: customerIdInt,
                    bill_book: String(bill_book),
                    bill_number: String(bill_number),
                    amount: amountFloat,
                    vehicle_number: vehicle_number ? String(vehicle_number) : null,
                    note: note ? String(note) : null,
                    paid: false,
                    user_id: req.user ? req.user.id : null, // Handle potential missing user safely
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('Supabase Insert Error:', error);
                throw error; // Will be caught by outer catch
            }
            return res.json({ success: true, data });
        }

        const { code, name, phone, contact_person, note, line_user_id } = req.body;

        const { data, error } = await supabase
            .from('customers')
            .insert({
                code,
                name,
                phone: phone || null,
                contact_person: contact_person || null,
                note: note || null,
                line_user_id: line_user_id || null,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Add customer/credit error:', error);
        res.status(500).json({ error: error.message || 'Server error', details: error });
    }
});

// Update customer
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { code, name, phone, contact_person, note, line_user_id } = req.body;

        const { data, error } = await supabase
            .from('customers')
            .update({
                code,
                name,
                phone: phone || null,
                contact_person: contact_person || null,
                note: note || null,
                line_user_id: line_user_id || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete customer
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Check if customer has credit sales
        const { data: creditSales } = await supabase
            .from('credit_sales')
            .select('id')
            .eq('customer_id', id)
            .limit(1);

        if (creditSales && creditSales.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete customer with existing credit sales'
            });
        }

        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Generate Invoice (Supabase Version)
router.post('/:id/invoice', async (req, res) => {
    try {
        const { id } = req.params;
        const { items } = req.body; // Array of credit_sale objects

        // 1. Get Customer Info
        const { data: customer, error: cError } = await supabase
            .from('customers')
            .select('code, name')
            .eq('id', id)
            .single();

        if (cError) throw cError;

        let customerCode = customer.code || `C${id.toString().padStart(3, '0')}`;
        customerCode = customerCode.trim().toUpperCase();

        // 2. Count existing invoices for this customer FROM DATABASE
        const { count, error: countError } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('customer_id', id);

        if (countError) throw countError;

        const nextNum = (count || 0) + 1;

        // Format: INV-CODE001 (e.g., INV-K02001)
        const invoiceNo = `INV-${customerCode}${nextNum.toString().padStart(3, '0')}`;

        // 3. Create New Invoice Record in Supabase
        const newInvoicePayload = {
            invoice_no: invoiceNo,
            customer_id: parseInt(id),
            customer_name: customer.name,
            date: new Date().toISOString(),
            items_count: items.length,
            total_amount: items.reduce((sum, item) => sum + parseFloat(item.amount), 0),
            created_by: req.user ? req.user.id : null
        };

        const { data: newInvoice, error: insertError } = await supabase
            .from('invoices')
            .insert(newInvoicePayload)
            .select()
            .single();

        if (insertError) throw insertError;

        res.json({ success: true, invoice: newInvoice });

    } catch (error) {
        console.error('Generate invoice error:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

module.exports = router;
