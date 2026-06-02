const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const supabase = require('./config/supabase');
const { authMiddleware } = require('./middleware/auth');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// V2 - Serve new modern website version
// V2 route removed (promoted to main)

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
// EMERGENCY ROUTE (To fix 404)
app.post('/api/force-sales', authMiddleware, async (req, res) => {
    try {
        console.log('Force Sales Hit!', req.body);
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
        console.error('Force sales error:', error);
        res.status(500).json({ error: error.message || 'Server error', details: error });
    }
});

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const dailyRoutes = require('./routes/daily');
const creditRoutes = require('./routes/credit');
const customerRoutes = require('./routes/customer');
const reportRoutes = require('./routes/report');
const cashRoutes = require('./routes/cash');
const accountingRoutes = require('./routes/accounting');
const invoiceRoutes = require('./routes/invoices');
const inventoryRoutes = require('./routes/inventory');
const lineRoutes = require('./routes/line');

app.use('/api/auth', authRoutes);
app.use('/api/line', lineRoutes);      // ต้องอยู่ก่อน /api (cashRoutes)
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/report', reportRoutes);
app.use('/api', cashRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/inventory', inventoryRoutes);

// SPA fallback — ทุก route ที่ไม่ใช่ /api ส่งไป index.html ให้ React Router จัดการ
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`🚀 BC Petroleum Server running on http://localhost:${PORT}`);
});
