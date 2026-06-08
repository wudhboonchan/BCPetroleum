const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get dashboard summary
router.get('/summary', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Execute queries in parallel
        const [todayResult, weekResult, creditResult] = await Promise.all([
            // 1. Get today's sales
            supabase
                .from('daily_records')
                .select('*')
                .eq('date', today)
                .single(),

            // 2. Get last 7 days sales
            supabase
                .from('daily_records')
                .select('*')
                .gte('date', sevenDaysAgo)
                .lte('date', today)
                .order('date', { ascending: true }),

            // 3. Get credit sales (unpaid)
            supabase
                .from('credit_sales')
                .select('amount')
                .eq('paid', false)
        ]);

        const todaySales = todayResult.data;
        const todayError = todayResult.error;
        const weekRecords = weekResult.data;
        const weekError = weekResult.error;
        const creditSales = creditResult.data;
        const creditError = creditResult.error;

        console.log(`[Dashboard Debug] Query: ${sevenDaysAgo} to ${today}`);
        console.log(`[Dashboard Debug] Found: ${weekRecords ? weekRecords.length : 0} records`);
        if (weekError) console.error('[Dashboard Debug] Error:', weekError);

        // Calculate metrics for each day
        const last7Days = weekRecords?.map(record => {
            const metrics = calculateDailyMetrics(record);
            return {
                date: record.date,
                total_sales: metrics.totalSales,
                total_profit: metrics.totalProfit,
                total_liters: metrics.totalLiters
            };
        }) || [];

        const totalCredit = creditSales?.reduce((sum, sale) => sum + parseFloat(sale.amount), 0) || 0;

        // Calculate today's metrics or return zeros if no data
        let todayMetrics = {
            totalSales: 0,
            totalProfit: 0,
            totalLiters: 0,
            e91Sales: 0,
            e95Sales: 0,
            b7Sales: 0,
            nozzleData: Array(8).fill(0)
        };

        if (todaySales) {
            todayMetrics = calculateDailyMetrics(todaySales);
        }

        res.json({
            today: todayMetrics,
            last7Days: last7Days || [],
            totalCredit: totalCredit,
            debug: {
                serverTime: new Date().toISOString(),
                queryStart: sevenDaysAgo,
                queryEnd: today,
                recordsFound: weekRecords ? weekRecords.length : 0,
                error: weekError ? weekError.message : null
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Helper function to calculate daily metrics
function calculateDailyMetrics(record) {
    const prices = {
        e91Cost: parseFloat(record.e91_cost_price) || 0,
        e91Sell: parseFloat(record.e91_sell_price) || 0,
        e95Cost: parseFloat(record.e95_cost_price) || 0,
        e95Sell: parseFloat(record.e95_sell_price) || 0,
        b7Cost: parseFloat(record.b7_cost_price) || 0,
        b7Sell: parseFloat(record.b7_sell_price) || 0,
    };

    // Calculate liters for each nozzle (today - yesterday)
    const nozzleLiters = [];
    for (let i = 1; i <= 8; i++) {
        const today = parseFloat(record[`nozzle_${i}_today`]) || 0;
        const yesterday = parseFloat(record[`nozzle_${i}_yesterday`]) || 0;
        nozzleLiters.push(today - yesterday);
    }

    // Sum by fuel type
    const e91Liters = nozzleLiters[0] + nozzleLiters[2]; // Nozzle 1, 3
    const b7Liters_pump1 = nozzleLiters[1] + nozzleLiters[3]; // Nozzle 2, 4
    const e95Liters = nozzleLiters[4] + nozzleLiters[6]; // Nozzle 5, 7
    const b7Liters_pump2 = nozzleLiters[5] + nozzleLiters[7]; // Nozzle 6, 8
    const b7Liters = b7Liters_pump1 + b7Liters_pump2;

    // Calculate sales and profit
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
        e91Sales,
        e91Profit,
        e91Liters,
        e95Sales,
        e95Profit,
        e95Liters,
        b7Sales,
        b7Profit,
        b7Liters,
        nozzleData: nozzleLiters
    };
}

// In-memory cache for daily oil prices
let oilPricesCache = {
    data: null,
    lastFetched: null
};

// GET /api/dashboard/oil-prices
router.get('/oil-prices', async (req, res) => {
    try {
        const now = Date.now();
        // Cache for 6 hours (21600000 ms)
        if (oilPricesCache.data && oilPricesCache.lastFetched && (now - oilPricesCache.lastFetched < 6 * 60 * 60 * 1000)) {
            console.log('[Oil Price Cache] Returning cached data');
            return res.json(oilPricesCache.data);
        }

        console.log('[Oil Price Cache] Cache expired or empty. Fetching from api.chnwt.dev...');
        const https = require('https');
        
        const fetchPrices = () => {
            return new Promise((resolve, reject) => {
                https.get('https://api.chnwt.dev/thai-oil-api/latest', (response) => {
                    let data = '';
                    response.on('data', (chunk) => {
                        data += chunk;
                    });
                    response.on('end', () => {
                        try {
                            const parsed = JSON.parse(data);
                            resolve(parsed);
                        } catch (err) {
                            reject(err);
                        }
                    });
                }).on('error', (err) => {
                    reject(err);
                });
            });
        };

        const result = await fetchPrices();
        if (result && result.status === 'success') {
            oilPricesCache.data = result.response;
            oilPricesCache.lastFetched = now;
            return res.json(oilPricesCache.data);
        } else {
            throw new Error(result?.response || 'Failed to fetch prices');
        }

    } catch (error) {
        console.error('Oil price fetch error:', error);
        // Fallback to cache even if expired
        if (oilPricesCache.data) {
            console.log('[Oil Price Cache] Fetch failed. Returning expired cache data.');
            return res.json(oilPricesCache.data);
        }
        res.status(500).json({ error: 'Failed to retrieve oil prices' });
    }
});

module.exports = router;
