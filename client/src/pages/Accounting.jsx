import Footer from '../components/Footer.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { fmt, todayStr, thaiDate } from '../lib/utils.js';

const TX_TYPES = {
  profit_transfer:  { label: 'โอนกำไร',       color: 'sage' },
  fuel_investment:  { label: 'ลงทุนน้ำมัน',   color: 'cobalt' },
  bank_deposit:     { label: 'ฝากธนาคาร',     color: 'cobalt' },
  electricity:      { label: 'ค่าไฟ',          color: 'amber' },
  water_purchase:   { label: 'ซื้อน้ำ',        color: 'amber' },
  debt_payment:     { label: 'ชำระหนี้',       color: 'rust' },
  credit_payment:   { label: 'รับชำระเชื่อ',  color: 'sage' },
  other:            { label: 'อื่น ๆ',          color: '' },
};

export default function Accounting() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [transactions, setTransactions] = useState([]);
  const [balances, setBalances] = useState({ cash_balance: 0, profit_balance: 0, bank_balance: 0 });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { type, data }
  const [form, setForm] = useState({ amount: '', note: '', customerId: '' });
  const [customers, setCustomers] = useState([]);
  const [deleteModal, setDeleteModal] = useState(null);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [txRes, balRes, custRes] = await Promise.all([
        api.get('/api/accounting/transactions', { date: selectedDate }),
        api.get('/api/accounting/balances'),
        api.get('/api/customer'),
      ]);
      setTransactions(txRes.data || []);
      setBalances(balRes || { cash_balance: 0, profit_balance: 0, bank_balance: 0 });
      setCustomers(custRes.data || []);
    } catch { toast.error('โหลดข้อมูลไม่ได้'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [selectedDate]);

  const openModal = (type) => {
    setForm({ amount: '', note: '', customerId: '' });
    setModal(type);
  };

  const save = async () => {
    try {
      await api.post('/api/accounting/transactions', {
        type: modal,
        date: selectedDate,
        amount: parseFloat(form.amount),
        note: form.note,
        customer_id: form.customerId || null,
      });
      toast.success('บันทึกสำเร็จ');
      setModal(null);
      load();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
  };

  const deleteTransaction = async (id) => {
    try {
      await api.del(`/api/accounting/transactions/${id}`);
      toast.success('ลบสำเร็จ');
      setDeleteModal(null);
      load();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  const ACTIONS = [
    { type: 'profit_transfer', label: 'โอนกำไร' },
    { type: 'fuel_investment', label: 'ลงทุนน้ำมัน' },
    { type: 'bank_deposit',    label: 'ฝากธนาคาร' },
    { type: 'electricity',     label: 'ค่าไฟ' },
    { type: 'water_purchase',  label: 'ซื้อน้ำ' },
    { type: 'debt_payment',    label: 'ชำระหนี้' },
    { type: 'other',           label: 'อื่น ๆ' },
  ];

  return (
    <main className="main-container">
      {loading && <Loading />}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{TX_TYPES[modal]?.label || modal}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div className="form-group">
                <label className="form-label">จำนวนเงิน (฿) *</label>
                <input type="number" step="0.01" className="form-input" autoFocus
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              {modal === 'debt_payment' && (
                <div className="form-group">
                  <label className="form-label">ลูกค้า</label>
                  <select className="form-input" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
                    <option value="">เลือกลูกค้า</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">หมายเหตุ</label>
                <input className="form-input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={save} disabled={!form.amount}>บันทึก</button>
            </div>
          </div>
        </div>
      )}

      {deleteModal && (
        <Modal
          title="ยืนยันการลบ"
          message="ต้องการลบรายการนี้ใช่หรือไม่?"
          onConfirm={() => deleteTransaction(deleteModal)}
          onCancel={() => setDeleteModal(null)}
        />
      )}

      <div className="page-header">
        <div>
          <div className="page-eyebrow">Accounting · บัญชี</div>
          <h1 className="page-title">การเงิน</h1>
        </div>
        <DatePicker value={selectedDate} onChange={v => setSelectedDate(v)} />
      </div>

      {/* BALANCES */}
      <div className="stats-grid" style={{ marginBottom: 40 }}>
        {[
          { label: 'เงินสดในมือ', value: balances.cash_balance },
          { label: 'กำไรสะสม',   value: balances.profit_balance },
          { label: 'เงินฝากธนาคาร', value: balances.bank_balance },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="metric-label">{label}</div>
            <div className="metric-value mono">฿{fmt(value)}</div>
          </div>
        ))}
      </div>

      {/* ACTION BUTTONS */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 32 }}>
        {ACTIONS.map(({ type, label }) => (
          <button key={type} className="btn" onClick={() => openModal(type)}>{label}</button>
        ))}
      </div>

      {/* TRANSACTIONS */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">รายการวันที่ {selectedDate}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>เวลา</th><th>ประเภท</th><th>หมายเหตุ</th>
                <th className="r">จำนวน</th><th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan="5" className="empty-state">ไม่มีรายการวันนี้</td></tr>
              ) : transactions.map(tx => {
                const info = TX_TYPES[tx.type] || { label: tx.type, color: '' };
                return (
                  <tr key={tx.id}>
                    <td className="mono" style={{ fontSize: 13 }}>{tx.created_at ? new Date(tx.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td><span className={`tag ${info.color}`}>{info.label}</span></td>
                    <td style={{ fontSize: 14 }}>{tx.note || '—'}</td>
                    <td className="r mono">฿{fmt(tx.amount)}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setDeleteModal(tx.id)}>ลบ</button>
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
