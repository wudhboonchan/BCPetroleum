import Footer from '../components/Footer.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { fmt, todayStr, thaiDate, thaiShort } from '../lib/utils.js';

// รายการที่ระบบสร้างอัตโนมัติ — ห้ามลบ
const AUTO_SOURCES = ['cash_management', 'daily_profit_transfer', 'credit_payment_confirm'];

// ลำดับการแสดงผลสำหรับรายการ auto (ขึ้นก่อนเสมอ)
const AUTO_ORDER = ['cash_sales', 'transfer_sales', 'profit_transfer', 'customer_payment'];

// คำแนะนำ hover สำหรับ AUTO แต่ละประเภท
const AUTO_HINT = {
  cash_sales:       { text: 'สร้างอัตโนมัติจากการบันทึกเงินสด', page: 'หน้าเงินสด', path: '/cash' },
  transfer_sales:   { text: 'สร้างอัตโนมัติจากการบันทึกเงินสด', page: 'หน้าเงินสด', path: '/cash' },
  profit_transfer:  { text: 'สร้างอัตโนมัติเมื่อบันทึกยอดเงินสด', page: 'หน้าเงินสด', path: '/cash' },
  customer_payment: { text: 'สร้างอัตโนมัติเมื่อรับชำระจากลูกค้า', page: 'หน้าเงินเชื่อ', path: '/credit' },
};

const ACCOUNT_LABEL = {
  cash:        'เงินสดหมุนเวียน',
  profit:      'เงินกำไร',
  bank:        'บัญชีธนาคาร',
  receivables: 'บัญชีลูกหนี้',
};

const TX_LABEL = {
  cash_sales:       'ขายเงินสด',
  transfer_sales:   'ขายเงินโอน',
  profit_transfer:  'หักเก็บกำไร',
  customer_payment: 'รับชำระเงินเชื่อ',
  fuel_investment:  'การลงทุนน้ำมัน',
  fuel_payment:     'การลงทุนน้ำมัน',
  fuel:             'การลงทุนน้ำมัน',
  bank_deposit:     'ฝากเงินธนาคาร',
  deposit_to_bank:  'ฝากธนาคาร',
  electricity:      'ค่าไฟฟ้า',
  water_purchase:   'น้ำดื่มสมนาคุณ',
  water:            'น้ำดื่มสมนาคุณ',
  water_investment: 'น้ำดื่มสมนาคุณ',
  debt_payment:     'ชำระหนี้',
  loan:             'ชำระหนี้',
  loan_received:    'รับเงินกู้',
  expense:          'รายจ่าย',
  other_income:     'รายรับอื่นๆ',
  other_expense:    'รายจ่ายอื่นๆ',
  other:            'รายการอื่นๆ',
};

function getTransactionLabel(type) {
  if (!type) return '';
  const key = String(type).trim();
  return TX_LABEL[key] || key;
}

// SVG Icons สำหรับปุ่มเพิ่มรายการ
const ICONS = {
  fuel_investment: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>
      <path d="M3 22h12M13 6h2l3 3v5h-3"/>
      <path d="M15 14h3v5a1 1 0 0 1-1 1h-2"/>
      <line x1="7" y1="10" x2="9" y2="10"/>
    </svg>
  ),
  bank_deposit: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="11" rx="1"/>
      <path d="M3 10l9-7 9 7"/>
      <line x1="9" y1="21" x2="9" y2="13"/>
      <line x1="15" y1="21" x2="15" y2="13"/>
    </svg>
  ),
  electricity: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  water_purchase: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6 9 4 13.5 4 16a8 8 0 0 0 16 0c0-2.5-2-7-8-14z"/>
    </svg>
  ),
  debt_payment: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  ),
  other: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/>
      <line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  ),
};

const ACTIONS = [
  { type: 'fuel_investment', label: 'การลงทุนน้ำมัน',  desc: 'บันทึกการซื้อน้ำมัน' },
  { type: 'bank_deposit',    label: 'ฝากเงินธนาคาร',   desc: 'โอนจากเงินสดไปธนาคาร' },
  { type: 'electricity',     label: 'ค่าไฟฟ้า',         desc: 'หักจากเงินสดหมุนเวียน' },
  { type: 'water_purchase',  label: 'น้ำดื่มสมนาคุณ',  desc: 'บันทึกเป็นลูกหนี้' },
  { type: 'debt_payment',    label: 'ชำระหนี้',         desc: 'จ่ายค่าน้ำมัน/น้ำดื่ม/กู้ยืม' },
  { type: 'other',           label: 'รายการอื่นๆ',     desc: 'รายรับ/รายจ่ายอื่นๆ' },
];

