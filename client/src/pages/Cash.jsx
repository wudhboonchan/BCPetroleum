import Footer from '../components/Footer.jsx';
import { IconWarning } from '../components/Icons.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { fmt, todayStr } from '../lib/utils.js';

const BILLS = [
  { id: 'bills_1000', label: '1,000', value: 1000, color: '#4a4a6a' },
  { id: 'bills_500',  label: '500',   value: 500,  color: '#7c4fa0' },
  { id: 'bills_100',  label: '100',   value: 100,  color: '#c0392b' },
  { id: 'bills_50',   label: '50',    value: 50,   color: '#2563af' },
  { id: 'bills_20',   label: '20',    value: 20,   color: '#27ae60' },
  { id: 'coins_10',   label: 'เหรียญ 10', value: 10, color: '#e07b39' },
  { id: 'coins_5',    label: 'เหรียญ 5',  value: 5,  color: '#e07b39' },
  { id: 'coins_2',    label: 'เหรียญ 2',  value: 2,  color: '#e07b39' },
  { id: 'coins_1',    label: 'เหรียญ 1',  value: 1,  color: '#e07b39' },
];

const FUEL_TYPES = [
  { id: 'b7',  label: 'B7',  color: '#2563af', bg: 'rgba(37,99,175,0.12)', priceKey: 'b7_sell_price' },
  { id: 'e91', label: '91',  color: '#c0392b', bg: 'rgba(192,57,43,0.12)', priceKey: 'e91_sell_price' },
  { id: 'e95', label: '95',  color: '#27ae60', bg: 'rgba(39,174,96,0.12)', priceKey: 'e95_sell_price' },
];

const WORKING_CHANGE = 1000;

