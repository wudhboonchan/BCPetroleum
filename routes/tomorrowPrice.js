/**
 * Tomorrow Fuel Price — Bangchak Official API + Manual Override
 *
 * ช่อง API:
 *   GET  /api/tomorrow-price          ดึงราคาพรุ่งนี้ (cache 15 นาที, fallback DB)
 *   POST /api/tomorrow-price/scrape   trigger ดึงข้อมูลด้วยมือ (admin only)
 *   POST /api/tomorrow-price/override  manual override ราคา (admin only)
 *
 * แหล่งข้อมูล: Bangchak Official API
 *   https://oil-price.bangchak.co.th/ApiOilPrice2/th
 *   Response: Array[{ OilList (JSON string), OilDateNow, ... }]
 *   OilList items: { OilName, PriceToday, PriceTomorrow, PriceDifTomorrow }
 *   B7  = "ไฮดีเซล S"
 *   E95 = "แก๊สโซฮอล์ 95 S EVO"
 *   E91 = "แก๊สโซฮอล์ 91 S EVO"
 *
 * Cron schedule (Asia/Bangkok):
 *   18:00 ทุกวัน   → ดึงอัตโนมัติ (Bangchak มักอัปเดตราคาพรุ่งนี้ช่วงเย็น)
 *   09:05 ทุกวัน   → ดึงอีกครั้ง fallback เช้า
 */

const express  = require('express');
const axios    = require('axios');
const cron     = require('node-cron');
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/* ── In-memory cache (15 นาที) ── */
let cache = { data: null, fetchedAt: null };
const CACHE_TTL_MS = 15 * 60 * 1000;

/* ──────────────────────────────────────────────────────────────────────────
   BANGCHAK OFFICIAL API
   https://oil-price.bangchak.co.th/ApiOilPrice2/th
────────────────────────────────────────────────────────────────────────── */
async function scrapeBangchak() {
    const url = 'https://oil-price.bangchak.co.th/ApiOilPrice2/th';

    const { data } = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BCPetroleum-Dashboard/1.0)' },
    });

    // Response เป็น Array — element แรกมี OilList เป็น JSON string
    const root = Array.isArray(data) ? data[0] : data;
    if (!root || !root.OilList) throw new Error('Bangchak API: ไม่พบ OilList ใน response');

    const oilList = typeof root.OilList === 'string' ? JSON.parse(root.OilList) : root.OilList;

    const result = { b7: null, e95: null, e91: null };

    for (const item of oilList) {
        const name = (item.OilName || '').trim();
        const entry = {
            today:    toNum(item.PriceToday),
            tomorrow: toNum(item.PriceTomorrow),
            diff:     toNum(item.PriceDifTomorrow),
        };

        // ไฮดีเซล S = B7 ที่ขายในปั๊มทั่วไป
        if (name === 'ไฮดีเซล S') {
            result.b7 = entry;
        } else if (name === 'แก๊สโซฮอล์ 95 S EVO') {
            result.e95 = entry;
        } else if (name === 'แก๊สโซฮอล์ 91 S EVO') {
            result.e91 = entry;
        }
    }

    const hasData = result.b7 || result.e95 || result.e91;
    if (!hasData) {
        throw new Error('Bangchak API: ไม่พบรายการ ไฮดีเซล S / แก๊สโซฮอล์ 95 / 91 ใน OilList');
    }

    return result;
}