function sortTransactions(txList) {
  const autoTx   = txList.filter(tx => AUTO_SOURCES.includes(tx.source));
  const manualTx = txList.filter(tx => !AUTO_SOURCES.includes(tx.source));

  autoTx.sort((a, b) => {
    const ai = AUTO_ORDER.indexOf(a.transaction_type);
    const bi = AUTO_ORDER.indexOf(b.transaction_type);
    if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    // profit_transfer: เงินเข้า (amount > 0) ขึ้นก่อน เงินออก (amount < 0)
    return parseFloat(b.amount) - parseFloat(a.amount);
  });

  return [...autoTx, ...manualTx];
}

function AutoHint({ type }) {
  const hint = AUTO_HINT[type];
  if (!hint) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={e => e.currentTarget.querySelector('.auto-tooltip').style.display = 'block'}
      onMouseLeave={e => e.currentTarget.querySelector('.auto-tooltip').style.display = 'none'}
    >
      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--bg-deep)', color: 'var(--ink-4)', fontFamily: 'var(--f-mono)', letterSpacing: '0.04em', cursor: 'default' }}>AUTO</span>
      <div className="auto-tooltip" style={{
        display: 'none', position: 'absolute', top: 'calc(100% + 8px)', left: 0,
        background: 'var(--ink)', color: 'var(--bg)', borderRadius: 8,
        padding: '10px 14px', width: 220, zIndex: 100, pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontSize: 12, marginBottom: 6, opacity: 0.7 }}>{hint.text}</div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          แก้ไข/ลบได้ที่ →{' '}
          <a href={hint.path} style={{ color: '#f0c87a', textDecoration: 'none' }}>{hint.page}</a>
        </div>
      </div>
    </span>
  );
}

function cleanDesc(desc) {
  if (!desc) return '';
  let cleaned = desc
    .replace(/\s*\(อัตโนมัติ\)/g, '')
    .replace(/\be91\b/gi, 'E91')
    .replace(/\be95\b/gi, 'E95')
    .replace(/\bb7\b/gi, 'B7');
  
  // Format long decimal cost prices (e.g. 3.2666666666666666 to 3.27)
  cleaned = cleaned.replace(/@\s*฿\s*(\d+\.?\d*)\s*\/ลิตร/g, (match, priceStr) => {
    const price = parseFloat(priceStr);
    return `@ ฿${price.toFixed(2)}/ลิตร`;
  });

  return cleaned.trim();
}