export default function Cash() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Cash counter
  const [counts, setCounts] = useState(Object.fromEntries(BILLS.map(b => [b.id, ''])));
  const [bankTransfer, setBankTransfer] = useState('');

  // Personal fuel
  const [prices, setPrices] = useState({});
  const [fuelAmounts, setFuelAmounts] = useState({ b7: '', e91: '', e95: '' }); // บาท
  const [fuelUsageList, setFuelUsageList] = useState([]);
  const [fuelSubmitting, setFuelSubmitting] = useState(false);

  // Credit payments
  const [creditPayments, setCreditPayments] = useState([]);

  // Safe (กล่องเซฟ)
  const [safeRecord, setSafeRecord] = useState(null);
  const [prevClosingBalance, setPrevClosingBalance] = useState(0);
  const [prevClosingBills, setPrevClosingBills] = useState({});
  const [safeCounts, setSafeCounts] = useState(Object.fromEntries(BILLS.map(b => [b.id + '_open', ''])));
  const [safeCloseCounts, setSafeCloseCounts] = useState(Object.fromEntries(BILLS.map(b => [b.id + '_close', ''])));
  const [safeSubmitting, setSafeSubmitting] = useState(false);

  // Summary (customers no longer needed — payments are auto-populated)
  const [metrics, setMetrics] = useState({});
  const [totalCreditSales, setTotalCreditSales] = useState(0);
  const [cashRecord, setCashRecord] = useState(null);

  const toast = useToast();

  /* ── safe computed ── */
  const safeOpenTotal = BILLS.reduce((s, b) => s + (parseInt(safeCounts[b.id + '_open']) || 0) * b.value, 0);
  const safeCloseTotal = BILLS.reduce((s, b) => s + (parseInt(safeCloseCounts[b.id + '_close']) || 0) * b.value, 0);

  /* ── computed ── */
  const cashTotal = BILLS.reduce((s, b) => s + (parseInt(counts[b.id]) || 0) * b.value, 0);
  const netCash   = cashTotal - WORKING_CHANGE;
  const bankTotal = parseInt((bankTransfer || '').replace(/,/g, '')) || 0;
  const totalRevenue = netCash + bankTotal;

  const totalFuelValue = fuelUsageList.reduce((s, f) => s + parseFloat(f.total_value || 0), 0);
  const confirmedCreditPayments = creditPayments.filter(p => p.is_confirmed);
  const totalCreditReceived = confirmedCreditPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  const expectedSales = metrics?.total_sales || 0;
  const adjustedExpected = expectedSales - totalCreditSales - totalFuelValue;
  const difference = totalRevenue - adjustedExpected;

  /* ── load ── */
  const load = useCallback(async (date) => {
    setLoading(true);
    try {
      const cashRes = await api.get(`/api/cash/${date}`);

      const { cashRecord: cr, fuelUsage, creditPayments: cp, metrics: m, prices: p, totalCreditSales: tcs } = cashRes;

      setCashRecord(cr || null);
      setFuelUsageList(fuelUsage || []);
      setCreditPayments(cp || []);
      setMetrics(m || {});
      setPrices(p || {});
      setTotalCreditSales(tcs || 0);

      if (cr) {
        setCounts({
          bills_1000: cr.bills_1000 || '',
          bills_500:  cr.bills_500  || '',
          bills_100:  cr.bills_100  || '',
          bills_50:   cr.bills_50   || '',
          bills_20:   cr.bills_20   || '',
          coins_10:   cr.coins_10   || '',
          coins_5:    cr.coins_5    || '',
          coins_2:    cr.coins_2    || '',
          coins_1:    cr.coins_1    || '',
        });
        setBankTransfer(cr.bank_transfer_amount ? String(cr.bank_transfer_amount) : '');
      } else {
        setCounts(Object.fromEntries(BILLS.map(b => [b.id, ''])));
        setBankTransfer('');
      }

      // Load safe record
      try {
        const safeRes = await api.get(`/api/safe/${date}`);
        setSafeRecord(safeRes.safeRecord || null);
        setPrevClosingBalance(safeRes.prevClosingBalance || 0);
        setPrevClosingBills(safeRes.prevClosingBills || {});
        const sr = safeRes.safeRecord;
        if (sr) {
          // We store totals per column, not per-bill breakdown for safe
          // opening_balance and closing_balance are stored as totals
          setSafeCounts(Object.fromEntries(BILLS.map(b => [b.id + '_open', ''])));
          setSafeCloseCounts(Object.fromEntries(BILLS.map(b => [b.id + '_close', ''])));
        } else {
          setSafeCounts(Object.fromEntries(BILLS.map(b => [b.id + '_open', ''])));
          setSafeCloseCounts(Object.fromEntries(BILLS.map(b => [b.id + '_close', ''])));
        }
      } catch { /* safe not critical */ }

    } catch { toast.error('โหลดข้อมูลไม่ได้'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(selectedDate); }, [selectedDate]);

  /* ── personal fuel ── */
  const addFuel = async (fuelType) => {
    const amount = parseFloat(fuelAmounts[fuelType]);
    if (!amount || amount <= 0) return toast.error('กรอกจำนวนเงินให้ถูกต้อง');
    setFuelSubmitting(true);
    try {
      await api.post('/api/personal-fuel', { date: selectedDate, fuel_type: fuelType, amount });
      toast.success('บันทึกการเติมน้ำมันแล้ว');
      setFuelAmounts(f => ({ ...f, [fuelType]: '' }));
      load(selectedDate);
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setFuelSubmitting(false); }
  };

  const deleteFuel = async (id) => {
    try {
      await api.del(`/api/personal-fuel/${id}`);
      toast.success('ลบรายการแล้ว');
      load(selectedDate);
    } catch { toast.error('ลบไม่ได้'); }
  };

  /* ── credit payment — revert via invoice ── */
  const [revertModal, setRevertModal] = useState(null); // invoiceId to revert

  const revertPayment = (invoiceId) => {
    if (!invoiceId) return toast.error('ไม่พบข้อมูลใบวางบิล');
    setRevertModal(invoiceId);
  };

  const doRevertPayment = async () => {
    const invoiceId = revertModal;
    setRevertModal(null);
    try {
      await api.post(`/api/invoices/${invoiceId}/revert-payment`, {});
      toast.success('ยกเลิกการรับชำระสำเร็จ');
      load(selectedDate);
    } catch (err) { toast.error(err.message || 'ยกเลิกไม่ได้'); }
  };

  /* ── save cash ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/cash', {
        date: selectedDate,
        ...Object.fromEntries(BILLS.map(b => [b.id, parseInt(counts[b.id]) || 0])),
        bank_transfer_amount: bankTotal,
      });
      toast.success('บันทึกยอดเงินสำเร็จ');
      load(selectedDate);
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setSubmitting(false); }
  };

  /* ── save safe ── */
  const handleSafeSave = async () => {
    setSafeSubmitting(true);
    try {
      const closingBills = Object.fromEntries(BILLS.map(b => [b.id, parseInt(safeCloseCounts[b.id + '_close']) || 0]));
      await api.post('/api/safe', {
        date: selectedDate,
        prev_closing_balance: prevClosingBalance,
        opening_balance: safeOpenTotal,
        closing_balance: safeCloseTotal,
        closing_bills: closingBills,
      });
      toast.success('บันทึกยอดเซฟสำเร็จ');
      load(selectedDate);
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setSafeSubmitting(false); }
  };

  /* ── diff color ── */
  const diffColor = difference > 0 ? '#27ae60' : difference < 0 ? '#c0392b' : 'var(--ink-3)';

  return (
    <main className="main-container">
      {loading && <Loading />}

      <div className="page-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="page-eyebrow">เงินสด · Cash</div>
          <h1 className="page-title">จัดการเงินสด · ปิดยอดรายวัน</h1>
        </div>
        <DatePicker value={selectedDate} onChange={v => setSelectedDate(v)} />
      </div>

      {/* ── STEP 1: เติมน้ำมันใช้เอง ── */}
      <section style={{ marginBottom: 32 }}>
        <SectionLabel step={1} label="เติมน้ำมันใช้เอง" />
        <div className="card">
          {/* แจ้งเตือนถ้าไม่มีราคา */}
          {Object.values(prices).every(v => !v) && !loading && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.2)', color: '#c0392b', fontSize: 13 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconWarning style={{ width: 14, height: 14, flexShrink: 0 }} />ยังไม่มีข้อมูลราคาน้ำมันสำหรับวันนี้ — กรุณากรอกราคาในหน้า <strong>รายวัน</strong> ก่อนใช้ฟังก์ชันนี้</span>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 20 }}>
            {FUEL_TYPES.map(ft => {
              const price = prices[ft.priceKey] || 0;
              const noPriceData = !price;
              const amt = parseFloat(fuelAmounts[ft.id]) || 0;
              const liters = price > 0 ? (amt / price).toFixed(2) : '—';
              return (
                <div key={ft.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, padding: '2px 10px', borderRadius: 4, background: ft.bg, color: ft.color }}>{ft.label}</span>
                    {price > 0
                      ? <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)' }}>@ ฿{parseFloat(price).toFixed(2)} / ลิตร</span>
                      : <span style={{ fontSize: 12, color: '#c0392b' }}>ไม่มีราคา</span>
                    }
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 4, display: 'block' }}>จำนวนเงิน (฿)</label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="number" min="0" placeholder="0"
                        value={fuelAmounts[ft.id]}
                        disabled={noPriceData}
                        onChange={e => setFuelAmounts(f => ({ ...f, [ft.id]: e.target.value }))}
                        className="form-input"
                        style={{ flex: 1, fontFamily: 'var(--f-mono)', opacity: noPriceData ? 0.4 : 1 }}
                      />
                      <span style={{ fontSize: 12, color: 'var(--ink-3)', whiteSpace: 'nowrap', fontFamily: 'var(--f-mono)', minWidth: 60 }}>
                        {price > 0 && amt > 0 ? `${liters} ลิตร` : ''}
                      </span>
                      <button
                        type="button"
                        disabled={fuelSubmitting || !fuelAmounts[ft.id] || noPriceData}
                        onClick={() => noPriceData
                          ? toast.error('ไม่มีข้อมูลราคาน้ำมัน กรุณากรอกราคาในหน้ารายวันก่อน')
                          : addFuel(ft.id)
                        }
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '6px 14px', whiteSpace: 'nowrap', opacity: noPriceData ? 0.4 : 1 }}>
                        + เพิ่ม
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {fuelUsageList.length > 0 ? (
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>ประเภท</th>
                  <th className="r">ราคา/ลิตร</th>
                  <th className="r">จำนวน (ลิตร)</th>
                  <th className="r">มูลค่า</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fuelUsageList.map(f => (
                  <tr key={f.id}>
                    <td>{FUEL_TYPES.find(t => t.id === f.fuel_type)?.label || f.fuel_type}</td>
                    <td className="r mono">฿{parseFloat(f.price_per_liter).toFixed(2)}</td>
                    <td className="r mono">{parseFloat(f.liters).toFixed(2)}</td>
                    <td className="r mono">฿{fmt(f.total_value)}</td>
                    <td style={{ paddingLeft: 24 }}>
                      <button onClick={() => deleteFuel(f.id)}
                        style={{ fontSize: 11, padding: '3px 12px', border: '1px solid var(--rust)', borderRadius: 4, background: 'none', color: 'var(--rust)', cursor: 'pointer' }}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--line-soft)' }}>
                  <td colSpan="3" style={{ fontWeight: 600 }}>รวมมูลค่าใช้เอง</td>
                  <td className="r mono" style={{ fontWeight: 600 }}>฿{fmt(totalFuelValue)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--ink-4)', fontSize: 13 }}>ไม่มีรายการใช้เองวันนี้</div>
          )}
        </div>
      </section>

      {/* ── STEP 2: นับเงินสด + ยอดโอน ── */}
      <section style={{ marginBottom: 32 }}>
        <SectionLabel step={2} label="นับเงินสดและยอดโอน" />
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 32 }}>
            {/* นับธนบัตร */}
            <div className="card">
              <div className="card-header"><span className="card-title">นับธนบัตร / เหรียญ</span></div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ชนิด</th>
                    <th className="r">จำนวน</th>
                    <th className="r">มูลค่า</th>
                  </tr>
                </thead>
                <tbody>
                  {BILLS.map(b => {
                    const count = parseInt(counts[b.id]) || 0;
                    return (
                      <tr key={b.id}>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 4, background: b.color + '22', color: b.color, fontFamily: 'var(--f-mono)' }}>
                            {b.label}
                          </span>
                        </td>
                        <td className="r">
                          <input type="number" min="0" placeholder="0"
                            value={counts[b.id]}
                            onChange={e => setCounts(c => ({ ...c, [b.id]: e.target.value }))}
                            style={{ width: 90, textAlign: 'right', fontFamily: 'var(--f-mono)', border: '1px solid var(--line-soft)', borderRadius: 4, padding: '3px 8px' }}
                          />
                        </td>
                        <td className="r mono" style={{ color: count > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>฿{fmt(count * b.value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--bg-deep)', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>รวมเงินสดทั้งหมด</span>
                  <span className="mono" style={{ fontWeight: 600 }}>฿{fmt(cashTotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>หักเงินทอน</span>
                  <span className="mono" style={{ color: '#c0392b' }}>-฿{fmt(WORKING_CHANGE)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>เงินสดสุทธิ</span>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 18, color: netCash >= 0 ? 'var(--ink)' : '#c0392b' }}>฿{fmt(netCash)}</span>
                </div>
              </div>
            </div>

            {/* โอนธนาคาร + บันทึก */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="card">
                <div className="card-header"><span className="card-title">ยอดเงินโอนวันนี้</span></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22, color: 'var(--ink-3)' }}>฿</span>
                  <input
                    type="text" className="form-input"
                    value={bankTransfer ? Number(bankTransfer.replace(/,/g, '')).toLocaleString('en-US') : ''}
                    placeholder="0"
                    onChange={e => setBankTransfer(e.target.value.replace(/[^0-9]/g, ''))}
                    style={{ fontSize: 22, fontFamily: 'var(--f-mono)', flex: 1 }}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-header"><span className="card-title">รวมรายรับวันนี้</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { label: 'เงินสดสุทธิ', value: netCash },
                    { label: 'เงินโอน', value: bankTotal },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{label}</span>
                      <span className="mono" style={{ fontSize: 18 }}>฿{fmt(value)}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>รวมทั้งหมด</span>
                    <span className="mono" style={{ fontSize: 28, fontWeight: 300 }}>฿{fmt(totalRevenue)}</span>
                  </div>
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full" disabled={submitting}
                style={{ fontSize: 15, padding: '14px 0', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center' }}>
                {submitting ? 'กำลังบันทึก…' : 'บันทึกยอดเงินวันนี้'}
              </button>
            </div>
          </div>
        </form>
      </section>

      {/* ── STEP 3: รับชำระหนี้เงินเชื่อ ── */}
      <section style={{ marginBottom: 32 }}>
        <SectionLabel step={3} label="รับชำระหนี้ลูกค้าเงินเชื่อ" />
        <div className="card">
          <p style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 16 }}>
            รายการด้านล่างถูกสร้างอัตโนมัติเมื่อใบวางบิลถูกเปลี่ยนสถานะเป็น "จ่ายแล้ว" — หากต้องการยกเลิก ให้กดปุ่มยกเลิกการชำระ
          </p>
          {creditPayments.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>ลูกค้า</th>
                  <th style={{ width: '13%', textAlign: 'right', paddingRight: 20 }}>ยอดเงิน</th>
                  <th style={{ width: '12%', paddingLeft: 20 }}>วิธีชำระ</th>
                  <th style={{ paddingLeft: 20 }}>หมายเหตุ / ใบวางบิล</th>
                  <th style={{ width: '140px' }}></th>
                </tr>
              </thead>
              <tbody>
                {creditPayments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.customer?.name || '—'}</td>
                    <td style={{ textAlign: 'right', paddingRight: 20, fontFamily: 'var(--f-mono)' }}>฿{fmt(p.amount)}</td>
                    <td style={{ fontSize: 13, paddingLeft: 20 }}>{p.payment_method === 'transfer' ? 'โอน' : 'เงินสด'}</td>
                    <td style={{ fontSize: 13, color: 'var(--ink-3)', paddingLeft: 20 }}>{p.note || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => revertPayment(p.invoice_id)}
                        style={{ fontSize: 11, padding: '3px 12px', border: '1px solid var(--rust)', borderRadius: 4, background: 'none', color: 'var(--rust)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        ยกเลิกการชำระ
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: '2px solid var(--line-soft)' }}>
                  <td style={{ fontWeight: 600 }}>รวมรับชำระ</td>
                  <td style={{ textAlign: 'right', paddingRight: 20, fontFamily: 'var(--f-mono)', fontWeight: 600 }}>฿{fmt(totalCreditReceived)}</td>
                  <td colSpan="3" />
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-4)', fontSize: 13 }}>
              ไม่มีรายการรับชำระในวันนี้
            </div>
          )}
        </div>
      </section>

      {/* ── STEP 4: ยอดเงินในเซฟ ── */}
      <section style={{ marginBottom: 32 }}>
        <SectionLabel step={4} label="ยอดเงินในกล่องเซฟ" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>

          {/* คอลัมน์ 1: ยอดปิดเมื่อวาน (read-only) */}
          <div className="card" style={{ opacity: 0.85 }}>
            <div className="card-header"><span className="card-title">ยอดปิดเมื่อวาน</span></div>
            <table className="data-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr><th>ชนิด</th><th className="r">จำนวน</th><th className="r">มูลค่า</th></tr>
              </thead>
              <tbody>
                {BILLS.map(b => {
                  const count = parseInt(prevClosingBills[b.id]) || 0;
                  return (
                    <tr key={b.id}>
                      <td><span style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 4, background: b.color + '22', color: b.color, fontFamily: 'var(--f-mono)' }}>{b.label}</span></td>
                      <td className="r">
                        <div style={{ height: 27.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: 'var(--f-mono)', fontSize: 14, color: count > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                          {count || '—'}
                        </div>
                      </td>
                      <td className="r">
                        <div style={{ height: 27.5, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: 'var(--f-mono)', fontSize: 14, color: count > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>
                          ฿{fmt(count * b.value)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>รวม</span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 20 }}>฿{fmt(prevClosingBalance)}</span>
            </div>
          </div>

          {/* คอลัมน์ 2: นับก่อนเอาของวันนี้ไปรวม */}
          <div className="card">
            <div className="card-header"><span className="card-title">นับเปิดเซฟ (ก่อนรวมวันนี้)</span></div>
            <table className="data-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr><th>ชนิด</th><th className="r">จำนวน</th><th className="r">มูลค่า</th></tr>
              </thead>
              <tbody>
                {BILLS.map(b => {
                  const count = parseInt(safeCounts[b.id + '_open']) || 0;
                  return (
                    <tr key={b.id}>
                      <td><span style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 4, background: b.color + '22', color: b.color, fontFamily: 'var(--f-mono)' }}>{b.label}</span></td>
                      <td className="r">
                        <input type="number" min="0" placeholder="0"
                          value={safeCounts[b.id + '_open']}
                          onChange={e => setSafeCounts(c => ({ ...c, [b.id + '_open']: e.target.value }))}
                          style={{ width: 80, textAlign: 'right', fontFamily: 'var(--f-mono)', border: '1px solid var(--line-soft)', borderRadius: 4, padding: '3px 8px' }}
                        />
                      </td>
                      <td className="r mono" style={{ color: count > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>฿{fmt(count * b.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>รวม</span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 20 }}>฿{fmt(safeOpenTotal)}</span>
            </div>
            {(() => {
              const diff = safeOpenTotal - prevClosingBalance;
              if (prevClosingBalance === 0 && safeOpenTotal === 0) return null;
              if (diff === 0) return (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#27ae60' }}>ยอดตรงกับวานนี้</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: '#27ae60' }}>฿0</span>
                </div>
              );
              if (diff < 0) return (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(37,99,175,0.08)', border: '1px solid rgba(37,99,175,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: '#2563af' }}>นำออกไปใช้</span>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: '#2563af' }}>-฿{fmt(Math.abs(diff))}</span>
                </div>
              );
              return (
                <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#c0392b', display: 'flex', alignItems: 'center', gap: 4 }}><IconWarning style={{ width: 13, height: 13 }} />เงินเกินกว่าวานนี้</span>
                    <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: '#c0392b' }}>+฿{fmt(diff)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#c0392b' }}>ยอดเปิดเซฟสูงกว่ายอดปิดเมื่อวาน — กรุณาตรวจสอบอีกครั้ง</div>
                </div>
              );
            })()}
            {safeRecord && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-4)', textAlign: 'right' }}>บันทึกแล้ว: ฿{fmt(safeRecord.opening_balance)}</div>
            )}
          </div>

          {/* คอลัมน์ 3: ยอดปิดเซฟวันนี้ */}
          <div className="card">
            <div className="card-header"><span className="card-title">นับปิดเซฟวันนี้</span></div>
            <table className="data-table" style={{ marginBottom: 8 }}>
              <thead>
                <tr><th>ชนิด</th><th className="r">จำนวน</th><th className="r">มูลค่า</th></tr>
              </thead>
              <tbody>
                {BILLS.map(b => {
                  const count = parseInt(safeCloseCounts[b.id + '_close']) || 0;
                  return (
                    <tr key={b.id}>
                      <td><span style={{ fontWeight: 700, fontSize: 12, padding: '2px 8px', borderRadius: 4, background: b.color + '22', color: b.color, fontFamily: 'var(--f-mono)' }}>{b.label}</span></td>
                      <td className="r">
                        <input type="number" min="0" placeholder="0"
                          value={safeCloseCounts[b.id + '_close']}
                          onChange={e => setSafeCloseCounts(c => ({ ...c, [b.id + '_close']: e.target.value }))}
                          style={{ width: 80, textAlign: 'right', fontFamily: 'var(--f-mono)', border: '1px solid var(--line-soft)', borderRadius: 4, padding: '3px 8px' }}
                        />
                      </td>
                      <td className="r mono" style={{ color: count > 0 ? 'var(--ink)' : 'var(--ink-4)' }}>฿{fmt(count * b.value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ padding: '10px 14px', background: 'var(--bg-deep)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>รวมปิดเซฟ</span>
              <span className="mono" style={{ fontWeight: 700, fontSize: 20 }}>฿{fmt(safeCloseTotal)}</span>
            </div>
            {safeRecord && (
              <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--ink-4)', textAlign: 'right' }}>บันทึกแล้ว: ฿{fmt(safeRecord.closing_balance)}</div>
            )}
            <button
              type="button"
              className="btn btn-primary w-full"
              disabled={safeSubmitting}
              onClick={handleSafeSave}
              style={{ fontSize: 14, padding: '12px 0', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center' }}>
              {safeSubmitting ? 'กำลังบันทึก…' : 'บันทึกยอดเซฟวันนี้'}
            </button>
          </div>

        </div>
      </section>

      {/* ── สรุปยอดปิดบัญชี ── */}
      {(cashRecord || totalRevenue !== 0) && (
        <section style={{ marginBottom: 32 }}>
          <SectionLabel step="สรุป" label="สรุปยอดปิดบัญชีประจำวัน" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>

            <div className="card">
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700, color: '#27ae60', letterSpacing: '0.05em', textTransform: 'uppercase' }}>รายรับจริง</span>
              </div>
              <div style={{ fontSize: 30, fontFamily: 'var(--f-mono)', fontWeight: 300, color: 'var(--ink)', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
                ฿{fmt(totalRevenue)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Row label="เงินสดสุทธิ" value={`฿${fmt(netCash)}`} />
                <Row label="เงินโอน" value={`฿${fmt(bankTotal)}`} />
                <Row label="รับชำระเงินเชื่อ" value={`฿${fmt(totalCreditReceived)}`} />
              </div>
            </div>

            <div className="card">
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700, color: '#2563af', letterSpacing: '0.05em', textTransform: 'uppercase' }}>ยอดที่ควรได้รับ</span>
              </div>
              <div style={{ fontSize: 30, fontFamily: 'var(--f-mono)', fontWeight: 300, color: 'var(--ink)', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
                ฿{fmt(adjustedExpected)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Row label="ยอดขายหัวจ่าย" value={`฿${fmt(expectedSales)}`} />
                <Row label="หักขายเชื่อ" value={`-฿${fmt(totalCreditSales)}`} negative />
                <Row label="หักเติมใช้เอง" value={`-฿${fmt(totalFuelValue)}`} negative />
              </div>
            </div>

            <div className="card">
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700, color: diffColor, letterSpacing: '0.05em', textTransform: 'uppercase' }}>ผลต่าง</span>
              </div>
              <div style={{ fontSize: 30, fontFamily: 'var(--f-mono)', fontWeight: 300, color: diffColor, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--line-soft)' }}>
                {difference > 0 ? '+' : difference < 0 ? '-' : ''}฿{fmt(Math.abs(difference))}
              </div>
              <div>
                {difference === 0
                  ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: 'rgba(39,174,96,0.1)', color: '#27ae60', fontFamily: 'var(--f-mono)' }}>ยอดตรง</span>
                  : difference > 0
                  ? <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: 'rgba(39,174,96,0.1)', color: '#27ae60', fontFamily: 'var(--f-mono)' }}>เงินเกิน</span>
                  : <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: 'rgba(192,57,43,0.08)', color: '#c0392b', fontFamily: 'var(--f-mono)' }}>เงินขาด</span>
                }
              </div>
            </div>

          </div>
        </section>
      )}

      {revertModal && (
        <Modal
          title="ยืนยันการยกเลิกการรับชำระ"
          message={
            <div style={{ lineHeight: 1.8 }}>
              <div>ต้องการยกเลิกการรับชำระใบวางบิลนี้ใช่หรือไม่?</div>
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'rgba(37,99,175,0.08)', border: '1px solid rgba(37,99,175,0.2)', fontSize: 13, color: '#2563af' }}>
                <strong>หมายเหตุ:</strong> สถานะใบวางบิลจะกลับไปเป็น <strong>"วางบิลแล้ว (ยังไม่ชำระ)"</strong> — บิลยังคงอยู่ในใบวางบิลเดิม ไม่ได้กลับเป็นยังไม่วางบิล
              </div>
            </div>
          }
          onConfirm={doRevertPayment}
          onCancel={() => setRevertModal(null)}
        />
      )}

      <Footer />
    </main>
  );
}

function SectionLabel({ step, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-tint)', color: 'var(--accent-ink)' }}>
        {typeof step === 'number' ? `STEP ${step}` : step}
      </span>
      <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
    </div>
  );
}

function Row({ label, value, negative }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span className="mono" style={{ color: negative ? '#c0392b' : 'inherit' }}>{value}</span>
    </div>
  );
}
