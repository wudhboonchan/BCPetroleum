const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get Fuel Inventory 
router.get('/fuel', async (req, res) => {
    try {
        // Fetch inventory (includes reset_at)
        const { data: inventoryData, error: inventoryError } = await supabase
            .from('fuel_inventory')
            .select('*');

        if (inventoryError) throw inventoryError;

        // For each fuel type, only sum purchases/sales AFTER reset_at
        const finalInventory = await Promise.all(inventoryData.map(async (inv) => {
            const ft = inv.fuel_type.toLowerCase();
            const resetAt = inv.reset_at || '1970-01-01';
            const resetDate = resetAt.slice(0, 10); // YYYY-MM-DD

            // Purchases after reset_at
            const { data: purchases } = await supabase
                .from('fuel_investments')
                .select('liters')
                .eq('fuel_type', ft)
                .gte('date', resetDate);

            // Sales after reset_at
            const salesCol = ft === 'e91' ? 'e91_liters' : ft === 'e95' ? 'e95_liters' : 'b7_liters';
            const { data: sales } = await supabase
                .from('daily_metrics')
                .select(salesCol)
                .gte('date', resetDate);

            const totalPurchases = (purchases || []).reduce((s, r) => s + Number(r.liters || 0), 0);
            const totalSales     = (sales     || []).reduce((s, r) => s + Number(r[salesCol] || 0), 0);

            const current_liters = Number(inv.initial_liters || 0) + totalPurchases - totalSales;

            return {
                id: inv.id,
                fuel_type: ft,
                display_name: inv.display_name,
                initial_liters: inv.initial_liters,
                alert_threshold: inv.alert_threshold,
                current_liters,
            };
        }));

        res.json({ inventory: finalInventory });
    } catch (error) {
        console.error('Get fuel inventory error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
});

// Update threshold/initial liters
router.put('/fuel/:fuel_type', async (req, res) => {
    try {
        const { fuel_type } = req.params;
        const { alert_threshold, initial_liters } = req.body;

        const updateData = {};
        if (alert_threshold !== undefined) updateData.alert_threshold = alert_threshold;
        if (initial_liters !== undefined) {
            updateData.initial_liters = initial_liters;
            updateData.reset_at = new Date().toISOString(); // reset baseline เมื่อกรอกค่าใหม่
        }

        // Ensure not empty
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No data to update' });
        }

        updateData.updated_at = new Date().toISOString();
        updateData.updated_by = req.user.id;

        const { data, error } = await supabase
            .from('fuel_inventory')
            .update(updateData)
            .eq('fuel_type', fuel_type)
            .select()
            .single();

        if (error) throw error;

        res.json({ success: true, inventory: data });
    } catch (error) {
        console.error('Update fuel inventory error:', error);
        res.status(500).json({ error: error.message || 'Server error' });
    }
});

module.exports = router;
