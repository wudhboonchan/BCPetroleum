import Footer from '../components/Footer.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { fmt, todayStr, thaiDate, thaiShort } from '../lib/utils.js';

/* ── helper: first day of this month ── */
function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

/* ── status badge ── */
/* ── combined invoice/status badge ── */
function InvoiceBadge({ invoiceStatus, paid, invoiceNumber }) {
  if (paid) {
    return (
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em',
        padding: '3px 8px', borderRadius: 4,
        background: 'rgba(58,122,72,0.12)', color: '#3a7a48', whiteSpace: 'nowrap' }}>
        ✓ จ่ายแล้ว
      </span>
    );
  }
  if (invoiceNumber) {
    return (
      <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em',
        padding: '3px 8px', borderRadius: 4,
        background: 'rgba(37,99,175,0.12)', color: '#2563af', whiteSpace: 'nowrap' }}>
        {invoiceNumber}
      </span>
    );
  }
  return (
    <span style={{ fontFamily: 'var(--f-mono)', fontSize: 11, letterSpacing: '0.04em',
      padding: '3px 8px', borderRadius: 4,
      background: 'rgba(192,57,43,0.09)', color: '#c0392b', whiteSpace: 'nowrap' }}>
      ยังไม่วางบิล
    </span>
  );
}

