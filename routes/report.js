const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Sales Report
router.get('/sales', async (req, res) => {
    try {
        const { customerId, startDate, endDate, fuelType } = req.query;

        let query = supabase
            .from('daily_metrics')
            .select('*')
            .order('date', { ascending: false });

        if (startDate) {
            query = query.gte('date', startDate);
        }

        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Filter by fuel type if specified
        let reportData = data;
        if (fuelType && fuelType !== 'all') {
            reportData = data.map(record => ({
                date: record.date,
                sales: record[`${fuelType}_sales`],
                profit: record[`${fuelType}_profit`],
                liters: record[`${fuelType}_liters`],
                fuelType: fuelType.toUpperCase()
            }));
        }

        const totalSales = data.reduce((sum, r) => {
            if (fuelType && fuelType !== 'all') {
                return sum + parseFloat(r[`${fuelType}_sales`] || 0);
            }
            return sum + parseFloat(r.total_sales || 0);
        }, 0);

        const totalProfit = data.reduce((sum, r) => {
            if (fuelType && fuelType !== 'all') {
                return sum + parseFloat(r[`${fuelType}_profit`] || 0);
            }
            return sum + parseFloat(r.total_profit || 0);
        }, 0);

        const totalLiters = data.reduce((sum, r) => {
            if (fuelType && fuelType !== 'all') {
                return sum + parseFloat(r[`${fuelType}_liters`] || 0);
            }
            return sum + parseFloat(r.total_liters || 0);
        }, 0);

        res.json({
            data: fuelType && fuelType !== 'all' ? reportData : data,
            summary: {
                totalSales,
                totalProfit,
                totalLiters,
                recordCount: data.length
            }
        });
    } catch (error) {
        console.error('Sales report error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Credit Sales Report
router.get('/credit', async (req, res) => {
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
        )
      `);

        if (customerId && customerId !== 'all') {
            query = query.eq('customer_id', customerId);
        }

        if (startDate) {
            query = query.gte('date', startDate);
        }

        if (endDate) {
            query = query.lte('date', endDate);
        }

        if (paid !== undefined && paid !== 'all') {
            query = query.eq('paid', paid === 'true');
        }

        query = query.order('date', { ascending: false });

        const { data, error } = await query;

        if (error) throw error;

        const totalAmount = data.reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
        const paidAmount = data
            .filter(sale => sale.paid)
            .reduce((sum, sale) => sum + parseFloat(sale.amount), 0);
        const unpaidAmount = totalAmount - paidAmount;

        res.json({
            data,
            summary: {
                totalAmount,
                paidAmount,
                unpaidAmount,
                totalBills: data.length,
                paidBills: data.filter(s => s.paid).length,
                unpaidBills: data.filter(s => !s.paid).length
            }
        });
    } catch (error) {
        console.error('Credit report error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Investment Report (fuel purchases)
router.get('/investment', async (req, res) => {
    try {
        const { fuelType, startDate, endDate } = req.query;

        let query = supabase
            .from('daily_records')
            .select('*')
            .order('date', { ascending: false });

        if (startDate) {
            query = query.gte('date', startDate);
        }

        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Calculate price changes and investment
        const investmentData = [];

        for (let i = 0; i < data.length; i++) {
            const record = data[i];
            const prevRecord = i < data.length - 1 ? data[i + 1] : null;

            const priceChanges = {
                e91: prevRecord ? parseFloat(record.e91_cost_price) !== parseFloat(prevRecord.e91_cost_price) : true,
                e95: prevRecord ? parseFloat(record.e95_cost_price) !== parseFloat(prevRecord.e95_cost_price) : true,
                b7: prevRecord ? parseFloat(record.b7_cost_price) !== parseFloat(prevRecord.b7_cost_price) : true
            };

            if (!fuelType || fuelType === 'all' || priceChanges[fuelType]) {
                investmentData.push({
                    date: record.date,
                    e91_cost_price: record.e91_cost_price,
                    e95_cost_price: record.e95_cost_price,
                    b7_cost_price: record.b7_cost_price,
                    e91_sell_price: record.e91_sell_price,
                    e95_sell_price: record.e95_sell_price,
                    b7_sell_price: record.b7_sell_price,
                    priceChanges
                });
            }
        }

        res.json({
            data: investmentData,
            summary: {
                recordCount: investmentData.length
            }
        });
    } catch (error) {
        console.error('Investment report error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Profit/Loss Report
router.get('/profit-loss', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let query = supabase
            .from('daily_metrics')
            .select('*')
            .order('date', { ascending: false });

        if (startDate) {
            query = query.gte('date', startDate);
        }

        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data, error } = await query;

        if (error) throw error;

        const totalSales = data.reduce((sum, r) => sum + parseFloat(r.total_sales || 0), 0);
        const totalProfit = data.reduce((sum, r) => sum + parseFloat(r.total_profit || 0), 0);
        const totalLiters = data.reduce((sum, r) => sum + parseFloat(r.total_liters || 0), 0);

        // Calculate by fuel type
        const e91Total = {
            sales: data.reduce((sum, r) => sum + parseFloat(r.e91_sales || 0), 0),
            profit: data.reduce((sum, r) => sum + parseFloat(r.e91_profit || 0), 0),
            liters: data.reduce((sum, r) => sum + parseFloat(r.e91_liters || 0), 0)
        };

        const e95Total = {
            sales: data.reduce((sum, r) => sum + parseFloat(r.e95_sales || 0), 0),
            profit: data.reduce((sum, r) => sum + parseFloat(r.e95_profit || 0), 0),
            liters: data.reduce((sum, r) => sum + parseFloat(r.e95_liters || 0), 0)
        };

        const b7Total = {
            sales: data.reduce((sum, r) => sum + parseFloat(r.b7_sales || 0), 0),
            profit: data.reduce((sum, r) => sum + parseFloat(r.b7_profit || 0), 0),
            liters: data.reduce((sum, r) => sum + parseFloat(r.b7_liters || 0), 0)
        };

        res.json({
            data,
            summary: {
                totalSales,
                totalProfit,
                totalLiters,
                profitMargin: totalSales > 0 ? (totalProfit / totalSales * 100) : 0,
                e91: e91Total,
                e95: e95Total,
                b7: b7Total,
                recordCount: data.length
            }
        });
    } catch (error) {
        console.error('Profit/Loss report error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
