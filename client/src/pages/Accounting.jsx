import Footer from '../components/Footer.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { fmt, todayStr, thaiDate } from '../lib/utils.js';

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
  other:            'รายการอื่นๆ',
};

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
  return (desc || '')
    .replace(/\s*\(อัตโนมัติ\)/g, '')
    .replace(/\be91\b/gi, 'E91')
    .replace(/\be95\b/gi, 'E95')
    .replace(/\bb7\b/gi, 'B7')
    .trim();
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

  const openModal = (type) => {
    setForm({ amount: '', note: '', customerId: '', direction: 'out' });
    setModal(type);
  };

  const save = async () => {
    if (!form.amount || isNaN(parseFloat(form.amount))) return toast.error('กรอกจำนวนเงินให้ถูกต้อง');
    setSaving(true);
    try {
      const amount = parseFloat(form.amount);
      let account_type = 'cash';
      if (modal === 'bank_deposit') account_type = 'bank';

      await api.post('/api/accounting/transaction', {
        date: selectedDate,
        transaction_type: modal,
        category: TX_LABEL[modal] || modal,
        description: form.note || TX_LABEL[modal],
        amount: modal === 'other' && form.direction === 'out' ? -amount : amount,
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
            <div className="modal-title">{TX_LABEL[modal]}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              {modal === 'other' && (
                <div className="form-group">
                  <label className="form-label">ประเภท</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[{ v: 'out', l: 'รายจ่าย' }, { v: 'in', l: 'รายรับ' }].map(({ v, l }) => (
                      <button key={v} type="button"
                        onClick={() => setForm(f => ({ ...f, direction: v }))}
                        className={form.direction === v ? 'btn btn-primary' : 'btn'}
                        style={{ flex: 1 }}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">จำนวนเงิน (฿) *</label>
                <input type="number" step="0.01" min="0" className="form-input" autoFocus
                  placeholder="0.00" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              {modal === 'debt_payment' && (
                <div className="form-group">
                  <label className="form-label">ลูกค้า / เจ้าหนี้</label>
                  <select className="form-input" value={form.customerId}
                    onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                    <option value="">เลือก (ไม่บังคับ)</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">หมายเหตุ</label>
                <input className="form-input" placeholder="รายละเอียดเพิ่มเติม..."
                  value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && save()} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.amount || saving}>
                {saving ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
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
          { label: 'เงินสดหมุนเวียน',           value: balances.cash_balance },
          { label: 'เงินกำไรสะสม',              value: balances.profit_balance },
          { label: 'บัญชีธนาคาร',               value: balances.bank_balance },
          { label: 'เป็นลูกหนี้',               value: balances.total_receivables, sub: 'ค้างค่าลงทุน' },
          { label: 'เป็นเจ้าหนี้',              value: balances.total_payables,    sub: 'เครดิตลูกค้า' },
        ].map(({ label, value, sub }, i) => (
          <div key={label} className={`metric-item${i > 0 ? ' bordered' : ''}`}>
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
                const isIn   = amount >= 0;
                const label  = TX_LABEL[tx.transaction_type] || tx.transaction_type;
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
                    <td className="r mono" style={{ color: '#27ae60', fontWeight: 600 }}>
                      {isIn && amount !== 0 ? `฿${fmt(amount)}` : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td className="r mono" style={{ color: 'var(--rust)', fontWeight: 600 }}>
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
