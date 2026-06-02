const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use((req, res, next) => {
    console.log('Credit Router Hit:', req.method, req.url);
    next();
});

router.use(authMiddleware);

// Add credit sale
// Add credit sale
// Support both / and /add to prevent 404s
router.post(['/', '/add', '/create'], async (req, res) => {
    try {
        const {
            customer_id,
            bill_book,
            bill_number,
            amount,
            vehicle_number,
            note,
            date // Capture date
        } = req.body;

        const { data, error } = await supabase
            .from('credit_sales')
            .insert({
                date: date || new Date().toISOString(), // Use provided date or fallback
                customer_id,
                bill_book,
                bill_number,
                amount,
                vehicle_number: vehicle_number || null,
                note: note || null,
                paid: false,
                user_id: req.user.id,
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Add credit error:', error);
        res.status(500).json({ error: error.message || 'Server error', details: error });
    }
});

// Update credit sale
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            customerId,
            billBook,
            billNumber,
            amount,
            vehicleNumber,
            note
        } = req.body;

        // First check if the record exists and is not paid
        const { data: existing, error: checkError } = await supabase
            .from('credit_sales')
            .select('paid')
            .eq('id', id)
            .single();

        if (checkError) throw checkError;

        if (existing.paid) {
            return res.status(400).json({ error: 'Cannot edit paid credit sale' });
        }

        // Update the record
        const updatePayload = {
            customer_id: customerId,
            bill_book: billBook,
            bill_number: billNumber,
            amount,
            vehicle_number: vehicleNumber || null,
            note: note || null,
            updated_at: new Date().toISOString()
        };

        if (req.body.date) {
            updatePayload.date = req.body.date;
        }

        const { data, error } = await supabase
            .from('credit_sales')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Update credit error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get today's credit sales
router.get('/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('credit_sales')
            .select(`
        *,
        customers (
          id,
          name,
          code
        ),
        users (
          id,
          name,
          username
        )
      `)
            .eq('date', today)
            .order('created_at', { ascending: false });

        if (error) throw error;

        const totalAmount = data.reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
        const totalBills = data.length;

        res.json({
            data,
            summary: {
                totalAmount,
                totalBills
            }
        });
    } catch (error) {
        console.error('Get today credit error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all credit sales with invoice information (NEW)
router.get('/sales', async (req, res) => {
    try {
        const { customer_id, invoice_status, start_date, end_date } = req.query;

        let query = supabase
            .from('credit_sales')
            .select(`
                *,
                customers (
                    id,
                    code,
                    name,
                    phone
                ),
                invoices (
                    id,
                    invoice_number,
                    status
                )
            `);

        // Apply filters
        if (customer_id && customer_id !== 'all') {
            query = query.eq('customer_id', parseInt(customer_id));
        }

        if (invoice_status && invoice_status !== 'all') {
            query = query.eq('invoice_status', invoice_status);
        }

        if (start_date) {
            query = query.gte('date', start_date);
        }

        if (end_date) {
            query = query.lte('date', end_date);
        }

        query = query
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        res.json({ sales: data || [] });
    } catch (error) {
        console.error('Get credit sales error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get filtered credit sales (FIXED)
router.get('/filter', async (req, res) => {
    try {
        const { customerId, startDate, endDate, paid } = req.query;

        let query = supabase
            .from('credit_sales')
            .select(`
                *,
                customers (
                    id,
                    name,
                    code
                ),
                invoices (
                    id,
                    invoice_number,
                    status
                )
            `);

        // FIX: Properly apply customer filter
        if (customerId && customerId !== 'all') {
            query = query.eq('customer_id', parseInt(customerId));
        }

        // FIX: Properly apply date filters
        if (startDate) {
            query = query.gte('date', startDate);
        }

        if (endDate) {
            query = query.lte('date', endDate);
        }

        if (paid !== undefined && paid !== 'all') {
            query = query.eq('paid', paid === 'true');
        }

        query = query
            .order('date', { ascending: false })
            .order('id', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        // Normalize: if invoice_id is set but invoice_status is 'pending', fix to 'invoiced'
        const normalized = data.map(row =>
            row.invoice_id && row.invoice_status === 'pending'
                ? { ...row, invoice_status: 'invoiced' }
                : row
        );

        // Also self-heal the bad data in DB asynchronously
        const badRows = data.filter(r => r.invoice_id && r.invoice_status === 'pending').map(r => r.id);
        if (badRows.length > 0) {
            supabase.from('credit_sales')
                .update({ invoice_status: 'invoiced' })
                .in('id', badRows)
                .then(() => {})
                .catch(e => console.error('Self-heal invoice_status error:', e));
        }

        const totalAmount = normalized.reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
        const paidAmount = normalized
            .filter(sale => sale.paid)
            .reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
        const unpaidAmount = totalAmount - paidAmount;

        res.json({
            data: normalized,
            summary: {
                totalAmount,
                paidAmount,
                unpaidAmount,
                totalBills: data.length
            }
        });
    } catch (error) {
        console.error('Filter credit error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update payment status
router.put('/:id/payment', async (req, res) => {
    try {
        const { id } = req.params;
        const { paid } = req.body;

        const { data, error } = await supabase
            .from('credit_sales')
            .update({
                paid,
                paid_at: paid ? new Date().toISOString() : null
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Update payment error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// REMOVED: Individual bill payment endpoint
// Bills can only be paid through invoices now
// Use POST /api/invoices/:id/pay instead

// Delete credit sale
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('credit_sales')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ success: true });
    } catch (error) {
        console.error('Delete credit error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