export default function Credit() {
  /* ── state ── */
  const [customers, setCustomers]     = useState([]);
  const [todayData, setTodayData]     = useState({ data: [], summary: { totalAmount: 0, totalBills: 0 } });
  const [allData, setAllData]         = useState({ data: [], summary: {} });
  const [paidMonth, setPaidMonth]     = useState(0);
  const [loading, setLoading]         = useState(true);

  /* add form */
  const [form, setForm] = useState({ customerId: '', date: todayStr(), billBook: '', billNumber: '', amount: '', vehicleNumber: '', note: '' });
  const [submitting, setSubmitting]   = useState(false);
  const billBookRef = useRef(null); // focus after submit

  /* all-records filters */
  const [fStart, setFStart]           = useState('');
  const [fEnd, setFEnd]               = useState('');
  const [fCustomer, setFCustomer]     = useState('all');
  const [fInvStatus, setFInvStatus]   = useState('all');
  const [searched, setSearched]       = useState(false);

  /* selection for invoice */
  const [selected, setSelected]       = useState(new Set());
  const [deleteModal, setDeleteModal] = useState(null);
  const [editModal, setEditModal]     = useState(null); // credit record to edit
  const [editForm, setEditForm]       = useState({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [cancelInvoiceModal, setCancelInvoiceModal] = useState(null); // { invoiceId, invoiceNumber, customerName, billCount, totalAmount }

  /* pagination for all-records */
  const [page, setPage]         = useState(1);
  const [perPage, setPerPage]   = useState(10);

  const toast = useToast();

  /* ── pagination computed ── */
  const totalRecords  = allData.data.length;
  const totalPages    = Math.ceil(totalRecords / perPage);
  const pagedData     = allData.data.slice((page - 1) * perPage, page * perPage);

  /* ── load ── */
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [custRes, todayRes, paidRes] = await Promise.all([
        api.get('/api/customer'),
        api.get('/api/credit/today'),
        api.get('/api/credit/filter', { paid: 'true', startDate: firstOfMonth(), endDate: todayStr() }),
      ]);
      setCustomers(custRes.data || []);
      setTodayData(todayRes);
      setPaidMonth(paidRes.summary?.paidAmount || 0);
    } catch (err) { toast.error('โหลดข้อมูลไม่ได้'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const search = async () => {
    setLoading(true);
    try {
      const params = {};
      if (fCustomer !== 'all')    params.customerId  = fCustomer;
      if (fInvStatus !== 'all')   params.paid        = fInvStatus === 'paid' ? 'true' : fInvStatus === 'unpaid' ? 'false' : undefined;
      if (fStart)                 params.startDate   = fStart;
      if (fEnd)                   params.endDate     = fEnd;
      const res = await api.get('/api/credit/filter', params);
      setAllData(res);
      setSelected(new Set());
      setSearched(true);
      setPage(1);
    } catch { toast.error('ค้นหาไม่ได้'); }
    finally { setLoading(false); }
  };

  /* ── add credit ── */
  const handleAdd = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/api/credit', {
        customer_id:    parseInt(form.customerId),
        bill_book:      form.billBook,
        bill_number:    form.billNumber,
        amount:         parseFloat(form.amount),
        vehicle_number: form.vehicleNumber || null,
        note:           form.note || null,
        date:           form.date,
      });
      toast.success('บันทึกยอดขายเงินเชื่อสำเร็จ');
      // เก็บ customerId และ date ไว้ → reset แค่ bill fields
      setForm(f => ({ ...f, billBook: '', billNumber: '', amount: '', vehicleNumber: '', note: '' }));
      // โฟกัสไปที่ช่องเล่มที่ทันที
      setTimeout(() => billBookRef.current?.focus(), 50);
      loadAll();
      if (searched) search();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setSubmitting(false); }
  };

  /* ── open edit ── */
  const openEdit = (c) => {
    setEditForm({
      customerId:    String(c.customer_id),
      date:          c.date?.split('T')[0] || todayStr(),
      billBook:      c.bill_book || '',
      billNumber:    c.bill_number || '',
      amount:        String(c.amount || ''),
      vehicleNumber: c.vehicle_number || '',
      note:          c.note || '',
    });
    setEditModal(c);
  };

  /* ── save edit ── */
  const saveEdit = async () => {
    setEditSubmitting(true);
    try {
      await api.put(`/api/credit/${editModal.id}`, {
        customerId:    parseInt(editForm.customerId),
        date:          editForm.date,
        billBook:      editForm.billBook,
        billNumber:    editForm.billNumber,
        amount:        parseFloat(editForm.amount),
        vehicleNumber: editForm.vehicleNumber || null,
        note:          editForm.note || null,
      });
      toast.success('แก้ไขรายการสำเร็จ');
      setEditModal(null);
      loadAll();
      if (searched) search();
    } catch (err) { toast.error(err.message || 'แก้ไขไม่สำเร็จ'); }
    finally { setEditSubmitting(false); }
  };

  /* ── delete ── */
  const doDelete = async (id) => {
    try {
      await api.del(`/api/credit/${id}`);
      toast.success('ลบรายการสำเร็จ');
      setDeleteModal(null);
      loadAll();
      if (searched) search();
    } catch { toast.error('เกิดข้อผิดพลาด'); }
  };

  /* ── select helpers ── */
  const toggle = (id) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAllUnpaired = () => setSelected(new Set(allData.data.filter(c => c.invoice_status === 'unpaired' && !c.paid).map(c => c.id)));
  const clearSelection = () => setSelected(new Set());

  /* ── cancel invoice ── */
  const cancelInvoice = async (invoiceId) => {
    try {
      const res = await api.get(`/api/invoices/${invoiceId}`);
      const inv = res.invoice;
      setCancelInvoiceModal({
        invoiceId,
        invoiceNumber: inv.invoice_number,
        customerName: inv.customers?.name || 'ไม่ทราบ',
        billCount: inv.bills?.length || 0,
        totalAmount: inv.total_amount,
      });
    } catch (err) { toast.error('ไม่สามารถโหลดข้อมูลใบวางบิลได้'); }
  };

  const doCancelInvoice = async () => {
    const { invoiceId } = cancelInvoiceModal;
    setCancelInvoiceModal(null);
    try {
      await api.post(`/api/invoices/${invoiceId}/cancel`, {});
      toast.success('ถอนใบวางบิลสำเร็จ');
      loadAll();
      if (searched) search();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
  };

  /* ── create invoice — สร้างทันทีไม่ต้องกรอก modal ── */
  const createInvoice = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const bills = allData.data.filter(c => ids.includes(c.id));
    const customerIds = [...new Set(bills.map(b => b.customer_id))];
    if (customerIds.length > 1) { toast.error('ต้องเลือกบิลของลูกค้าคนเดียวกันเท่านั้น'); return; }
    setInvoiceCreating(true);
    try {
      await api.post('/api/invoices', {
        customer_id:     customerIds[0],
        credit_sale_ids: ids,
        issue_date:      todayStr(),
      });
      toast.success('สร้างใบวางบิลสำเร็จ');
      clearSelection();
      loadAll();
      if (searched) search();
    } catch (err) {
      toast.error(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setInvoiceCreating(false);
    }
  };

  const selectedTotal = allData.data.filter(c => selected.has(c.id)).reduce((s, c) => s + parseFloat(c.amount || 0), 0);

  /* ── ตรวจว่าเป็นลูกค้ารายย่อย (K01) หรือไม่ ── */
  const selectedCustomer = customers.find(c => String(c.id) === String(form.customerId));
  const isRetail = selectedCustomer && (
    selectedCustomer.code?.toUpperCase() === 'K01' ||
    selectedCustomer.name?.includes('รายย่อย') ||
    selectedCustomer.name?.includes('K01')
  );
  const totalUnpaid   = allData.data.filter(c => !c.paid).reduce((s, c) => s + parseFloat(c.amount || 0), 0);

  return (
    <main className="main-container">
      {loading && <Loading />}

      {deleteModal && (
        <Modal title="ยืนยันการลบ" message="ต้องการลบรายการนี้ใช่หรือไม่?"
          onConfirm={() => doDelete(deleteModal)} onCancel={() => setDeleteModal(null)} />
      )}

      {cancelInvoiceModal && (
        <Modal
          title="ยืนยันการยกเลิกใบวางบิล"
          message={
            <div style={{ lineHeight: 1.8 }}>
              <div>ต้องการยกเลิกใบวางบิล {cancelInvoiceModal.invoiceNumber} หรือไม่?</div>
              <div>ลูกค้า: {cancelInvoiceModal.customerName}</div>
              <div>จำนวนบิล: {cancelInvoiceModal.billCount} รายการ</div>
              <div>ยอดรวม: ฿{Number(cancelInvoiceModal.totalAmount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
              <div style={{ marginTop: 12 }}>
                <strong>หมายเหตุ:</strong> บิลทั้งหมดจะกลับไปเป็นสถานะ "ยังไม่ได้วางบิล" และสามารถนำไปวางบิลใหม่ได้<br />
                เลข Invoice นี้จะถูกนำกลับมาใช้ใหม่เมื่อสร้าง Invoice ครั้งถัดไป
              </div>
            </div>
          }
          onConfirm={doCancelInvoice}
          onCancel={() => setCancelInvoiceModal(null)}
        />
      )}

      {editModal && (
        <div className="modal-backdrop" onClick={() => setEditModal(null)}>
          <div className="modal-box" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">แก้ไขรายการเงินเชื่อ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
                <label className="form-label">ลูกค้า</label>
                <select className="form-input" value={editForm.customerId}
                  onChange={e => setEditForm(f => ({ ...f, customerId: e.target.value }))}>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">วันที่</label>
                <DatePicker value={editForm.date}
                  onChange={v => setEditForm(f => ({ ...f, date: v }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ยอดเงิน (฿)</label>
                <input type="number" step="0.01" className="form-input" value={editForm.amount}
                  onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">เล่มที่</label>
                <input className="form-input" value={editForm.billBook}
                  onChange={e => setEditForm(f => ({ ...f, billBook: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">เลขที่</label>
                <input className="form-input" value={editForm.billNumber}
                  onChange={e => setEditForm(f => ({ ...f, billNumber: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">ทะเบียนรถ</label>
                <input className="form-input" value={editForm.vehicleNumber}
                  onChange={e => setEditForm(f => ({ ...f, vehicleNumber: e.target.value }))} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">หมายเหตุ</label>
                <input className="form-input" value={editForm.note}
                  onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setEditModal(null)}>ยกเลิก</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={editSubmitting}>
                {editSubmitting ? 'กำลังบันทึก…' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">เงินเชื่อ · Credit</div>
          <h1 className="page-title">จัดการเงินเชื่อ</h1>
        </div>
        <div className="page-subtitle">{thaiDate(new Date())}</div>
      </div>

      {/* STATS */}
      <section className="metrics-strip" style={{ marginBottom: 48 }}>
        <div className="metric-item">
          <div className="metric-label">ยอดเงินเชื่อวันนี้</div>
          <div className="metric-value">฿{fmt(todayData.summary?.totalAmount)}</div>
          <div className="metric-sub">{todayData.summary?.totalBills || 0} รายการ</div>
        </div>
        <div className="metric-item bordered">
          <div className="metric-label">ยอดค้างชำระทั้งหมด</div>
          <div className="metric-value" style={{ color: 'var(--rust)' }}>
            ฿{fmt(searched ? totalUnpaid : 0)}
          </div>
          <div className="metric-sub">{searched ? allData.data.filter(c => !c.paid).length : '—'} รายการ</div>
        </div>
        <div className="metric-item bordered">
          <div className="metric-label">ชำระแล้ว (เดือนนี้)</div>
          <div className="metric-value" style={{ color: paidMonth > 0 ? 'var(--sage)' : 'var(--ink)' }}>
            ฿{fmt(paidMonth)}
          </div>
          <div className="metric-sub">รับชำระเดือนนี้</div>
        </div>
      </section>

      {/* ── ADD FORM ── */}
      <section style={{ paddingBottom: 40, marginBottom: 48, borderBottom: '1px solid var(--line-soft)' }}>
        <div className="section-hd" style={{ marginBottom: 24 }}>
          <span className="eyebrow">เพิ่มรายการขายเชื่อ</span>
        </div>
        <form onSubmit={handleAdd}>
          {/* แถว 1 — วันที่ */}
          <div style={{ marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0, maxWidth: 220 }}>
              <label className="form-label">วันที่ *</label>
              <DatePicker value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} required />
            </div>
          </div>

          {/* แถว 2 — ลูกค้า เล่มที่ เลขที่ ยอดเงิน */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 20, marginBottom: 20 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ลูกค้า *</label>
              <select className="form-input" value={form.customerId}
                onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))} required>
                <option value="">เลือกลูกค้า</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">เล่มที่ *</label>
              <input ref={billBookRef} className="form-input" placeholder="01" value={form.billBook}
                onChange={e => setForm(f => ({ ...f, billBook: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">เลขที่ *</label>
              <input className="form-input" placeholder="001" value={form.billNumber}
                onChange={e => setForm(f => ({ ...f, billNumber: e.target.value }))} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ยอดเงิน (฿) *</label>
              <input type="number" step="0.01" className="form-input" placeholder="0.00" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
            </div>
          </div>

          {/* แถว 3 — ทะเบียนรถ หมายเหตุ ปุ่มบันทึก */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">ทะเบียนรถ</label>
              <input className="form-input" placeholder="ก-1234 สบ" value={form.vehicleNumber}
                onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                หมายเหตุ{isRetail && (
                  <span style={{ color: 'var(--rust)', marginLeft: 6, fontFamily: 'var(--f-mono)', fontSize: 11 }}>
                    * ระบุชื่อลูกค้า
                  </span>
                )}
              </label>
              <input
                className="form-input"
                placeholder={isRetail ? 'ระบุชื่อลูกค้า...' : 'หมายเหตุ...'}
                value={form.note}
                required={isRetail}
                style={{ borderColor: isRetail && !form.note ? 'var(--rust)' : undefined }}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 32px', fontSize: 15, height: 42, justifyContent: 'center' }} disabled={submitting}>
              {submitting ? 'กำลังบันทึก…' : '✓ บันทึกรายการ'}
            </button>
          </div>
        </form>
      </section>

      {/* ── TODAY'S CREDITS ── */}
      <section style={{ marginBottom: 64 }}>
        <div className="section-hd" style={{ marginBottom: 20 }}>
          <span className="eyebrow">รายการขายเชื่อวันนี้</span>
          <span className="section-meta">{todayData.summary?.totalBills || 0} รายการ · ฿{fmt(todayData.summary?.totalAmount)}</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ลำดับ</th><th>ลูกค้า</th><th>เล่ม-เลขที่</th>
                <th>ทะเบียนรถ</th><th>ยอดเงิน</th><th>กรอกโดย</th><th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {todayData.data?.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>ไม่มีรายการขายเชื่อวันนี้</td></tr>
              ) : todayData.data?.map((c, i) => (
                <tr key={c.id}>
                  <td className="mono" style={{ fontSize: 13 }}>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{c.customers?.name || '—'}</td>
                  <td className="mono" style={{ fontSize: 14 }}>{c.bill_book}/{c.bill_number}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{c.vehicle_number || '—'}</td>
                  <td className="mono" style={{ fontSize: 16 }}>฿{fmt(c.amount)}</td>
                  <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{c.users?.name || c.users?.username || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => openEdit(c)}>แก้ไข</button>
                      <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => setDeleteModal(c.id)}>ลบ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── ALL CREDITS + INVOICE ── */}
      <section>
        <div className="section-hd" style={{ marginBottom: 20 }}>
          <span className="eyebrow">รายการขายเชื่อทั้งหมด / วางบิล</span>
        </div>

        {/* filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">วันที่เริ่มต้น</label>
            <DatePicker value={fStart} onChange={v => setFStart(v)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">วันที่สิ้นสุด</label>
            <DatePicker value={fEnd} onChange={v => setFEnd(v)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">ลูกค้า</label>
            <select className="form-input" value={fCustomer} onChange={e => setFCustomer(e.target.value)}>
              <option value="all">ทั้งหมด</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">สถานะใบวางบิล</label>
            <select className="form-input" value={fInvStatus} onChange={e => setFInvStatus(e.target.value)}>
              <option value="all">ทั้งหมด</option>
              <option value="unpaired">ยังไม่วางบิล</option>
              <option value="active">วางบิลแล้ว</option>
              <option value="paid">ชำระแล้ว</option>
            </select>
          </div>
        </div>

        {/* action bar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={search}>🔍 ค้นหา</button>
          <button className="btn" onClick={() => { setFStart(''); setFEnd(''); setFCustomer('all'); setFInvStatus('all'); setAllData({ data: [], summary: {} }); setSearched(false); clearSelection(); }}>
            ↺ ล้างตัวกรอง
          </button>
          {searched && (
            <>
              <button className="btn" onClick={selectAllUnpaired}>
                ☐ เลือกทั้งหมด (ยังไม่วางบิล)
              </button>
              <button className="btn" onClick={clearSelection}>☓ ยกเลิกเลือก</button>
            </>
          )}
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--ink-3)', marginLeft: 8 }}>
            รายการเลือก: {selected.size}
            {selected.size > 0 && ` · ฿${fmt(selectedTotal)}`}
          </span>
          <div style={{ flex: 1 }} />
          {selected.size > 0 && (
            <button className="btn btn-primary" onClick={createInvoice} disabled={invoiceCreating}>
              {invoiceCreating ? 'กำลังสร้าง…' : `📋 สร้างใบวางบิล (${selected.size} รายการ · ฿${fmt(selectedTotal)})`}
            </button>
          )}
        </div>

        {/* table */}
        <div className="table-wrap">
          {!searched ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ink-3)', fontSize: 15 }}>
              กด "ค้นหา" เพื่อแสดงรายการ
            </div>
          ) : (
            <table className="data-table" style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '3%' }} />   {/* checkbox */}
                <col style={{ width: '9%' }} />  {/* วันที่ */}
                <col style={{ width: '13%' }} /> {/* ลูกค้า */}
                <col style={{ width: '8%' }} />  {/* เล่ม-เลขที่ */}
                <col style={{ width: '8%' }} />  {/* ทะเบียนรถ */}
                <col style={{ width: '9%' }} />  {/* ยอดเงิน */}
                <col style={{ width: '11%' }} /> {/* หมายเหตุ */}
                <col style={{ width: '10%' }} /> {/* สถานะ */}
                <col style={{ width: '11%' }} /> {/* จัดการ */}
              </colgroup>
              <thead>
                <tr>
                  <th></th>
                  <th>วันที่</th>
                  <th>ลูกค้า</th>
                  <th>เล่ม-เลขที่</th>
                  <th>ทะเบียนรถ</th>
                  <th className="r">ยอดเงิน (฿)</th>
                  <th style={{ paddingLeft: 24 }}>หมายเหตุ</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {allData.data.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>ไม่พบรายการ</td></tr>
                ) : pagedData.map(c => {
                  // canSelect: unpaired = ยังไม่วางบิล, invoice_id must be null to allow re-invoicing
                  const canSelect = c.invoice_status === 'unpaired' && !c.paid && !c.invoice_id;
                  return (
                    <tr key={c.id} style={{ background: selected.has(c.id) ? 'rgba(212,119,10,0.04)' : 'transparent' }}>
                      <td style={{ verticalAlign: 'middle' }}>
                        {canSelect && (
                          <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)}
                            style={{ width: 15, height: 15, cursor: 'pointer', display: 'block', margin: 'auto' }} />
                        )}
                      </td>
                      <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{thaiShort(new Date(c.date))}</td>
                      <td style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {c.customers?.name || '—'}
                      </td>
                      <td className="mono" style={{ fontSize: 13 }}>{c.bill_book}/{c.bill_number}</td>
                      <td className="mono" style={{ fontSize: 13 }}>{c.vehicle_number || '—'}</td>
                      <td className="r mono" style={{ fontSize: 15, paddingRight: 20 }}>{fmt(c.amount)}</td>
                      <td style={{ fontSize: 13, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 24 }}>
                        {c.note || '—'}
                      </td>
                      <td>
                        <InvoiceBadge
                          paid={c.paid}
                          invoiceNumber={c.invoices?.invoice_number}
                          invoiceStatus={c.invoice_status}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                          {c.invoice_status === 'invoiced' && c.invoices?.id ? (
                            <button
                              onClick={() => cancelInvoice(c.invoices.id)}
                              style={{
                                fontSize: 12, padding: '4px 10px', whiteSpace: 'nowrap',
                                border: '1px solid var(--rust)', borderRadius: 6,
                                background: 'rgba(192,57,43,0.08)', color: 'var(--rust)',
                                cursor: 'pointer', fontFamily: 'var(--f-body)',
                              }}>
                              ↩ ถอนใบวาง
                            </button>
                          ) : (
                            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
                              onClick={() => openEdit(c)}>แก้ไข</button>
                          )}
                          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '3px 8px' }}
                            onClick={() => setDeleteModal(c.id)}>ลบ</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* summary footer */}
        {searched && allData.data.length > 0 && (
          <div style={{ display: 'flex', gap: 32, paddingTop: 16, borderTop: '1px solid var(--line-soft)', marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
              ทั้งหมด {allData.data.length} รายการ
            </span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
              รวม ฿{fmt(allData.summary?.totalAmount)}
            </span>
            <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: '#c0392b' }}>
              ค้างชำระ ฿{fmt(allData.summary?.unpaidAmount)}
            </span>
          </div>
        )}

        {/* pagination */}
        {searched && totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
              <span>แสดง:</span>
              <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }}
                style={{ border: '1px solid var(--line-soft)', borderRadius: 6, padding: '3px 8px', fontFamily: 'var(--f-mono)', fontSize: 13, cursor: 'pointer' }}>
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>แสดง {(page - 1) * perPage + 1} ถึง {Math.min(page * perPage, totalRecords)} จาก {totalRecords} รายการ</span>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--line-soft)', background: 'none', cursor: page === 1 ? 'default' : 'pointer', color: page === 1 ? 'var(--ink-4)' : 'var(--ink-1)', fontSize: 16 }}>‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                .reduce((acc, n, idx, arr) => {
                  if (idx > 0 && n - arr[idx - 1] > 1) acc.push('…');
                  acc.push(n);
                  return acc;
                }, [])
                .map((n, i) => n === '…'
                  ? <span key={`e${i}`} style={{ width: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>…</span>
                  : <button key={n} onClick={() => setPage(n)}
                      style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--line-soft)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--f-mono)', fontWeight: page === n ? 700 : 400, background: page === n ? '#e07b39' : 'none', color: page === n ? '#fff' : 'var(--ink-1)' }}>{n}</button>
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid var(--line-soft)', background: 'none', cursor: page === totalPages ? 'default' : 'pointer', color: page === totalPages ? 'var(--ink-4)' : 'var(--ink-1)', fontSize: 16 }}>›</button>
            </div>
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}