export default function Accounting() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [transactions, setTransactions] = useState([]);
  const [balances, setBalances] = useState({
    cash_balance: 0, profit_balance: 0, bank_balance: 0,
    total_receivables: 0, total_payables: 0,
  });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ amount: '', note: '', customerId: '', direction: 'out' });
  const [customers, setCustomers] = useState([]);
  const [deleteModal, setDeleteModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [debtItems, setDebtItems] = useState([]);
  const [detailModal, setDetailModal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState([]);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [summaryRes, custRes] = await Promise.all([
        api.get(`/api/accounting/summary/${selectedDate}`),
        api.get('/api/customer'),
      ]);
      setTransactions(sortTransactions(summaryRes.transactions || []));
      setBalances(summaryRes.balances || {
        cash_balance: 0, profit_balance: 0, bank_balance: 0,
        total_receivables: 0, total_payables: 0,
      });
      setCustomers(custRes.data || []);
    } catch { toast.error('โหลดข้อมูลไม่ได้'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [selectedDate]);

  const loadDebtItems = async (debtType) => {
    if (!debtType) { setDebtItems([]); return; }
    try {
      if (debtType === 'fuel') {
        const r = await api.get(`/api/accounting/fuel-investments/${selectedDate}?status=unpaid`);
        setDebtItems((r.investments || []).filter(i => i.payment_status !== 'paid').map(i => ({
          id: i.id,
          label: `น้ำมัน ${i.fuel_type.toUpperCase()} ${i.liters} ลิตร — คงเหลือ ฿${Number(i.remaining_amount).toLocaleString()}`,
          remaining_amount: i.remaining_amount,
        })));
      } else if (debtType === 'water') {
        const r = await api.get(`/api/accounting/water-investments/${selectedDate}?status=unpaid`);
        setDebtItems((r.investments || []).filter(i => i.payment_status !== 'paid').map(i => ({
          id: i.id,
          label: `น้ำดื่มสมนาคุณ ${i.packs} แพ็ค — คงเหลือ ฿${Number(i.remaining_amount).toLocaleString()}`,
          remaining_amount: i.remaining_amount,
        })));
      } else if (debtType === 'loan') {
        const r = await api.get(`/api/accounting/loans/${selectedDate}?status=unpaid`);
        setDebtItems((r.loans || []).filter(l => l.payment_status !== 'paid').map(l => ({
          id: l.id,
          label: `${l.description} — คงเหลือ ฿${Number(l.remaining_amount).toLocaleString()}`,
          remaining_amount: l.remaining_amount,
        })));
      }
    } catch { setDebtItems([]); }
  };

  const openModal = (type) => {
    setForm({
      amount: '',
      note: '',
      customerId: '',
      direction: 'out',
      fuelType: 'e91',
      liters: '',
      totalCost: '',
      paymentStatus: 'unpaid',
      paymentMethod: 'cash',
      otherType: 'income',
      account: 'cash',
      loanAccount: 'cash',
      elecMonth: new Date().toLocaleString('th-TH', { month: 'long' }),
      waterPacks: '',
      waterCostPerPack: '60',
      debtType: '',
      debtId: '',
      paymentAccount: 'cash',
    });
    setDebtItems([]);
    setModal(type);
  };

  const openDetailModal = async (key) => {
    setDetailModal(key);
    setDetailLoading(true);
    setDetailData([]);
    try {
      if (key === 'cash' || key === 'profit' || key === 'bank') {
        const res = await api.get(`/api/accounting/account-details/${key}/${selectedDate}`);
        setDetailData(res.transactions || []);
      } else if (key === 'receivables') {
        const res = await api.get(`/api/accounting/receivables/${selectedDate}`);
        setDetailData(res.receivables || {});
      } else if (key === 'payables') {
        const res = await api.get(`/api/accounting/payables/${selectedDate}`);
        setDetailData(res.payables || {});
      }
    } catch {
      toast.error('ไม่สามารถโหลดรายละเอียดได้');
    } finally {
      setDetailLoading(false);
    }
  };

  const save = async () => {
    if (modal === 'fuel_investment') {
      if (!form.liters || isNaN(parseFloat(form.liters)) || parseFloat(form.liters) <= 0) {
        return toast.error('กรุณากรอกจำนวนลิตรให้ถูกต้อง');
      }
      if (!form.totalCost || isNaN(parseFloat(form.totalCost)) || parseFloat(form.totalCost) <= 0) {
        return toast.error('กรุณากรอกจำนวนเงินรวมให้ถูกต้อง');
      }
      setSaving(true);
      try {
        const liters = parseFloat(form.liters);
        const totalCost = parseFloat(form.totalCost);
        const costPerLiter = totalCost / liters;

        await api.post('/api/accounting/fuel-investment', {
          date: selectedDate,
          fuel_type: form.fuelType,
          liters,
          cost_per_liter: costPerLiter,
          payment_status: form.paymentStatus,
          payment_method: form.paymentStatus === 'paid' ? form.paymentMethod : null,
          note: form.note || '',
        });
        toast.success('บันทึกสำเร็จ');
        setModal(null);
        load();
      } catch (err) {
        toast.error(err.message || 'เกิดข้อผิดพลาด');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (modal === 'electricity') {
      if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('กรุณากรอกจำนวนเงิน');
      setSaving(true);
      try {
        await api.post('/api/accounting/transaction', {
          date: selectedDate,
          transaction_type: 'electricity',
          category: 'Utilities',
          description: `ค่าไฟฟ้า (${form.elecMonth})`,
          amount: -parseFloat(form.amount),
          payment_method: 'cash',
          account_type: 'cash',
        });
        toast.success('บันทึกค่าไฟฟ้าสำเร็จ');
        setModal(null); load();
      } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
      finally { setSaving(false); }
      return;
    }

    if (modal === 'water_purchase') {
      if (!form.waterPacks || parseInt(form.waterPacks) <= 0) return toast.error('กรุณากรอกจำนวนแพค');
      if (!form.waterCostPerPack || parseFloat(form.waterCostPerPack) <= 0) return toast.error('กรุณากรอกราคาต่อแพค');
      setSaving(true);
      try {
        await api.post('/api/accounting/water-investment', {
          date: selectedDate,
          packs: parseInt(form.waterPacks),
          cost_per_pack: parseFloat(form.waterCostPerPack) || 60,
          note: form.note || '',
        });
        toast.success('บันทึกน้ำดื่มสมนาคุณสำเร็จ');
        setModal(null); load();
      } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
      finally { setSaving(false); }
      return;
    }

    if (modal === 'debt_payment') {
      if (!form.debtType) return toast.error('กรุณาเลือกประเภทหนี้');
      if (!form.debtId) return toast.error('กรุณาเลือกรายการหนี้');
      if (!form.amount || parseFloat(form.amount) <= 0) return toast.error('กรุณากรอกจำนวนเงิน');
      const selected = debtItems.find(i => String(i.id) === String(form.debtId));
      if (selected && parseFloat(form.amount) > selected.remaining_amount) {
        return toast.error(`จำนวนเงินเกินยอดค้างชำระ (฿${selected.remaining_amount.toLocaleString()})`);
      }
      setSaving(true);
      try {
        await api.post('/api/accounting/pay-debt', {
          date: selectedDate,
          debt_type: form.debtType,
          debt_id: form.debtId,
          payment_amount: parseFloat(form.amount),
          payment_account: form.paymentAccount,
          note: form.note || '',
        });
        toast.success('บันทึกการชำระหนี้สำเร็จ');
        setModal(null); load();
      } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
      finally { setSaving(false); }
      return;
    }

    if (!form.amount || isNaN(parseFloat(form.amount))) return toast.error('กรอกจำนวนเงินให้ถูกต้อง');
    setSaving(true);
    try {
      const amount = parseFloat(form.amount);

      if (modal === 'other' && form.otherType === 'loan') {
        await api.post('/api/accounting/loan', {
          date: selectedDate,
          description: form.note || 'เงินกู้ยืมชั่วคราว',
          amount,
          account_type: form.loanAccount,
          note: form.note || '',
        });
        toast.success('บันทึกสำเร็จ');
        setModal(null);
        load();
        return;
      }

      let account_type = 'cash';
      if (modal === 'bank_deposit') account_type = 'bank';
      if (modal === 'other') account_type = form.account;

      let transaction_type = modal;
      if (modal === 'other') transaction_type = form.otherType === 'income' ? 'other_income' : 'other_expense';

      await api.post('/api/accounting/transaction', {
        date: selectedDate,
        transaction_type,
        category: TX_LABEL[transaction_type] || transaction_type,
        description: form.note || TX_LABEL[transaction_type],
        amount: modal === 'other' && form.otherType === 'expense' ? -amount : amount,
        account_type,
        customer_id: form.customerId || null,
      });
      toast.success('บันทึกสำเร็จ');
      setModal(null);
      load();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setSaving(false); }
  };

  const deleteTransaction = async (id) => {
    try {
      await api.del(`/api/accounting/transactions/${id}`);
      toast.success('ลบสำเร็จ');
      setDeleteModal(null);
      load();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  return (
    <main className="main-container">
      {loading && <Loading />}

      {/* Modal เพิ่มรายการ */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {ICONS[modal] && <span style={{ display: 'flex', color: 'var(--ink)' }}>{ICONS[modal]}</span>}
                {TX_LABEL[modal]}
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: 'var(--ink-3)',
                  padding: 4,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                &times;
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {modal === 'other' && (
                <>
                  <div className="form-group">
                    <label className="form-label">ประเภท</label>
                    <select className="form-input" value={form.otherType}
                      onChange={e => setForm(f => ({ ...f, otherType: e.target.value }))}>
                      <option value="income">รายรับอื่นๆ</option>
                      <option value="expense">รายจ่ายอื่นๆ</option>
                      <option value="loan">เงินกู้ยืมชั่วคราว</option>
                    </select>
                  </div>
                  {form.otherType !== 'loan' ? (
                    <div className="form-group">
                      <label className="form-label">บัญชีที่เกี่ยวข้อง</label>
                      <select className="form-input" value={form.account}
                        onChange={e => setForm(f => ({ ...f, account: e.target.value }))}>
                        <option value="cash">เงินสดหมุนเวียน</option>
                        <option value="profit">เงินกำไร</option>
                        <option value="bank">บัญชีธนาคาร</option>
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">เงินเข้าบัญชี</label>
                      <select className="form-input" value={form.loanAccount}
                        onChange={e => setForm(f => ({ ...f, loanAccount: e.target.value }))}>
                        <option value="cash">เงินสดหมุนเวียน</option>
                        <option value="bank">บัญชีธนาคาร</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {modal === 'fuel_investment' ? (
                <>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>ประเภทน้ำมัน</label>
                    <select className="form-input" value={form.fuelType}
                      onChange={e => setForm(f => ({ ...f, fuelType: e.target.value }))}>
                      <option value="e91">แก๊สโซฮอล์ 91</option>
                      <option value="e95">แก๊สโซฮอล์ 95</option>
                      <option value="b7">ดีเซล B7</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>จำนวนลิตร</label>
                    <input type="number" step="0.001" min="0" className="form-input" autoFocus
                      placeholder="0.000" value={form.liters}
                      onChange={e => setForm(f => ({ ...f, liters: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>จำนวนเงินรวม (บาท)</label>
                    <input type="number" step="0.01" min="0" className="form-input"
                      placeholder="0.00" value={form.totalCost}
                      onChange={e => setForm(f => ({ ...f, totalCost: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>สถานะการจ่ายเงิน</label>
                    <select className="form-input" value={form.paymentStatus}
                      onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value }))}>
                      <option value="unpaid">ยังไม่ได้จ่าย</option>
                      <option value="paid">จ่ายแล้ว</option>
                    </select>
                  </div>

                  {form.paymentStatus === 'paid' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>ช่องทางการจ่ายเงิน</label>
                      <select className="form-input" value={form.paymentMethod}
                        onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                        <option value="cash">เงินสด</option>
                        <option value="transfer">เงินโอน</option>
                      </select>
                    </div>
                  )}
                </>
              ) : modal === 'electricity' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">ประจำเดือน</label>
                    <select className="form-input" value={form.elecMonth}
                      onChange={e => setForm(f => ({ ...f, elecMonth: e.target.value }))}>
                      {['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">จำนวนเงิน (บาท)</label>
                    <input type="number" step="0.01" min="0" className="form-input" autoFocus
                      placeholder="0.00" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>
                </>
              ) : modal === 'water_purchase' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">จำนวนแพค</label>
                    <input type="number" min="0" className="form-input" autoFocus
                      placeholder="0" value={form.waterPacks}
                      onChange={e => setForm(f => ({ ...f, waterPacks: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ราคาต่อแพค (บาท)</label>
                    <input type="number" step="0.01" min="0" className="form-input"
                      placeholder="60.00" value={form.waterCostPerPack}
                      onChange={e => setForm(f => ({ ...f, waterCostPerPack: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>
                </>
              ) : modal === 'debt_payment' ? (
                <>
                  <div className="form-group">
                    <label className="form-label">ประเภทหนี้</label>
                    <select className="form-input" value={form.debtType}
                      onChange={e => {
                        setForm(f => ({ ...f, debtType: e.target.value, debtId: '' }));
                        loadDebtItems(e.target.value);
                      }}>
                      <option value="">-- เลือกประเภทหนี้ --</option>
                      <option value="fuel">ค่าน้ำมัน</option>
                      <option value="water">ค่าน้ำดื่ม</option>
                      <option value="loan">เงินกู้ยืม</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">เลือกรายการหนี้</label>
                    <select className="form-input" value={form.debtId}
                      onChange={e => {
                        const item = debtItems.find(i => String(i.id) === e.target.value);
                        setForm(f => ({ ...f, debtId: e.target.value, amount: item ? String(item.remaining_amount) : f.amount }));
                      }}>
                      <option value="">-- เลือกรายการ --</option>
                      {debtItems.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">จำนวนเงิน (บาท)</label>
                    <input type="number" step="0.01" min="0" className="form-input"
                      placeholder="0.00" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">ชำระจากบัญชี</label>
                    <select className="form-input" value={form.paymentAccount}
                      onChange={e => setForm(f => ({ ...f, paymentAccount: e.target.value }))}>
                      <option value="cash">เงินสด</option>
                      <option value="bank">ธนาคาร</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">หมายเหตุ (ถ้ามี)</label>
                    <input className="form-input" placeholder="ระบุรายละเอียดเพิ่มเติม"
                      value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>
                </>
              ) : (
                <>
                  <div className="form-group">
                    <label className="form-label">จำนวนเงิน (฿) *</label>
                    <input type="number" step="0.01" min="0" className="form-input" autoFocus
                      placeholder="0.00" value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">หมายเหตุ</label>
                    <input className="form-input" placeholder="รายละเอียดเพิ่มเติม..."
                      value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && save()} />
                  </div>
                </>
              )}
            </div>
            {modal === 'fuel_investment' ? (
              <button
                className="btn btn-primary w-full"
                onClick={save}
                disabled={saving || !form.liters || !form.totalCost}
                style={{
                  justifyContent: 'center',
                  padding: '12px 16px',
                  fontSize: 16,
                  fontWeight: 500,
                  borderRadius: 10,
                  marginTop: 8
                }}
              >
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            ) : (
              <div className="modal-footer">
                <button className="btn" onClick={() => setModal(null)}>ยกเลิก</button>
                <button className="btn btn-primary" onClick={save} disabled={saving || (modal === 'water_purchase' ? (!form.waterPacks || !form.waterCostPerPack) : !form.amount)}>
                  {saving ? 'กำลังบันทึก…' : 'บันทึก'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {deleteModal && (
        <Modal
          title="ยืนยันการลบรายการ?"
          message={
            <div>
              <div style={{ marginBottom: 16 }}>คุณต้องการลบรายการธุรกรรมนี้ใช่หรือไม่?</div>
              <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 13, color: '#c0392b' }}>• รายการที่เกี่ยวข้อง (คู่ เดบิต/เครดิต) จะถูกลบด้วย</div>
                <div style={{ fontSize: 13, color: '#c0392b' }}>• จะมีการคืนค่ายอดลงทุนหากเป็นการชำระหนี้</div>
              </div>
            </div>
          }
          onConfirm={() => deleteTransaction(deleteModal)}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      {detailModal && (
        <div className="modal-backdrop" onClick={() => setDetailModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--line-soft)' }}>
              <div className="modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
                {detailModal === 'cash' && 'รายละเอียดเงินสดหมุนเวียน'}
                {detailModal === 'profit' && 'รายละเอียดเงินกำไรสะสม'}
                {detailModal === 'bank' && 'รายละเอียดบัญชีธนาคาร'}
                {detailModal === 'receivables' && 'รายละเอียดเป็นลูกหนี้ (ค้างค่าลงทุน)'}
                {detailModal === 'payables' && 'รายละเอียดเป็นเจ้าหนี้ (เครดิตลูกค้า)'}
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: 'var(--ink-3)',
                  padding: 4,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 20 }}>
              {detailLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div className="loading-spinner"></div>
                </div>
              ) : (
                <>
                  {(detailModal === 'cash' || detailModal === 'profit' || detailModal === 'bank') && (
                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 13, width: '100%', tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '110px' }} />
                          <col />
                          <col style={{ width: '100px' }} />
                          <col style={{ width: '100px' }} />
                          <col style={{ width: '120px' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>วันที่</th>
                            <th>รายการ</th>
                            <th className="r">รายรับ</th>
                            <th className="r">รายจ่าย</th>
                            <th className="r" style={{ paddingRight: 10 }}>ยอดคงเหลือ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="empty-state">ไม่มีรายการธุรกรรม</td>
                            </tr>
                          ) : (
                            detailData.map(t => {
                              const amount = parseFloat(t.amount);
                              const isCredit = amount > 0;
                              const dateStr = thaiShort(new Date(t.date + 'T00:00:00'));
                              const cleanDescStr = t.description ? cleanDesc(t.description) : (TX_LABEL[t.transaction_type] || t.transaction_type);
                              return (
                                <tr key={t.id}>
                                  <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dateStr}</td>
                                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cleanDescStr}>{cleanDescStr}</td>
                                  <td className="r tnum" style={{ color: '#27ae60', fontWeight: 500 }}>
                                    {isCredit ? `฿${fmt(amount)}` : '—'}
                                  </td>
                                  <td className="r tnum" style={{ color: 'var(--rust)', fontWeight: 500 }}>
                                    {!isCredit ? `฿${fmt(Math.abs(amount))}` : '—'}
                                  </td>
                                  <td className="r tnum" style={{ fontWeight: 600, paddingRight: 10 }}>
                                    ฿{fmt(t.running_balance)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {detailModal === 'receivables' && (() => {
                    const combinedList = [];
                    if (detailData.fuel) {
                      detailData.fuel.forEach(item => combinedList.push({
                        id: `fuel-${item.id}`,
                        date: item.date,
                        description: `ลงทุนน้ำมัน ${item.fuel_type.toUpperCase()} ${item.liters} ลิตร @ ฿${fmt(item.cost_per_liter)}/ลิตร`,
                        remaining: parseFloat(item.remaining_amount),
                        status: item.payment_status
                      }));
                    }
                    if (detailData.water) {
                      detailData.water.forEach(item => combinedList.push({
                        id: `water-${item.id}`,
                        date: item.date,
                        description: `ลงทุนน้ำดื่มสมนาคุณ ${item.packs} แพ็ค @ ฿${fmt(item.cost_per_pack)}/แพ็ค`,
                        remaining: parseFloat(item.remaining_amount),
                        status: item.payment_status
                      }));
                    }
                    if (detailData.loan) {
                      detailData.loan.forEach(item => combinedList.push({
                        id: `loan-${item.id}`,
                        date: item.date,
                        description: `เงินกู้ยืม: ${item.description}`,
                        remaining: parseFloat(item.remaining_amount),
                        status: item.payment_status
                      }));
                    }
                    combinedList.sort((a, b) => new Date(b.date) - new Date(a.date));

                    return (
                      <div className="table-wrap">
                        <table className="data-table" style={{ fontSize: 13, width: '100%', tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '110px' }} />
                            <col />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '100px' }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th>วันที่</th>
                              <th>รายการ</th>
                              <th className="r">ยอดค้างชำระ</th>
                              <th className="r" style={{ paddingRight: 10 }}>สถานะ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {combinedList.length === 0 ? (
                              <tr>
                                <td colSpan="4" className="empty-state">ไม่มีรายการลูกหนี้ค้างชำระ</td>
                              </tr>
                            ) : (
                              combinedList.map(item => {
                                const dateStr = thaiShort(new Date(item.date + 'T00:00:00'));
                                return (
                                  <tr key={item.id}>
                                    <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dateStr}</td>
                                    <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>{item.description}</td>
                                    <td className="r tnum" style={{ color: '#27ae60', fontWeight: 500 }}>
                                      ฿{fmt(item.remaining)}
                                    </td>
                                    <td className="r" style={{ paddingRight: 10 }}>
                                      {item.status === 'unpaid' ? (
                                        <span className="tag amber">ยังไม่ชำระ</span>
                                      ) : (
                                        <span className="tag cobalt">ชำระบางส่วน</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                  {detailModal === 'payables' && (
                    <div className="table-wrap">
                      <table className="data-table" style={{ fontSize: 13, width: '100%', tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '110px' }} />
                          <col />
                          <col style={{ width: '110px' }} />
                          <col style={{ width: '100px' }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>วันที่</th>
                            <th>ลูกค้า</th>
                            <th className="r">ยอดค้างชำระ</th>
                            <th className="r" style={{ paddingRight: 10 }}>สถานะ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(!detailData.credit || detailData.credit.length === 0) ? (
                            <tr>
                              <td colSpan="4" className="empty-state">ไม่มีรายการเจ้าหนี้ค้างชำระ</td>
                            </tr>
                          ) : (
                            detailData.credit.map((group, index) => {
                              const dateStr = thaiShort(new Date(group.date + 'T00:00:00'));
                              return (
                                <tr key={index}>
                                  <td style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dateStr}</td>
                                  <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${group.customer?.name || 'ไม่ระบุชื่อ'} (${group.bill_count} บิล)`}>
                                    {group.customer?.name || 'ไม่ระบุชื่อ'} ({group.bill_count} บิล)
                                  </td>
                                  <td className="r tnum" style={{ color: 'var(--rust)', fontWeight: 500 }}>
                                    ฿{fmt(group.total_amount)}
                                  </td>
                                  <td className="r" style={{ paddingRight: 10 }}>
                                    <span className="tag rust">ค้างชำระ</span>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 16 }}>
              <button className="btn" onClick={() => setDetailModal(null)}>ปิด</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">บัญชี · Accounting</div>
          <h1 className="page-title">จัดการบัญชีรายรับรายจ่าย</h1>
          <div style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 4 }}>
            {thaiDate(new Date(selectedDate + 'T00:00:00'))}
          </div>
        </div>
      </div>

      {/* 5 Metrics Strip */}
      <div className="metrics-strip" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 36 }}>
        {[
          { key: 'cash',        label: 'เงินสดหมุนเวียน',   value: balances.cash_balance },
          { key: 'profit',      label: 'เงินกำไรสะสม',      value: balances.profit_balance },
          { key: 'bank',        label: 'บัญชีธนาคาร',       value: balances.bank_balance },
          { key: 'receivables', label: 'เป็นลูกหนี้',       value: balances.total_receivables, sub: 'ค้างค่าลงทุน' },
          { key: 'payables',    label: 'เป็นเจ้าหนี้',      value: balances.total_payables,    sub: 'เครดิตลูกค้า' },
        ].map(({ key, label, value, sub }, i) => (
          <div key={label} className={`metric-item${i > 0 ? ' bordered' : ''}`}
               onClick={() => openDetailModal(key)}
               style={{ cursor: 'pointer', transition: 'background 0.15s', padding: '12px 24px', margin: '-12px 0', borderRadius: 8 }}
               onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-deep)'}
               onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <div className="metric-label" style={{ fontSize: 14 }}>{label}</div>
            <div className="metric-value" style={{ fontSize: 28, color: value < 0 ? 'var(--rust)' : 'var(--ink)' }}>
              ฿{fmt(value)}
            </div>
            {sub && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 4 }}>{sub}</div>}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div className="card-header">
          <span className="card-title">เพิ่มรายการธุรกรรม</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {ACTIONS.map(({ type, label, desc }) => (
            <button key={type} type="button" onClick={() => openModal(type)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
                border: '1px solid var(--line-soft)', background: 'var(--bg)',
                transition: 'background 0.15s, border-color 0.15s',
                color: 'var(--ink-3)', textAlign: 'center', minHeight: 80,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-deep)'; e.currentTarget.style.borderColor = 'var(--ink-3)'; e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--line-soft)'; e.currentTarget.style.color = 'var(--ink-3)'; }}
            >
              <span style={{ color: 'inherit', display: 'flex' }}>{ICONS[type]}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.4 }}>{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div className="card-header">
          <span className="card-title">รายการธุรกรรมประจำวัน</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>วันที่</span>
            <DatePicker value={selectedDate} onChange={v => setSelectedDate(v)} />
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>รายละเอียด</th>
                <th>บัญชี</th>
                <th className="r">เงินเข้า</th>
                <th className="r">เงินออก</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan="5" className="empty-state">ไม่มีรายการวันนี้</td></tr>
              ) : transactions.map(tx => {
                const auto   = AUTO_SOURCES.includes(tx.source);
                const amount = parseFloat(tx.amount);
                const isExpenseType = ['fuel_investment', 'water_investment'].includes(tx.transaction_type);
                const isIn   = isExpenseType ? false : (amount >= 0);
                const label  = getTransactionLabel(tx.transaction_type);
                const desc   = tx.description && cleanDesc(tx.description) !== label ? cleanDesc(tx.description) : null;
                return (
                  <tr key={tx.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {label}
                        {auto && <AutoHint type={tx.transaction_type} />}
                      </div>
                      {desc && <div style={{ fontSize: 12, color: 'var(--ink-4)', marginTop: 2 }}>{desc}</div>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                      {ACCOUNT_LABEL[tx.account_type] || tx.account_type || '—'}
                    </td>
                    <td className="r tnum" style={{ color: '#27ae60', fontWeight: 500 }}>
                      {isIn && amount !== 0 ? `฿${fmt(amount)}` : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td className="r tnum" style={{ color: 'var(--rust)', fontWeight: 500 }}>
                      {!isIn ? `฿${fmt(Math.abs(amount))}` : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!auto && (
                        <button className="btn btn-ghost" style={{ fontSize: 12 }}
                          onClick={() => setDeleteModal(tx.id)}>ลบ</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Footer />
    </main>
  );
}
