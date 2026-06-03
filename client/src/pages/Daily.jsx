import Footer from '../components/Footer.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { fmt, thaiDate, todayStr, dateStr } from '../lib/utils.js';

const NOZZLE_CONFIG = [
  { id: 1, label: 'หัว 1', fuel: 'E91', pump: 1 },
  { id: 2, label: 'หัว 2', fuel: 'B7',  pump: 1 },
  { id: 3, label: 'หัว 3', fuel: 'E91', pump: 1 },
  { id: 4, label: 'หัว 4', fuel: 'B7',  pump: 1 },
  { id: 5, label: 'หัว 1', fuel: 'E95', pump: 2 },
  { id: 6, label: 'หัว 2', fuel: 'B7',  pump: 2 },
  { id: 7, label: 'หัว 3', fuel: 'E95', pump: 2 },
  { id: 8, label: 'หัว 4', fuel: 'B7',  pump: 2 },
];

const initPrices = { e91CostPrice: '', e91SellPrice: '', e95CostPrice: '', e95SellPrice: '', b7CostPrice: '', b7SellPrice: '' };
const initNozzles = () => Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`nozzle${i + 1}Today`, '']));
const initYest    = () => Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`nozzle${i + 1}Yesterday`, '0.000']));

function calcMetrics(prices, nozzles, yest) {
  const liters = Array.from({ length: 8 }, (_, i) => {
    const t = parseFloat(nozzles[`nozzle${i + 1}Today`]) || 0;
    const y = parseFloat(yest[`nozzle${i + 1}Yesterday`]) || 0;
    return Math.max(0, t - y);
  });
  const e91L = liters[0] + liters[2];
  const b7L  = liters[1] + liters[3] + liters[5] + liters[7];
  const e95L = liters[4] + liters[6];
  const p = k => parseFloat(prices[k]) || 0;
  const e91Sales  = e91L * p('e91SellPrice'),  e91Profit  = e91L * (p('e91SellPrice') - p('e91CostPrice'));
  const e95Sales  = e95L * p('e95SellPrice'),  e95Profit  = e95L * (p('e95SellPrice') - p('e95CostPrice'));
  const b7Sales   = b7L  * p('b7SellPrice'),   b7Profit   = b7L  * (p('b7SellPrice')  - p('b7CostPrice'));
  return {
    totalSales: e91Sales + e95Sales + b7Sales,
    totalProfit: e91Profit + e95Profit + b7Profit,
    totalLiters: e91L + e95L + b7L,
    e91: { sales: e91Sales, profit: e91Profit, liters: e91L },
    e95: { sales: e95Sales, profit: e95Sales, liters: e95L },
    b7:  { sales: b7Sales,  profit: b7Profit,  liters: b7L  },
    nozzles: liters,
  };
}

