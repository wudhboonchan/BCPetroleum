const express = require('express');
const router = express.Router();
const https = require('https');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

// ──────────────────────────────────────────────
// Helper: ส่ง LINE message ด้วย Flex Message
// ──────────────────────────────────────────────
function sendLineMessage(lineUserId, messages) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ to: lineUserId, messages });
        const options = {
            hostname: 'api.line.me',
            path: '/v2/bot/message/push',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
                'Content-Length': Buffer.byteLength(body),
            },
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) resolve(JSON.parse(data || '{}'));
                else reject(new Error(`LINE API Error ${res.statusCode}: ${data}`));
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ──────────────────────────────────────────────
// สร้าง Flex Message ใบวางบิล
// ──────────────────────────────────────────────
function buildInvoiceFlex(invoice, publicUrl) {
    const isPaid = invoice.status === 'paid';
    const statusColor = isPaid ? '#22a06b' : '#d97706';
    const statusLabel = isPaid ? '✅ ชำระแล้ว' : '⏳ ค้างชำระ';
    const totalStr = Number(invoice.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 });
    const issueDate = invoice.issue_date ? invoice.issue_date.split('T')[0] : '';
    const billCount = (invoice.bills || []).length;

    return {
        type: 'flex',
        altText: `ใบวางบิล ${invoice.invoice_number} — ฿${totalStr}`,
        contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#2D3E50',
                paddingAll: '16px',
                contents: [
                    { type: 'text', text: 'BC Petroleum', color: '#aabbcc', size: 'xs', weight: 'bold' },
                    { type: 'text', text: `ใบวางบิล ${invoice.invoice_number}`, color: '#ffffff', size: 'lg', weight: 'bold' },
                    { type: 'text', text: `วันที่: ${issueDate}`, color: '#ccddee', size: 'xs' },
                ],
            },
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'md',
                paddingAll: '16px',
                contents: [
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: 'ลูกค้า', size: 'sm', color: '#888888', flex: 2 },
                            { type: 'text', text: invoice.customers?.name || '-', size: 'sm', weight: 'bold', flex: 4, wrap: true },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: 'จำนวนบิล', size: 'sm', color: '#888888', flex: 2 },
                            { type: 'text', text: `${billCount} รายการ`, size: 'sm', weight: 'bold', flex: 4 },
                        ],
                    },
                    { type: 'separator' },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        contents: [
                            { type: 'text', text: 'ยอดรวม', size: 'md', color: '#444444', flex: 2 },
                            { type: 'text', text: `฿${totalStr}`, size: 'xl', weight: 'bold', color: '#d97706', flex: 4, align: 'end' },
                        ],
                    },
                    {
                        type: 'box',
                        layout: 'horizontal',
                        backgroundColor: isPaid ? '#f0fdf4' : '#fffbeb',
                        cornerRadius: '6px',
                        paddingAll: '8px',
                        contents: [
                            { type: 'text', text: statusLabel, size: 'sm', color: statusColor, weight: 'bold', align: 'center' },
                        ],
                    },
                ],
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                paddingAll: '12px',
                contents: [
                    {
                        type: 'button',
                        action: { type: 'uri', label: '📄 ดูรายละเอียดใบวางบิล', uri: publicUrl },
                        style: 'primary',
                        color: '#2D3E50',
                        height: 'sm',
                    },
                ],
            },
        },
    };
}

// ──────────────────────────────────────────────
// POST /api/line/send-invoice/:invoiceId
// ──────────────────────────────────────────────
router.post('/send-invoice/:invoiceId', authMiddleware, async (req, res) => {
    try {
        if (!LINE_ACCESS_TOKEN) {
            return res.status(500).json({ error: 'ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN' });
        }

        const { invoiceId } = req.params;
        const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;

        // ดึงข้อมูลใบวางบิล + ลูกค้า
        const { data: invoice, error: invErr } = await supabase
            .from('invoices')
            .select(`*, customers(id, name, line_user_id)`)
            .eq('id', invoiceId)
            .single();

        if (invErr || !invoice) return res.status(404).json({ error: 'ไม่พบใบวางบิล' });

        // ดึง bills
        const { data: bills } = await supabase
            .from('credit_sales')
            .select('*')
            .eq('invoice_id', invoiceId)
            .order('date', { ascending: true });
        invoice.bills = bills || [];

        const lineUserId = invoice.customers?.line_user_id;
        if (!lineUserId) {
            return res.status(400).json({ error: 'ลูกค้ารายนี้ยังไม่มี LINE User ID — กรุณาใส่ข้อมูลในโปรไฟล์ลูกค้าก่อน' });
        }

        const publicUrl = `${baseUrl}/invoice/${invoiceId}`;
        const flexMsg = buildInvoiceFlex(invoice, publicUrl);

        await sendLineMessage(lineUserId, [flexMsg]);

        res.json({ success: true, message: `ส่งใบวางบิลทาง LINE ให้ ${invoice.customers.name} สำเร็จ` });
    } catch (error) {
        console.error('LINE send error:', error);
        res.status(500).json({ error: error.message || 'ส่ง LINE ไม่สำเร็จ' });
    }
});

// ──────────────────────────────────────────────
// GET /api/line/invoice/:invoiceId  (Public — ไม่ต้อง login)
// ──────────────────────────────────────────────
router.get('/invoice/:invoiceId', async (req, res) => {
    try {
        const { invoiceId } = req.params;

        const { data: invoice, error } = await supabase
            .from('invoices')
            .select(`*, customers(name, phone, address)`)
            .eq('id', invoiceId)
            .single();

        if (error || !invoice) {
            console.error('Invoice fetch error:', error, 'invoiceId:', invoiceId);
            return res.status(404).json({ error: 'ไม่พบใบวางบิล', detail: error?.message, invoiceId });
        }

        const { data: bills } = await supabase
            .from('credit_sales')
            .select('date, bill_book, bill_number, vehicle_number, amount, note')
            .eq('invoice_id', invoiceId)
            .order('date', { ascending: true });

        invoice.bills = bills || [];
        res.json({ invoice });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
