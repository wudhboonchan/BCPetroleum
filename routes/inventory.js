const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// Get Fuel Inventory 
router.get('/fuel', async (req, res) => {
    try {
        // Fetch inventory targets
        const { data: inventoryData, error: inventoryError } = await supabase
            .from('fuel_inventory')
            .select('*');

        if (inventoryError) throw inventoryError;

        // Fetch total purchases from fuel_investments
        const { data: investmentData, error: investmentError } = await supabase
            .from('fuel_investments')
            .select('fuel_type, liters');

        if (investmentError) throw investmentError;

        // Fetch total daily sales from daily_metrics
        const { data: salesData, error: salesError } = await supabase
            .from('daily_metrics')
            .select('e91_liters, e95_liters, b7_liters');

        if (salesError) throw salesError;

        // Calculate total sales
        let totalSales = { e91: 0, e95: 0, b7: 0 };
        salesData.forEach(sale => {
            totalSales.e91 += (sale.e91_liters || 0);
            totalSales.e95 += (sale.e95_liters || 0);
            totalSales.b7 += (sale.b7_liters || 0);
        });

        // Calculate total purchases
        let totalPurchases = { e91: 0, e95: 0, b7: 0 };
        investmentData.forEach(inv => {
            const ft = inv.fuel_type.toLowerCase();
            if (totalPurchases[ft] !== undefined) {
                totalPurchases[ft] += (inv.liters || 0);
            }
        });

        // Combine into final inventory
        const finalInventory = inventoryData.map(inv => {
            const ft = inv.fuel_type.toLowerCase();
            const current_liters = Number(inv.initial_liters || 0) + Number(totalPurchases[ft] || 0) - Number(totalSales[ft] || 0);
            return {
                id: inv.id,
                fuel_type: ft,
                display_name: inv.display_name,
                initial_liters: inv.initial_liters,
                alert_threshold: inv.alert_threshold,
                current_liters: current_liters
            };
        });

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
        if (initial_liters !== undefined) updateData.initial_liters = initial_liters;

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