/* ── Tank Settings Modal ── */
function TankSettingsModal({ inventory, onSave, onClose }) {
  const [settings, setSettings] = useState(() =>
    Object.fromEntries(inventory.map(item => [
      item.fuel_type,
      { initial: item.initial_liters || 0, threshold: item.alert_threshold || 1000 },
    ]))
  );

  const handleSave = async () => {
    try {
      await Promise.all(inventory.map(item =>
        api.put(`/api/inventory/fuel/${item.fuel_type}`, {
          initial_liters: parseFloat(settings[item.fuel_type]?.initial) || 0,
          alert_threshold: parseFloat(settings[item.fuel_type]?.threshold) || 0,
        })
      ));
      onSave();
      onClose();
    } catch { alert('บันทึกไม่สำเร็จ'); }
  };

  const fuelLabel = { b7: 'ดีเซล B7', e91: 'แก๊สโซฮอล์ 91', e95: 'แก๊สโซฮอล์ 95' };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-title">ตั้งค่าระดับถังเก็บน้ำมัน</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
          {inventory.map(item => (
            <div key={item.fuel_type} style={{ padding: '16px 0', borderBottom: '1px solid var(--line-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className={`fuel-bar ${item.fuel_type}`} style={{ height: 18 }} />
                <span style={{ fontSize: 16, fontWeight: 500 }}>{fuelLabel[item.fuel_type] || item.fuel_type}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">ปริมาณน้ำมันเริ่มต้น (ลิตร)</label>
                  <input type="number" className="form-input" step="0.001"
                    value={settings[item.fuel_type]?.initial || ''}
                    onChange={e => setSettings(s => ({ ...s, [item.fuel_type]: { ...s[item.fuel_type], initial: e.target.value } }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">แจ้งเตือนเมื่อเหลือ (ลิตร)</label>
                  <input type="number" className="form-input" step="0.001"
                    value={settings[item.fuel_type]?.threshold || ''}
                    onChange={e => setSettings(s => ({ ...s, [item.fuel_type]: { ...s[item.fuel_type], threshold: e.target.value } }))} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={handleSave}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}

/* ── Price Input Field ── */
function PriceField({ value, onChange, placeholder = '0.00' }) {
  return (
    <input
      type="number" step="0.01" placeholder={placeholder}
      value={value} onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: 'var(--f-mono)', fontSize: 18, fontVariantNumeric: 'tabular-nums',
        color: 'var(--ink)', background: 'transparent', border: 0,
        borderBottom: '1px solid var(--line)', padding: '6px 0', width: '100%',
        borderRadius: 0, MozAppearance: 'textfield', appearance: 'textfield',
      }}
    />
  );
}

/* ── Nozzle Input ── */
function NozzleInput({ value, onChange, isAnomaly }) {
  return (
    <input
      type="number" step="0.001" placeholder="0.000"
      value={value} onChange={e => onChange(e.target.value)}
      style={{
        fontFamily: 'var(--f-mono)', fontSize: 17, fontVariantNumeric: 'tabular-nums',
        color: isAnomaly ? '#c0392b' : 'var(--ink)',
        background: isAnomaly ? 'rgba(192,57,43,0.06)' : 'transparent',
        border: 0,
        borderBottom: isAnomaly ? '2px solid #c0392b' : '1px solid var(--line)',
        padding: '8px 6px', width: '140px',
        borderRadius: isAnomaly ? '4px 4px 0 0' : 0,
        transition: 'color .15s, border-color .15s, background .15s',
      }}
    />
  );
}

/* ────────────────────────── Main Page ────────────────────────── */
export default function Daily() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [prices, setPrices] = useState(initPrices);
  const [nozzles, setNozzles] = useState(initNozzles());
  const [yest, setYest] = useState(initYest());
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warnModal, setWarnModal] = useState(false);
  const [tankModal, setTankModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const loadInventory = useCallback(async () => {
    try {
      const res = await api.get('/api/inventory/fuel');
      if (res?.inventory) {
        const sorted = [...res.inventory].sort((a, b) => {
          const ord = { b7: 1, e91: 2, e95: 3 };
          return (ord[a.fuel_type] || 9) - (ord[b.fuel_type] || 9);
        });
        setInventory(sorted);
      }
    } catch {}
  }, []);

  const loadDate = useCallback(async (date) => {
    setLoading(true);
    try {
      const d = new Date(date);
      const yDate = new Date(d); yDate.setDate(yDate.getDate() - 1);
      const [yRes, cRes] = await Promise.all([
        api.get(`/api/daily/${dateStr(yDate)}`),
        api.get(`/api/daily/${date}`),
      ]);

      const newPrices = { ...initPrices };
      const newYest = initYest();

      if (yRes.data) {
        const y = yRes.data;
        newPrices.e91CostPrice = y.e91_cost_price ? Number(y.e91_cost_price).toFixed(2) : '';
        newPrices.e91SellPrice = y.e91_sell_price ? Number(y.e91_sell_price).toFixed(2) : '';
        newPrices.e95CostPrice = y.e95_cost_price ? Number(y.e95_cost_price).toFixed(2) : '';
        newPrices.e95SellPrice = y.e95_sell_price ? Number(y.e95_sell_price).toFixed(2) : '';
        newPrices.b7CostPrice  = y.b7_cost_price  ? Number(y.b7_cost_price).toFixed(2) : '';
        newPrices.b7SellPrice  = y.b7_sell_price  ? Number(y.b7_sell_price).toFixed(2) : '';
        for (let i = 1; i <= 8; i++) {
          newYest[`nozzle${i}Yesterday`] = y[`nozzle_${i}_today`]
            ? Number(y[`nozzle_${i}_today`]).toFixed(3) : '0.000';
        }
      }

      setPrices(newPrices);
      setYest(newYest);

      if (cRes.data) {
        const c = cRes.data;
        if (c.e91_cost_price) newPrices.e91CostPrice = Number(c.e91_cost_price).toFixed(2);
        if (c.e91_sell_price) newPrices.e91SellPrice = Number(c.e91_sell_price).toFixed(2);
        if (c.e95_cost_price) newPrices.e95CostPrice = Number(c.e95_cost_price).toFixed(2);
        if (c.e95_sell_price) newPrices.e95SellPrice = Number(c.e95_sell_price).toFixed(2);
        if (c.b7_cost_price)  newPrices.b7CostPrice  = Number(c.b7_cost_price).toFixed(2);
        if (c.b7_sell_price)  newPrices.b7SellPrice  = Number(c.b7_sell_price).toFixed(2);
        const newNozzles = initNozzles();
        for (let i = 1; i <= 8; i++) {
          const v = c[`nozzle_${i}_today`];
          if (v) newNozzles[`nozzle${i}Today`] = String(v);
        }
        setPrices({ ...newPrices });
        setNozzles(newNozzles);
      } else {
        setPrices({ ...newPrices });
        setNozzles(initNozzles());
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDate(selectedDate);
    loadInventory();
  }, [selectedDate]);

  const hasAnomalies = () =>
    Array.from({ length: 8 }, (_, i) => {
      const t = parseFloat(nozzles[`nozzle${i + 1}Today`]) || 0;
      const y = parseFloat(yest[`nozzle${i + 1}Yesterday`]) || 0;
      return t > 0 && t <= y;
    }).some(Boolean);

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const body = {
        date: selectedDate,
        e91CostPrice: parseFloat(prices.e91CostPrice),
        e91SellPrice: parseFloat(prices.e91SellPrice),
        e95CostPrice: parseFloat(prices.e95CostPrice),
        e95SellPrice: parseFloat(prices.e95SellPrice),
        b7CostPrice:  parseFloat(prices.b7CostPrice),
        b7SellPrice:  parseFloat(prices.b7SellPrice),
      };
      for (let i = 1; i <= 8; i++) {
        body[`nozzle${i}Today`]     = parseFloat(nozzles[`nozzle${i}Today`]) || 0;
        body[`nozzle${i}Yesterday`] = parseFloat(yest[`nozzle${i}Yesterday`]) || 0;
      }
      const res = await api.post('/api/daily/submit', body);
      if (res.success) toast.success('บันทึกข้อมูลสำเร็จ');
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (hasAnomalies()) setWarnModal(true);
    else doSubmit();
  };

  const m = calcMetrics(prices, nozzles, yest);

  const FUEL_CARDS = [
    { fuel: 'b7',  label: 'ดีเซล B7',      costKey: 'b7CostPrice',  sellKey: 'b7SellPrice' },
    { fuel: 'e91', label: 'แก๊สโซฮอล์ 91', costKey: 'e91CostPrice', sellKey: 'e91SellPrice' },
    { fuel: 'e95', label: 'แก๊สโซฮอล์ 95', costKey: 'e95CostPrice', sellKey: 'e95SellPrice' },
  ];

  return (
    <main className="main-container">
      {loading && <Loading />}

      {warnModal && (
        <Modal
          title="⚠️ ค่ามิเตอร์ผิดปกติ"
          message="มีหัวจ่ายที่กรอกค่าวันนี้เท่ากับหรือน้อยกว่าเมื่อวาน (ไฮไลท์สีแดง) ซึ่งอาจเกิดจากการกรอกผิด ต้องการบันทึกต่อหรือไม่?"
          onConfirm={() => { setWarnModal(false); doSubmit(); }}
          onCancel={() => setWarnModal(false)}
        />
      )}

      {tankModal && (
        <TankSettingsModal
          inventory={inventory}
          onSave={loadInventory}
          onClose={() => setTankModal(false)}
        />
      )}

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">รายวัน · Daily Operations</div>
          <h1 className="page-title">บันทึกหัวจ่าย</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DatePicker value={selectedDate} onChange={v => setSelectedDate(v)} />
        </div>
      </div>

      {/* ── TANK LEVELS ── */}
      <section style={{ marginBottom: 48 }}>
        <div className="section-hd">
          <span className="eyebrow">ระดับถังเก็บน้ำมัน</span>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setTankModal(true)}>
            ตั้งค่าถัง
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 0, borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)' }}>
          {inventory.map((item, idx) => {
            const remaining = Number(item.current_liters) || 0;
            const threshold = Number(item.alert_threshold) || 1000;
            const maxCap = Math.max(Number(item.initial_liters) || threshold * 4, threshold * 2);
            const pct = Math.min(100, Math.max(0, (remaining / maxCap) * 100));

            // traffic-light logic
            const isCritical = remaining <= threshold;
            const isWarning  = !isCritical && remaining <= threshold * 1.5;
            const barColor   = isCritical ? '#c0392b' : isWarning ? '#d4770a' : '#3a7a48';
            const statusTag  = isCritical ? { label: 'ต่ำกว่าจุดเตือน', color: '#c0392b', bg: 'rgba(192,57,43,0.1)' }
                             : isWarning  ? { label: 'ใกล้จุดเตือน',    color: '#d4770a', bg: 'rgba(212,119,10,0.1)' }
                             : null;

            const fuelLabel = { b7: 'ดีเซล B7', e91: 'แก๊สโซฮอล์ 91', e95: 'แก๊สโซฮอล์ 95' };
            return (
              <div key={item.fuel_type} style={{
                padding: '20px 24px',
                borderLeft: idx > 0 ? '1px solid var(--line-soft)' : 'none',
                background: isCritical ? 'rgba(192,57,43,0.03)' : 'transparent',
                transition: 'background .3s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div className={`fuel-bar ${item.fuel_type}`} style={{ height: 16 }} />
                  <span style={{ fontSize: 15, color: 'var(--ink-3)' }}>{fuelLabel[item.fuel_type]}</span>
                  {statusTag && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 11, fontFamily: 'var(--f-mono)',
                      letterSpacing: '0.04em', padding: '2px 8px', borderRadius: 4,
                      color: statusTag.color, background: statusTag.bg,
                    }}>
                      {statusTag.label}
                    </span>
                  )}
                </div>
                <div className="metric-value" style={{
                  fontSize: 28,
                  color: isCritical ? '#c0392b' : isWarning ? '#d4770a' : 'var(--ink)',
                }}>
                  {remaining.toFixed(0)}<span className="metric-suffix">ลิตร</span>
                </div>

                {/* progress bar — สีสื่อสถานะ */}
                <div style={{ height: 4, background: 'var(--bg-deep)', borderRadius: 2, marginTop: 14, overflow: 'hidden', position: 'relative' }}>
                  {/* threshold marker */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: Math.min(100, (threshold / maxCap) * 100) + '%',
                    width: 1, background: 'var(--ink-3)', opacity: 0.4,
                  }} />
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: barColor,
                    width: pct + '%', transition: 'width .4s, background .4s',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)' }}>
                    จุดเตือน {threshold.toLocaleString()} L
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--f-mono)', color: barColor, fontWeight: 500 }}>
                    {pct.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
          {inventory.length === 0 && (
            <div style={{ gridColumn: '1/-1', padding: 24, color: 'var(--ink-3)', fontSize: 14 }}>
              ยังไม่มีข้อมูลถังเก็บน้ำมัน
            </div>
          )}
        </div>
      </section>

      {/* ── FUEL PRICES — 3 cards inline ── */}
      <section style={{ marginBottom: 48 }}>
        <div className="section-hd">
          <span className="eyebrow">ราคาน้ำมันวันนี้</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {FUEL_CARDS.map(({ fuel, label, costKey, sellKey }) => (
            <div key={fuel} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div className={`fuel-bar ${fuel}`} style={{ height: 18 }} />
                <span style={{ fontSize: 15, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--f-mono)', color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'right' }}>ต้นทุน ฿/L</div>
                  <PriceField value={prices[costKey]} onChange={v => setPrices(p => ({ ...p, [costKey]: v }))} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontFamily: 'var(--f-mono)', color: 'var(--ink-3)', marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'right' }}>ขาย ฿/L</div>
                  <PriceField value={prices[sellKey]} onChange={v => setPrices(p => ({ ...p, [sellKey]: v }))} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── NOZZLE METERS — 2 columns (pump per column) ── */}
      <section style={{ marginBottom: 48 }}>
        <div className="section-hd">
          <span className="eyebrow">ค่ามิเตอร์หัวจ่าย</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 24 }}>
          {[1, 2].map(pump => (
            <div key={pump} className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-2)' }}>ตู้จ่ายที่ {pump}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, paddingBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>หัวจ่าย</th>
                    <th style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, paddingBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>เมื่อวาน</th>
                    <th style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, paddingBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>วันนี้</th>
                    <th style={{ textAlign: 'right', fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, paddingBottom: 10, borderBottom: '1px solid var(--line-soft)' }}>ขาย (L)</th>
                  </tr>
                </thead>
                <tbody>
                  {NOZZLE_CONFIG.filter(n => n.pump === pump).map(cfg => {
                    const todayVal = parseFloat(nozzles[`nozzle${cfg.id}Today`]) || 0;
                    const yesterdayVal = parseFloat(yest[`nozzle${cfg.id}Yesterday`]) || 0;
                    const hasInput = nozzles[`nozzle${cfg.id}Today`] !== '';
                    const isAnomaly = hasInput && todayVal <= yesterdayVal;
                    const sold = Math.max(0, todayVal - yesterdayVal);
                    return (
                      <tr key={cfg.id} style={{
                        borderBottom: '1px solid var(--line-soft)',
                        background: isAnomaly ? 'rgba(192,57,43,0.04)' : 'transparent',
                      }}>
                        <td style={{ padding: '14px 0' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className={`fuel-bar ${cfg.fuel.toLowerCase()}`} style={{ height: 20 }} />
                            <div>
                              <div style={{ fontSize: 15 }}>{cfg.label}</div>
                              <span className={`fuel-tag ${cfg.fuel.toLowerCase()}`} style={{ fontSize: 11 }}>{cfg.fuel}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '14px 0 14px 16px' }}>
                          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 14, color: 'var(--ink-3)' }}>
                            {yest[`nozzle${cfg.id}Yesterday`]}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', padding: '14px 0 14px 16px' }}>
                          <div>
                            <NozzleInput
                              value={nozzles[`nozzle${cfg.id}Today`]}
                              onChange={v => setNozzles(prev => ({ ...prev, [`nozzle${cfg.id}Today`]: v }))}
                              isAnomaly={isAnomaly}
                            />
                            {isAnomaly && (
                              <div style={{ fontSize: 11, color: '#c0392b', marginTop: 3, fontFamily: 'var(--f-mono)', textAlign: 'right' }}>
                                ≤ เมื่อวาน
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '14px 0 14px 16px', fontFamily: 'var(--f-mono)', fontSize: 15 }}>
                          {isAnomaly
                            ? <span style={{ color: '#c0392b', fontSize: 13 }}>ผิดปกติ</span>
                            : sold > 0
                            ? sold.toFixed(3)
                            : <span style={{ color: 'var(--ink-4)' }}>—</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* ── SUMMARY CARDS ── */}
      <section className="metrics-strip" style={{ marginBottom: 40 }}>
        <div className="metric-item">
          <div className="metric-label">ยอดขายรวม</div>
          <div className="metric-value">฿{fmt(m.totalSales)}</div>
        </div>
        <div className="metric-item bordered">
          <div className="metric-label">กำไรรวม</div>
          <div className="metric-value">฿{fmt(m.totalProfit)}</div>
          <div className="metric-sub">
            {m.totalSales > 0 ? `≈ ${((m.totalProfit / m.totalSales) * 100).toFixed(1)}% ของยอดขาย` : '—'}
          </div>
        </div>
        <div className="metric-item bordered">
          <div className="metric-label">ปริมาณรวม</div>
          <div className="metric-value">
            {m.totalLiters.toFixed(3)}<span className="metric-suffix">L</span>
          </div>
        </div>
      </section>

      {/* ── FUEL BREAKDOWN TABLE ── */}
      <div className="card" style={{ marginBottom: 48 }}>
        <div className="card-header"><span className="card-title">แยกตามประเภทน้ำมัน</span></div>
        <table className="data-table">
          <thead>
            <tr>
              <th></th><th>ประเภท</th>
              <th className="r">ลิตร</th><th className="r">ยอดขาย</th><th className="r">กำไร</th>
            </tr>
          </thead>
          <tbody>
            {[
              { fuel: 'b7',  label: 'ดีเซล B7',      data: m.b7  },
              { fuel: 'e91', label: 'แก๊สโซฮอล์ 91', data: m.e91 },
              { fuel: 'e95', label: 'แก๊สโซฮอล์ 95', data: m.e95 },
            ].map(({ fuel, label, data }) => (
              <tr key={fuel}>
                <td style={{ width: 8 }}><div className={`fuel-bar ${fuel}`} style={{ height: 18 }} /></td>
                <td style={{ fontSize: 16 }}>{label}</td>
                <td className="r mono">{data.liters.toFixed(3)}</td>
                <td className="r mono">฿{fmt(data.sales)}</td>
                <td className="r mono">฿{fmt(data.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── SAVE BUTTON — bottom ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 48 }}>
        <button
          className="btn btn-primary"
          style={{ fontSize: 16, padding: '12px 40px', borderRadius: 999 }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'กำลังบันทึก…' : 'บันทึกข้อมูลวันนี้'}
        </button>
      </div>

      <Footer />
    </main>
  );
}