function parseThaiFloat(text) {
    if (!text) return null;
    const cleaned = text.replace(/[^\d.-]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? null : val;
}

/* ──────────────────────────────────────────────────────────────────────────
   DB: upsert ราคาพรุ่งนี้
────────────────────────────────────────────────────────────────────────── */
async function upsertTomorrowPrice(scraped, source = 'bangchak_scrape') {
    const tomorrow = getTomorrowDate();

    const row = {
        price_date:   tomorrow,
        b7_today:     scraped.b7?.today     ?? null,
        e95_today:    scraped.e95?.today    ?? null,
        e91_today:    scraped.e91?.today    ?? null,
        b7_tomorrow:  scraped.b7?.tomorrow  ?? null,
        e95_tomorrow: scraped.e95?.tomorrow ?? null,
        e91_tomorrow: scraped.e91?.tomorrow ?? null,
        b7_diff:      scraped.b7?.diff      ?? null,
        e95_diff:     scraped.e95?.diff     ?? null,
        e91_diff:     scraped.e91?.diff     ?? null,
        source,
        scraped_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('fuel_price_tomorrow')
        .upsert(row, { onConflict: 'price_date' });

    if (error) throw error;
    return row;
}

/* ──────────────────────────────────────────────────────────────────────────
   DB: ดึงข้อมูลล่าสุด (พรุ่งนี้ หรือวันนี้ถ้ายังไม่มีพรุ่งนี้)
────────────────────────────────────────────────────────────────────────── */
async function fetchLatestFromDB() {
    const { data, error } = await supabase
        .from('fuel_price_tomorrow')
        .select('*')
        .order('price_date', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
}

/* ──────────────────────────────────────────────────────────────────────────
   Helper: วันที่พรุ่งนี้ YYYY-MM-DD (timezone-safe)
────────────────────────────────────────────────────────────────────────── */
function getTomorrowDate() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}

/* ──────────────────────────────────────────────────────────────────────────
   CRON JOBS  (ทำงานบนเซิร์ฟเวอร์ที่ตั้งเวลา Asia/Bangkok)
────────────────────────────────────────────────────────────────────────── */
function startCronJobs() {
    // 18:00 ทุกวัน — ช่วงเย็น Bangchak มักอัปเดตราคาพรุ่งนี้
    cron.schedule('0 18 * * *', async () => {
        console.log('[TomorrowPrice Cron] 18:00 — scraping Bangchak...');
        try {
            const scraped = await scrapeBangchak();
            await upsertTomorrowPrice(scraped);
            cache = { data: null, fetchedAt: null }; // bust cache
            console.log('[TomorrowPrice Cron] 18:00 — สำเร็จ:', scraped);
        } catch (err) {
            console.error('[TomorrowPrice Cron] 18:00 — ล้มเหลว:', err.message);
        }
    }, { timezone: 'Asia/Bangkok' });

    // 09:05 ทุกวัน — backup เช้า เผื่อข้อมูลยังไม่มีจากคืนก่อน
    cron.schedule('5 9 * * *', async () => {
        console.log('[TomorrowPrice Cron] 09:05 — scraping Bangchak (morning backup)...');
        try {
            const scraped = await scrapeBangchak();
            await upsertTomorrowPrice(scraped);
            cache = { data: null, fetchedAt: null };
            console.log('[TomorrowPrice Cron] 09:05 — สำเร็จ:', scraped);
        } catch (err) {
            console.error('[TomorrowPrice Cron] 09:05 — ล้มเหลว:', err.message);
        }
    }, { timezone: 'Asia/Bangkok' });

    console.log('[TomorrowPrice] Cron jobs registered (18:00 + 09:05 Asia/Bangkok)');
}

// เรียกใช้งาน cron ทันทีที่ module ถูก require
startCronJobs();

/* ══════════════════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════════════════ */

/* GET /api/tomorrow-price
   ส่งข้อมูลราคาพรุ่งนี้ — cache 15 นาที, fallback จาก DB ถ้า scrape ล้มเหลว */
router.get('/', async (req, res) => {
    try {
        // คืน cache ถ้ายังไม่หมดอายุ
        if (cache.data && cache.fetchedAt && (Date.now() - cache.fetchedAt < CACHE_TTL_MS)) {
            return res.json({ success: true, source: 'cache', data: cache.data });
        }

        // ดึงจาก DB ก่อน (เร็วกว่า scrape)
        const dbRow = await fetchLatestFromDB();
        if (dbRow) {
            const formatted = formatRow(dbRow);
            cache = { data: formatted, fetchedAt: Date.now() };
            return res.json({ success: true, source: 'database', data: formatted });
        }

        // ถ้า DB ว่าง ลอง scrape ทันที
        const scraped = await scrapeBangchak();
        const saved   = await upsertTomorrowPrice(scraped);
        const formatted = formatRow(saved);
        cache = { data: formatted, fetchedAt: Date.now() };
        return res.json({ success: true, source: 'live_scrape', data: formatted });

    } catch (err) {
        console.error('[TomorrowPrice GET] error:', err.message);
        // ถ้า cache มีข้อมูลเก่า ส่งไปก่อน
        if (cache.data) {
            return res.json({ success: true, source: 'stale_cache', data: cache.data });
        }
        res.status(503).json({ success: false, error: 'ยังไม่มีข้อมูลราคาพรุ่งนี้', detail: err.message });
    }
});

/* POST /api/tomorrow-price/scrape  (admin)
   Trigger scrape ด้วยมือผ่าน Dashboard */
router.post('/scrape', authMiddleware, async (req, res) => {
    try {
        const scraped   = await scrapeBangchak();
        const saved     = await upsertTomorrowPrice(scraped);
        const formatted = formatRow(saved);
        cache = { data: formatted, fetchedAt: Date.now() };
        res.json({ success: true, message: 'Scrape สำเร็จ', data: formatted });
    } catch (err) {
        console.error('[TomorrowPrice SCRAPE] error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* POST /api/tomorrow-price/override  (admin)
   Manual override ราคาเมื่อ scrape ล้มเหลวหรือต้องการแก้ไขมือ
   Body: { b7_today, b7_tomorrow, b7_diff, e95_today, e95_tomorrow, e95_diff, e91_today, e91_tomorrow, e91_diff } */
router.post('/override', authMiddleware, async (req, res) => {
    try {
        const { b7_today, b7_tomorrow, b7_diff, e95_today, e95_tomorrow, e95_diff, e91_today, e91_tomorrow, e91_diff } = req.body;

        const manualData = {
            b7:  { today: toNum(b7_today),  tomorrow: toNum(b7_tomorrow),  diff: toNum(b7_diff)  },
            e95: { today: toNum(e95_today), tomorrow: toNum(e95_tomorrow), diff: toNum(e95_diff) },
            e91: { today: toNum(e91_today), tomorrow: toNum(e91_tomorrow), diff: toNum(e91_diff) },
        };

        const saved     = await upsertTomorrowPrice(manualData, 'manual_override');
        const formatted = formatRow(saved);
        cache = { data: formatted, fetchedAt: Date.now() };
        res.json({ success: true, message: 'บันทึก manual override สำเร็จ', data: formatted });
    } catch (err) {
        console.error('[TomorrowPrice OVERRIDE] error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────────────── */
function toNum(v) {
    const n = parseFloat(v);
    return isNaN(n) ? null : n;
}

function formatRow(row) {
    return {
        priceDate:  row.price_date,
        source:     row.source,
        scrapedAt:  row.scraped_at,
        b7:  { today: row.b7_today,  tomorrow: row.b7_tomorrow,  diff: row.b7_diff  },
        e95: { today: row.e95_today, tomorrow: row.e95_tomorrow, diff: row.e95_diff },
        e91: { today: row.e91_today, tomorrow: row.e91_tomorrow, diff: row.e91_diff },
    };
}

module.exports = router;
