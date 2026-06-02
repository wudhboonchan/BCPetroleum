const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get yesterday's data
router.get('/yesterday', async (req, res) => {
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('daily_records')
            .select('*')
            .eq('date', yesterday)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
            throw error;
        }

        res.json({ data: data || null });
    } catch (error) {
        console.error('Get yesterday error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Submit daily record
router.post('/submit', async (req, res) => {
    try {
        // Use provided date or default to today
        const today = req.body.date || new Date().toISOString().split('T')[0];
        const {
            e91CostPrice,
            e91SellPrice,
            e95CostPrice,
            e95SellPrice,
            b7CostPrice,
            b7SellPrice,
            nozzle1Today,
            nozzle2Today,
            nozzle3Today,
            nozzle4Today,
            nozzle5Today,
            nozzle6Today,
            nozzle7Today,
            nozzle8Today,
            nozzle1Yesterday,
            nozzle2Yesterday,
            nozzle3Yesterday,
            nozzle4Yesterday,
            nozzle5Yesterday,
            nozzle6Yesterday,
            nozzle7Yesterday,
            nozzle8Yesterday
        } = req.body;

        // Calculate metrics
        const metrics = calculateMetrics(req.body);

        const recordData = {
            date: today,
            e91_cost_price: e91CostPrice,
            e91_sell_price: e91SellPrice,
            e95_cost_price: e95CostPrice,
            e95_sell_price: e95SellPrice,
            b7_cost_price: b7CostPrice,
            b7_sell_price: b7SellPrice,
            nozzle_1_today: nozzle1Today,
            nozzle_2_today: nozzle2Today,
            nozzle_3_today: nozzle3Today,
            nozzle_4_today: nozzle4Today,
            nozzle_5_today: nozzle5Today,
            nozzle_6_today: nozzle6Today,
            nozzle_7_today: nozzle7Today,
            nozzle_8_today: nozzle8Today,
            nozzle_1_yesterday: nozzle1Yesterday,
            nozzle_2_yesterday: nozzle2Yesterday,
            nozzle_3_yesterday: nozzle3Yesterday,
            nozzle_4_yesterday: nozzle4Yesterday,
            nozzle_5_yesterday: nozzle5Yesterday,
            nozzle_6_yesterday: nozzle6Yesterday,
            nozzle_7_yesterday: nozzle7Yesterday,
            nozzle_8_yesterday: nozzle8Yesterday,
            user_id: req.user.id,
            updated_at: new Date().toISOString()
        };

        // Upsert (insert or update if exists)
        const { data, error } = await supabase
            .from('daily_records')
            .upsert(recordData, { onConflict: 'date' })
            .select()
            .single();

        if (error) throw error;

        // Update calculated metrics in separate table
        await updateCalculatedMetrics(today, metrics);

        res.json({
            success: true,
            data,
            metrics
        });

    } catch (error) {
        console.error('Submit daily error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get today's record
router.get('/today', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await supabase
            .from('daily_records')
            .select('*')
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Also get calculated metrics
        let metrics = null;
        if (data) {
            metrics = calculateMetrics(convertDbToForm(data));
        }

        res.json({
            data: data || null,
            metrics
        });
    } catch (error) {
        console.error('Get today error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get record by specific date
router.get('/:date', async (req, res) => {
    try {
        const { date } = req.params;

        const { data, error } = await supabase
            .from('daily_records')
            .select('*')
            .eq('date', date)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        // Also get calculated metrics
        let metrics = null;
        if (data) {
            metrics = calculateMetrics(convertDbToForm(data));
        }

        res.json({
            data: data || null,
            metrics
        });
    } catch (error) {
        console.error('Get date error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper functions
function calculateMetrics(formData) {
    const prices = {
        e91Cost: parseFloat(formData.e91CostPrice) || 0,
        e91Sell: parseFloat(formData.e91SellPrice) || 0,
        e95Cost: parseFloat(formData.e95CostPrice) || 0,
        e95Sell: parseFloat(formData.e95SellPrice) || 0,
        b7Cost: parseFloat(formData.b7CostPrice) || 0,
        b7Sell: parseFloat(formData.b7SellPrice) || 0,
    };

    const nozzleLiters = [];
    for (let i = 1; i <= 8; i++) {
        const today = parseFloat(formData[`nozzle${i}Today`]) || 0;
        const yesterday = parseFloat(formData[`nozzle${i}Yesterday`]) || 0;
        nozzleLiters.push(today - yesterday);
    }

    const e91Liters = nozzleLiters[0] + nozzleLiters[2];
    const b7Liters = nozzleLiters[1] + nozzleLiters[3] + nozzleLiters[5] + nozzleLiters[7];
    const e95Liters = nozzleLiters[4] + nozzleLiters[6];

    const e91Sales = e91Liters * prices.e91Sell;
    const e91Profit = e91Liters * (prices.e91Sell - prices.e91Cost);

    const e95Sales = e95Liters * prices.e95Sell;
    const e95Profit = e95Liters * (prices.e95Sell - prices.e95Cost);

    const b7Sales = b7Liters * prices.b7Sell;
    const b7Profit = b7Liters * (prices.b7Sell - prices.b7Cost);

    return {
        totalSales: e91Sales + e95Sales + b7Sales,
        totalProfit: e91Profit + e95Profit + b7Profit,
        totalLiters: e91Liters + e95Liters + b7Liters,
        e91: { sales: e91Sales, profit: e91Profit, liters: e91Liters },
        e95: { sales: e95Sales, profit: e95Profit, liters: e95Liters },
        b7: { sales: b7Sales, profit: b7Profit, liters: b7Liters },
        nozzles: nozzleLiters
    };
}

function convertDbToForm(dbData) {
    return {
        e91CostPrice: dbData.e91_cost_price,
        e91SellPrice: dbData.e91_sell_price,
        e95CostPrice: dbData.e95_cost_price,
        e95SellPrice: dbData.e95_sell_price,
        b7CostPrice: dbData.b7_cost_price,
        b7SellPrice: dbData.b7_sell_price,
        nozzle1Today: dbData.nozzle_1_today,
        nozzle2Today: dbData.nozzle_2_today,
        nozzle3Today: dbData.nozzle_3_today,
        nozzle4Today: dbData.nozzle_4_today,
        nozzle5Today: dbData.nozzle_5_today,
        nozzle6Today: dbData.nozzle_6_today,
        nozzle7Today: dbData.nozzle_7_today,
        nozzle8Today: dbData.nozzle_8_today,
        nozzle1Yesterday: dbData.nozzle_1_yesterday,
        nozzle2Yesterday: dbData.nozzle_2_yesterday,
        nozzle3Yesterday: dbData.nozzle_3_yesterday,
        nozzle4Yesterday: dbData.nozzle_4_yesterday,
        nozzle5Yesterday: dbData.nozzle_5_yesterday,
        nozzle6Yesterday: dbData.nozzle_6_yesterday,
        nozzle7Yesterday: dbData.nozzle_7_yesterday,
        nozzle8Yesterday: dbData.nozzle_8_yesterday
    };
}

async function updateCalculatedMetrics(date, metrics) {
    try {
        const { error } = await supabase
            .from('daily_metrics')
            .upsert({
                date,
                total_sales: metrics.totalSales,
                total_profit: metrics.totalProfit,
                total_liters: metrics.totalLiters,
                e91_sales: metrics.e91.sales,
                e91_profit: metrics.e91.profit,
                e91_liters: metrics.e91.liters,
                e95_sales: metrics.e95.sales,
                e95_profit: metrics.e95.profit,
                e95_liters: metrics.e95.liters,
                b7_sales: metrics.b7.sales,
                b7_profit: metrics.b7.profit,
                b7_liters: metrics.b7.liters,
                nozzle_1_liters: metrics.nozzles[0],
                nozzle_2_liters: metrics.nozzles[1],
                nozzle_3_liters: metrics.nozzles[2],
                nozzle_4_liters: metrics.nozzles[3],
                nozzle_5_liters: metrics.nozzles[4],
                nozzle_6_liters: metrics.nozzles[5],
                nozzle_7_liters: metrics.nozzles[6],
                nozzle_8_liters: metrics.nozzles[7]
            }, { onConflict: 'date' });

        if (error) throw error;
    } catch (error) {
        console.error('Update metrics error:', error);
    }
}

// BACKUP CREDIT ROUTE (To bypass 404 issue)
router.post('/add-credit-legacy', async (req, res) => {
    try {
        const {
            customer_id,
            bill_book,
            bill_number,
            amount,
            vehicle_number,
            note
        } = req.body;

        const { data, error } = await supabase
            .from('credit_sales')
            .insert({
                date: new Date().toISOString(),
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
        console.error('Backup credit add error:', error);
        res.status(500).json({ error: error.message || 'Server error', details: error });
    }
});

module.exports = router;
