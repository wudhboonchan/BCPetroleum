import Footer from '../components/Footer.jsx';
import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import Modal from '../components/Modal.jsx';
import { fmt, thaiDate, thaiShort, todayStr } from '../lib/utils.js';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [deleteModal, setDeleteModal] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', phone: '', contact_person: '', address: '', note: '' });
  const [submitting, setSubmitting] = useState(false);

  // history modal
  const [historyModal, setHistoryModal] = useState(null); // customer object
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // invoice creation
  const [invoiceCreating, setInvoiceCreating] = useState(null); // customer id
  const [cancelInvoiceModal, setCancelInvoiceModal] = useState(null);

  // select-bills modal
  const [selectBillsModal, setSelectBillsModal] = useState(null);
  const [selectBillsLoading, setSelectBillsLoading] = useState(false);
  const [selectedBills, setSelectedBills] = useState(new Set());
  const [confirmingInvoice, setConfirmingInvoice] = useState(false);

  // invoice detail modal
  const [invDetailModal, setInvDetailModal] = useState(null); // invoice object
  const [invDetailLoading, setInvDetailLoading] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payMethod, setPayMethod] = useState('transfer');
  const [payDate, setPayDate] = useState(todayStr());
  const [lineSending, setLineSending] = useState(false);

  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/customer');
      setCustomers(res.data || []);
    } catch { toast.error('โหลดข้อมูลไม่ได้'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setForm({ name: '', code: '', phone: '', contact_person: '', address: '', note: '', line_user_id: '' });
    setAddModal(true);
  };

  const openEdit = (c) => {
    setForm({
      name: c.name || '',
      code: c.code || '',
      phone: c.phone || '',
      contact_person: c.contact_person || '',
      address: c.address || '',
      note: c.note || '',
      line_user_id: c.line_user_id || '',
    });
    setEditModal(c);
  };

  const save = async () => {
    setSubmitting(true);
    try {
      const body = {
        name: form.name,
        code: form.code,
        phone: form.phone,
        contact_person: form.contact_person,
        address: form.address,
        note: form.note,
        line_user_id: form.line_user_id || null,
      };
      if (editModal) {
        await api.put(`/api/customer/${editModal.id}`, body);
        toast.success('แก้ไขข้อมูลลูกค้าสำเร็จ');
        setEditModal(null);
      } else {
        await api.post('/api/customer', body);
        toast.success('เพิ่มลูกค้าสำเร็จ');
        setAddModal(false);
      }
      load();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setSubmitting(false); }
  };

  const deleteCustomer = async (id) => {
    try {
      await api.del(`/api/customer/${id}`);
      toast.success('ลบลูกค้าสำเร็จ');
      setDeleteModal(null);
      load();
    } catch { toast.error('ไม่สามารถลบได้'); }
  };

  const openHistory = async (c) => {
    setHistoryModal(c);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/api/customer/${c.id}`);
      setHistoryData(res);
    } catch { toast.error('โหลดประวัติไม่ได้'); }
    finally { setHistoryLoading(false); }
  };

  const openSelectBills = async (c) => {
    setSelectBillsLoading(true);
    setSelectBillsModal({ customer: c, bills: [] });
    setSelectedBills(new Set());
    try {
      const res = await api.get('/api/credit/filter', { customerId: c.id, paid: 'false' });
      const unbilled = (res.data || []).filter(s => !s.invoice_id);
      if (unbilled.length === 0) { toast.error('ไม่มีรายการที่ยังไม่ได้วางบิล'); setSelectBillsModal(null); return; }
      setSelectBillsModal({ customer: c, bills: unbilled });
      setSelectedBills(new Set(unbilled.map(s => s.id)));
    } catch { toast.error('โหลดรายการไม่ได้'); setSelectBillsModal(null); }
    finally { setSelectBillsLoading(false); }
  };

  const confirmCreateInvoice = async () => {
    const ids = [...selectedBills];
    if (ids.length === 0) { toast.error('กรุณาเลือกอย่างน้อย 1 รายการ'); return; }
    setConfirmingInvoice(true);
    try {
      await api.post('/api/invoices', {
        customer_id: selectBillsModal.customer.id,
        credit_sale_ids: ids,
        issue_date: todayStr(),
      });
      toast.success('สร้างใบวางบิลสำเร็จ');
      setSelectBillsModal(null);
      load();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setConfirmingInvoice(false); }
  };

  const toggleBill = (id) => setSelectedBills(prev => {
    const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s;
  });

  const openInvoiceDetail = async (inv) => {
    setInvDetailLoading(true);
    setInvDetailModal({ id: inv.id, invoice_number: inv.invoice_number });
    try {
      const res = await api.get(`/api/invoices/${inv.id}`);
      setInvDetailModal(res.invoice);
    } catch { toast.error('โหลดข้อมูลใบวางบิลไม่ได้'); setInvDetailModal(null); }
    finally { setInvDetailLoading(false); }
  };

  const doPayInvoice = async () => {
    setPaySubmitting(true);
    try {
      await api.post(`/api/invoices/${invDetailModal.id}/pay`, {
        payment_date: payDate,
        payment_method: payMethod,
      });
      toast.success('บันทึกการรับชำระเงินสำเร็จ');
      setPayModal(false);
      setInvDetailModal(null);
      load();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
    finally { setPaySubmitting(false); }
  };

  const sendLineInvoice = async (invoiceId) => {
    setLineSending(true);
    try {
      const res = await api.post(`/api/line/send-invoice/${invoiceId}`, {});
      toast.success(res.message || 'ส่ง LINE สำเร็จ');
    } catch (err) {
      toast.error(err.message || 'ส่ง LINE ไม่สำเร็จ');
    } finally {
      setLineSending(false);
    }
  };

  const openCancelInvoice = async (inv) => {
    try {
      const res = await api.get(`/api/invoices/${inv.id}`);
      const data = res.invoice;
      setCancelInvoiceModal({
        invoiceId: inv.id,
        invoiceNumber: data.invoice_number,
        customerName: data.customers?.name || '',
        billCount: data.bills?.length || 0,
        totalAmount: data.total_amount,
      });
    } catch { toast.error('โหลดข้อมูลใบวางบิลไม่ได้'); }
  };

  const doCancelInvoice = async () => {
    const { invoiceId } = cancelInvoiceModal;
    setCancelInvoiceModal(null);
    try {
      await api.post(`/api/invoices/${invoiceId}/cancel`, {});
      toast.success('ถอนใบวางบิลสำเร็จ');
      load();
    } catch (err) { toast.error(err.message || 'เกิดข้อผิดพลาด'); }
  };

  /* ─── Customer Form Modal ─── */
  const CustomerFormModal = ({ title, onClose }) => (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
          {[
            { key: 'name', label: 'ชื่อลูกค้า *', required: true },
            { key: 'code', label: 'รหัสลูกค้า' },
            { key: 'phone', label: 'เบอร์โทร' },
            { key: 'contact_person', label: 'ผู้ติดต่อ' },
            { key: 'address', label: 'ที่อยู่' },
            { key: 'note', label: 'หมายเหตุ' },
            { key: 'line_user_id', label: '💬 LINE User ID' },
          ].map(({ key, label, required }) => (
            <div className="form-group" key={key}>
              <label className="form-label">{label}</label>
              <input
                type="text"
                className="form-input"
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={required}
              />
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={save} disabled={submitting || !form.name}>บันทึก</button>
        </div>
      </div>
    </div>
  );

  /* ─── History Modal ─── */
  const HistoryModal = () => {
    if (!historyModal) return null;
    const c = historyModal;
    const sales = historyData?.creditSales || [];
    const sum = historyData?.summary;
    return (
      <div className="modal-backdrop" onClick={() => setHistoryModal(null)}>
        <div className="modal-box" style={{ maxWidth: 760, width: '95vw' }} onClick={e => e.stopPropagation()}>
          <div className="modal-title">📋 ประวัติ — {c.name}</div>
          {historyLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
          ) : (
            <>
              {/* Summary */}
              {sum && (
                <div style={{ display: 'flex', gap: 24, marginBottom: 20, padding: '12px 16px', background: 'var(--surface-2, #f5f0eb)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>ยอดทั้งหมด</div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontWeight: 600 }}>฿{fmt(sum.totalAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>ชำระแล้ว</div>
                    <div style={{ fontFamily: 'var(--f-mono)', color: '#3a7a48', fontWeight: 600 }}>฿{fmt(sum.paidAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>ค้างชำระ</div>
                    <div style={{ fontFamily: 'var(--f-mono)', color: 'var(--rust)', fontWeight: 600 }}>฿{fmt(sum.unpaidAmount)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>รายการทั้งหมด</div>
                    <div style={{ fontFamily: 'var(--f-mono)', fontWeight: 600 }}>{sum.totalBills} รายการ</div>
                  </div>
                </div>
              )}
              {/* Table */}
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>วันที่</th><th>เล่ม-เลขที่</th><th>ทะเบียน</th>
                      <th className="r">ยอด (฿)</th><th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.length === 0 ? (
                      <tr><td colSpan="5" className="empty-state">ไม่มีประวัติ</td></tr>
                    ) : sales.map(s => (
                      <tr key={s.id}>
                        <td>{thaiShort(new Date(s.date))}</td>
                        <td className="mono">{s.bill_book}/{s.bill_number}</td>
                        <td className="mono">{s.vehicle_number || '—'}</td>
                        <td className="r mono">฿{fmt(s.amount)}</td>
                        <td>
                          {s.paid
                            ? <span style={{ color: '#3a7a48', fontSize: 12 }}>✓ จ่ายแล้ว</span>
                            : <span style={{ color: 'var(--rust)', fontSize: 12 }}>ค้างชำระ</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="modal-footer" style={{ marginTop: 16 }}>
            <button className="btn" onClick={() => setHistoryModal(null)}>ปิด</button>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Invoice Detail Modal ─── */
  const InvoiceDetailModal = () => {
    if (!invDetailModal) return null;
    const inv = invDetailModal;
    const bills = inv.bills || [];
    const isPaid = inv.status === 'paid';

    const handlePrint = () => {
      const token = inv.public_token;
      if (token) {
        // เปิดหน้า public invoice แล้ว print — สวยและเสถียรกว่า
        window.open(`/invoice/${token}?print=1`, '_blank');
      } else {
        toast.error('ไม่พบ token ของใบวางบิลนี้ กรุณาลองใหม่อีกครั้ง');
      }
    };

    return (
      <div className="modal-backdrop" onClick={() => { setInvDetailModal(null); setPayModal(false); }}>
        <div className="modal-box" style={{ maxWidth: 720, width: '95vw' }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>ใบวางบิล {inv.invoice_number}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
                วันที่ออกใบวางบิล: {inv.issue_date ? thaiDate(new Date(inv.issue_date)) : '—'}
              </div>
            </div>
            <span style={{
              padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 500,
              background: isPaid ? 'rgba(58,122,72,0.12)' : 'rgba(217,119,6,0.12)',
              color: isPaid ? '#3a7a48' : '#b45309',
            }}>
              สถานะ: {isPaid ? 'ชำระแล้ว' : 'ค้างชำระ'}
            </span>
          </div>

          {invDetailLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
          ) : (
            <>
              {/* Summary strip */}
              <div style={{ display: 'flex', gap: 32, padding: '14px 16px', background: 'var(--surface-2, #f5f0eb)', borderRadius: 8, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>ลูกค้า</div>
                  <div style={{ fontWeight: 600 }}>{inv.customers?.name || '—'}</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>จำนวนบิล</div>
                  <div style={{ fontWeight: 600, fontFamily: 'var(--f-mono)' }}>{bills.length} รายการ</div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>ยอดรวม</div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--f-mono)', color: 'var(--rust)', fontSize: 18 }}>
                    ฿{Number(inv.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                {isPaid && inv.confirmed_by && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>รับชำระโดย</div>
                    <div style={{ fontWeight: 500 }}>{inv.confirmed_by}</div>
                  </div>
                )}
              </div>

              {/* Bills table */}
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, fontFamily: 'var(--f-body)' }}>รายการบิล</div>
              <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--line-soft)', borderRadius: 8 }}>
                <table className="data-table" style={{ fontSize: 13, tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: '6%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '18%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '36%' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center', fontFamily: 'var(--f-body)' }}>#</th>
                      <th style={{ fontFamily: 'var(--f-body)' }}>วันที่</th>
                      <th style={{ fontFamily: 'var(--f-body)' }}>เล่ม/เลขที่</th>
                      <th style={{ fontFamily: 'var(--f-body)' }}>ทะเบียนรถ</th>
                      <th style={{ fontFamily: 'var(--f-body)' }}>หมายเหตุ</th>
                      <th className="r" style={{ paddingRight: 20, fontFamily: 'var(--f-body)' }}>ยอดเงิน (฿)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map((b, i) => (
                      <tr key={b.id}>
                        <td className="mono" style={{ textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>{i + 1}</td>
                        <td className="mono" style={{ fontSize: 13 }}>{thaiShort(new Date(b.date))}</td>
                        <td className="mono" style={{ fontSize: 13 }}>{b.bill_book}/{b.bill_number}</td>
                        <td className="mono" style={{ fontSize: 13 }}>{b.vehicle_number || '—'}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>{b.note || '—'}</td>
                        <td className="r mono" style={{ paddingRight: 20, fontSize: 14 }}>฿{fmt(b.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'right', paddingRight: 12, fontWeight: 600, fontSize: 13, borderTop: '1px solid var(--line-soft)', fontFamily: 'var(--f-body)' }}>รวมทั้งสิ้น</td>
                      <td className="r mono" style={{ paddingRight: 20, fontWeight: 700, fontSize: 15, borderTop: '1px solid var(--line-soft)', color: 'var(--rust)' }}>
                        ฿{Number(inv.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Pay confirm inline */}
              {payModal && (
                <div style={{ marginTop: 16, padding: '16px', background: 'rgba(37,99,175,0.06)', border: '1px solid rgba(37,99,175,0.2)', borderRadius: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
                    รับชำระ ฿{Number(inv.total_amount).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>วันที่รับชำระ</div>
                      <input
                        type="date"
                        value={payDate}
                        onChange={e => setPayDate(e.target.value)}
                        style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--line-soft)', borderRadius: 6, fontSize: 14 }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 6 }}>ช่องทางการชำระ</div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                          <input type="radio" name="pay-method" value="transfer" checked={payMethod === 'transfer'} onChange={() => setPayMethod('transfer')} />
                          เงินโอน 📲
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                          <input type="radio" name="pay-method" value="cash" checked={payMethod === 'cash'} onChange={() => setPayMethod('cash')} />
                          เงินสด 💵
                        </label>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className="btn" onClick={() => setPayModal(false)}>ยกเลิก</button>
                    <button className="btn btn-primary" onClick={doPayInvoice} disabled={paySubmitting || !payDate} style={{ background: '#22a06b', borderColor: '#22a06b' }}>
                      {paySubmitting ? 'กำลังบันทึก…' : 'ยืนยันรับชำระ'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div className="modal-footer" style={{ marginTop: 20 }}>
            <button className="btn" onClick={() => { setInvDetailModal(null); setPayModal(false); }}>ปิด</button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={handlePrint} style={{ borderColor: '#2563af', color: '#2563af' }}>🖨 พิมพ์ใบวางบิล</button>
              <button
                className="btn"
                onClick={() => sendLineInvoice(inv.id)}
                disabled={lineSending}
                style={{ borderColor: '#06c755', color: '#06c755' }}
                title={inv.customers?.line_user_id ? 'ส่งใบวางบิลทาง LINE' : 'ยังไม่มี LINE User ID'}
              >
                {lineSending ? '⏳ กำลังส่ง…' : '💬 ส่งทาง LINE'}
              </button>
              {!isPaid && (
                <>
                  <button className="btn" onClick={() => { setInvDetailModal(null); openCancelInvoice(inv); }}
                    style={{ borderColor: 'var(--rust)', color: 'var(--rust)' }}>
                    ยกเลิกใบวางบิล
                  </button>
                  <button className="btn btn-primary" onClick={() => { setPayMethod('transfer'); setPayDate(todayStr()); setPayModal(p => !p); }}
                    style={{ background: '#22a06b', borderColor: '#22a06b' }}>
                    ชำระเงิน
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Select Bills Modal ─── */
  const SelectBillsModal = () => {
    if (!selectBillsModal) return null;
    const { customer, bills } = selectBillsModal;
    const selectedTotal = bills.filter(b => selectedBills.has(b.id)).reduce((s, b) => s + parseFloat(b.amount || 0), 0);
    const allSelected = bills.length > 0 && bills.every(b => selectedBills.has(b.id));
    return (
      <div className="modal-backdrop" onClick={() => setSelectBillsModal(null)}>
        <div className="modal-box" style={{ maxWidth: 680, width: '95vw' }} onClick={e => e.stopPropagation()}>
          <div className="modal-title">สร้างใบวางบิล — {customer.name}</div>
          {selectBillsLoading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>กำลังโหลด…</div>
          ) : (
            <>
              {/* Select all */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={allSelected}
                    onChange={() => setSelectedBills(allSelected ? new Set() : new Set(bills.map(b => b.id)))}
                    style={{ width: 15, height: 15 }} />
                  เลือกทั้งหมด ({bills.length} รายการ)
                </label>
                <span style={{ fontFamily: 'var(--f-mono)', fontSize: 14, color: 'var(--ink-2)' }}>
                  เลือก {selectedBills.size} รายการ · ฿{fmt(selectedTotal)}
                </span>
              </div>
              {/* Bills list */}
              <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--line-soft)', borderRadius: 8 }}>
                <table className="data-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>วันที่</th><th>เล่ม-เลขที่</th><th>ทะเบียน</th><th>หมายเหตุ</th>
                      <th className="r" style={{ paddingRight: 16 }}>ยอด (฿)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(b => (
                      <tr key={b.id} style={{ cursor: 'pointer', background: selectedBills.has(b.id) ? 'rgba(212,119,10,0.04)' : 'transparent' }}
                        onClick={() => toggleBill(b.id)}>
                        <td><input type="checkbox" checked={selectedBills.has(b.id)} onChange={() => toggleBill(b.id)}
                          style={{ width: 15, height: 15, display: 'block', margin: 'auto' }} onClick={e => e.stopPropagation()} /></td>
                        <td className="mono">{thaiShort(new Date(b.date))}</td>
                        <td className="mono">{b.bill_book}/{b.bill_number}</td>
                        <td className="mono">{b.vehicle_number || '—'}</td>
                        <td style={{ color: 'var(--ink-3)' }}>{b.note || '—'}</td>
                        <td className="r mono" style={{ paddingRight: 16 }}>฿{fmt(b.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="modal-footer" style={{ marginTop: 20 }}>
            <button className="btn" onClick={() => setSelectBillsModal(null)}>ยกเลิก</button>
            <button className="btn btn-primary" onClick={confirmCreateInvoice}
              disabled={confirmingInvoice || selectedBills.size === 0}>
              {confirmingInvoice ? 'กำลังสร้าง…' : `สร้างใบวางบิล (${selectedBills.size} รายการ · ฿${fmt(bills.filter(b => selectedBills.has(b.id)).reduce((s,b)=>s+parseFloat(b.amount||0),0))})`}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="main-container">
      {loading && <Loading />}

      {(addModal || editModal) && (
        <CustomerFormModal
          title={editModal ? 'แก้ไขข้อมูลลูกค้า' : 'เพิ่มลูกค้าใหม่'}
          onClose={() => { setAddModal(false); setEditModal(null); }}
        />
      )}

      {deleteModal && (
        <Modal
          title="ยืนยันการลบ"
          message="ต้องการลบลูกค้านี้ใช่หรือไม่? รายการเงินเชื่อจะยังคงอยู่"
          onConfirm={() => deleteCustomer(deleteModal)}
          onCancel={() => setDeleteModal(null)}
        />
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
                <strong>หมายเหตุ:</strong> บิลทั้งหมดจะกลับไปเป็นสถานะ "ยังไม่ได้วางบิล"
              </div>
            </div>
          }
          onConfirm={doCancelInvoice}
          onCancel={() => setCancelInvoiceModal(null)}
        />
      )}

      <HistoryModal />
      <InvoiceDetailModal />
      <SelectBillsModal />

      {/* PAGE HEADER */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Customers · ลูกค้า</div>
          <h1 className="page-title">ลูกค้าเงินเชื่อ</h1>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>+ เพิ่มลูกค้า</button>
      </div>

      {/* STATS */}
      <div className="stats-grid" style={{ marginBottom: 32, gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="metric-label">ลูกค้าทั้งหมด</div>
          <div className="metric-value mono">{customers.length}</div>
          <div className="metric-sub">ราย</div>
        </div>
        <div className="stat-card">
          <div className="metric-label">ยอดค้างชำระรวม</div>
          <div className="metric-value mono">฿{fmt(customers.reduce((s, c) => s + (parseFloat(c.unpaidAmount) || 0), 0))}</div>
          <div className="metric-sub">ทุกลูกค้า</div>
        </div>
        <div className="stat-card">
          <div className="metric-label">รอรับชำระ (วางบิลแล้ว)</div>
          <div className="metric-value mono">฿{fmt(customers.reduce((s, c) => s + (parseFloat(c.activeInvoice?.total_amount) || 0), 0))}</div>
          <div className="metric-sub">ยอดในใบวางบิล active ทั้งหมด</div>
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ marginBottom: 20 }}>
        <input
          className="form-input" placeholder="ค้นหาชื่อหรือรหัสลูกค้า..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 360 }}
        />
      </div>

      {/* TABLE */}
      <div className="table-wrap">
          <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '11%' }} />
              <col style={{ width: '51%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>รหัส</th>
                <th>ชื่อลูกค้า</th>
                <th>เบอร์โทร</th>
                <th>ผู้ติดต่อ</th>
                <th className="r">ยอดค้างชำระ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan="6" className="empty-state">ไม่พบลูกค้า</td></tr>
              ) : filtered.map(c => {
                const unpaid = parseFloat(c.unpaidAmount) || 0;
                const inv = c.activeInvoice;
                const hasUnbilledExtra = inv && (c.unbilledCount || 0) > 0;
                const isCreating = invoiceCreating === c.id;

                return (
                  <tr key={c.id}>
                    <td className="mono" style={{ fontSize: 13 }}>{c.code || '—'}</td>
                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{c.name}</td>
                    <td className="mono" style={{ fontSize: 13 }}>{c.phone || '-'}</td>
                    <td style={{ fontSize: 13, color: 'var(--ink-2)' }}>{c.contact_person || '-'}</td>
                    <td className="r mono" style={{ color: unpaid > 0 ? 'var(--rust)' : 'var(--ink-3)', fontWeight: unpaid > 0 ? 600 : 400 }}>
                      {unpaid > 0 ? `฿${fmt(unpaid)}` : '—'}
                    </td>
                    <td>
                      {/* flex + wrapper div ขนาดตายตัว → gap เท่ากัน ปุ่มตรงกันทุก row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div style={{ width: 72, display: 'flex', justifyContent: 'center' }}>
                          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => openEdit(c)}>แก้ไข</button>
                        </div>
                        <div style={{ width: 72, display: 'flex', justifyContent: 'center' }}>
                          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => openHistory(c)}>ประวัติ</button>
                        </div>
                        <div style={{ width: 168, display: 'flex', justifyContent: 'center' }}>
                          {inv ? (
                            <button onClick={() => openInvoiceDetail(inv)} style={{
                              fontSize: 13, padding: '6px 0', whiteSpace: 'nowrap',
                              border: '1px solid rgba(37,99,175,0.4)', borderRadius: 999,
                              background: 'rgba(37,99,175,0.08)', color: '#2563af',
                              cursor: 'pointer', fontFamily: 'var(--f-mono)',
                              width: '100%', textAlign: 'center',
                            }}>
                              {inv.invoice_number} · รอชำระ
                            </button>
                          ) : unpaid > 0 ? (
                            <button className="btn btn-primary" onClick={() => openSelectBills(c)} style={{ fontSize: 13, width: '100%', justifyContent: 'center' }}>
                              สร้างใบวางบิล
                            </button>
                          ) : null}
                        </div>
                        <div style={{ width: 152, display: 'flex', justifyContent: 'center' }}>
                          {hasUnbilledExtra && (
                            <span style={{
                              fontSize: 12, padding: '6px 0', whiteSpace: 'nowrap',
                              border: '1px solid rgba(217,119,6,0.4)', borderRadius: 999,
                              background: 'rgba(217,119,6,0.08)', color: '#b45309',
                              width: '100%', textAlign: 'center', display: 'block',
                            }}>
                              นอกบิล {c.unbilledCount} รายการ
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

      <Footer />
    </main>
  );
}
