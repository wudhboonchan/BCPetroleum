const express = require('express');
const router = express.Router();
const https = require('https');
const crypto = require('crypto');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const LINE_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;

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

        // สร้าง public_token ถ้ายังไม่มี (invoice เก่าที่สร้างก่อน migration)
        if (invoice && !invoice.public_token) {
            const crypto = require('crypto');
            const token = crypto.randomBytes(24).toString('hex');
            await supabase.from('invoices').update({ public_token: token }).eq('id', invoiceId);
            invoice.public_token = token;
        }

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

        const publicUrl = `${baseUrl}/invoice/${invoice.public_token}`;
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
            .select(`*, customers(name, phone)`)
            .eq('public_token', invoiceId)   // query ด้วย token ไม่ใช่ id
            .single();

        if (error || !invoice) {
            return res.status(404).json({ error: 'ไม่พบใบวางบิล' });
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

// ──────────────────────────────────────────────
// Helper: ตอบกลับ LINE (Reply API)
// ──────────────────────────────────────────────
function replyMessage(replyToken, messages) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ replyToken, messages });
        const options = {
            hostname: 'api.line.me',
            path: '/v2/bot/message/reply',
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
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ──────────────────────────────────────────────
// POST /api/line/webhook  (รับ event จาก LINE)
// ──────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    // 1. ตรวจสอบ signature
    const signature = req.headers['x-line-signature'];
    const body = req.body;
    const hmac = crypto.createHmac('sha256', LINE_CHANNEL_SECRET);
    hmac.update(body);
    const digest = hmac.digest('base64');

    if (signature !== digest) {
        console.error('Invalid LINE signature');
        return res.status(401).send('Unauthorized');
    }

    const events = JSON.parse(body).events || [];
    res.status(200).send('OK'); // ตอบ LINE ก่อนทันที

    // 2. ประมวลผล events
    for (const event of events) {
        const lineUserId = event.source?.userId;
        if (!lineUserId) continue;

        try {
            // เมื่อลูกค้า Add Friend
            if (event.type === 'follow') {
                await replyMessage(event.replyToken, [{
                    type: 'text',
                    text: '👋 สวัสดีครับ ยินดีต้อนรับสู่ BC Petroleum!\n\nกรุณาพิมพ์ "รหัสลูกค้า" ของคุณเพื่อเชื่อมต่อบัญชี\nเช่น: C001\n\n(สอบถามรหัสได้ที่ทางร้าน)',
                }]);
            }

            // เมื่อลูกค้าพิมพ์ข้อความ
            if (event.type === 'message' && event.message?.type === 'text') {
                const text = event.message.text.trim().toUpperCase();

                // ค้นหาลูกค้าจากรหัส
                const { data: customer } = await supabase
                    .from('customers')
                    .select('id, name, code, line_user_id')
                    .ilike('code', text)
                    .single();

                if (!customer) {
                    await replyMessage(event.replyToken, [{
                        type: 'text',
                        text: `❌ ไม่พบรหัสลูกค้า "${text}"\n\nกรุณาตรวจสอบรหัสอีกครั้ง หรือติดต่อทางร้านครับ`,
                    }]);
                    continue;
                }

                // ถ้าเชื่อมกับ LINE อื่นอยู่แล้ว (ไม่ใช่คนนี้)
                if (customer.line_user_id && customer.line_user_id !== lineUserId) {
                    await replyMessage(event.replyToken, [{
                        type: 'text',
                        text: `⚠️ รหัสลูกค้า "${text}" ได้เชื่อมต่อกับ LINE อื่นไว้แล้ว\n\nหากต้องการเปลี่ยนแปลง กรุณาติดต่อทางร้านครับ`,
                    }]);
                    continue;
                }

                // ถ้าเป็น LINE เดิมอยู่แล้ว
                if (customer.line_user_id === lineUserId) {
                    await replyMessage(event.replyToken, [{
                        type: 'text',
                        text: `✅ คุณ ${customer.name} เชื่อมต่อ LINE นี้ไว้แล้วครับ ไม่ต้องทำอะไรเพิ่มเติม 😊`,
                    }]);
                    continue;
                }

                // บันทึก LINE User ID (ใหม่)
                await supabase
                    .from('customers')
                    .update({ line_user_id: lineUserId })
                    .eq('id', customer.id);

                await replyMessage(event.replyToken, [{
                    type: 'text',
                    text: `✅ เชื่อมต่อสำเร็จ!\n\nสวัสดีคุณ ${customer.name} ครับ\nตั้งแต่นี้เราจะส่งใบวางบิลให้คุณทาง LINE นี้โดยตรงเลยนะครับ 😊`,
                }]);
            }
        } catch (err) {
            console.error('Webhook event error:', err);
        }
    }
});

module.exports = router;
