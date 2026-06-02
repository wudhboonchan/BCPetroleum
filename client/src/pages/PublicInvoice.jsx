import { useState, useEffect } from 'react';

const fmt = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });

const thaiDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function PublicInvoice() {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // ดึง invoiceId จาก URL path: /invoice/:id
    const id = window.location.pathname.split('/').pop();
    fetch(`/api/line/invoice/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.invoice) setInvoice(data.invoice);
        else setError(data.error || 'ไม่พบใบวางบิล');
      })
      .catch(() => setError('ไม่สามารถโหลดข้อมูลได้'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f0eb' }}>
      <div style={{ textAlign: 'center', color: '#666' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div>กำลังโหลด…</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f0eb' }}>
      <div style={{ textAlign: 'center', color: '#ef4444' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
        <div>{error}</div>
      </div>
    </div>
  );

  const isPaid = invoice.status === 'paid';
  const bills = invoice.bills || [];

  const Row = ({ label, value, highlight }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: highlight ? 600 : 400, color: highlight ? '#374151' : '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f5f0eb', padding: '24px 16px', fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#2D3E50', color: 'white', borderRadius: '12px 12px 0 0', padding: '20px 24px' }}>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>BC Petroleum</div>
          <div style={{ fontSize: 14, color: '#aabbcc', marginBottom: 2 }}>ใบวางบิล {invoice.invoice_number}</div>
          <div style={{ fontSize: 13, color: '#aabbcc' }}>วันที่ออก: {thaiDate(invoice.issue_date)}</div>
        </div>

        {/* Body */}
        <div style={{ background: 'white', padding: '20px 24px', borderRadius: '0 0 12px 12px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {/* Status */}
          <div style={{
            display: 'inline-block', padding: '4px 16px', borderRadius: 999, fontSize: 13, fontWeight: 600, marginBottom: 20,
            background: isPaid ? '#f0fdf4' : '#fffbeb',
            color: isPaid ? '#15803d' : '#b45309',
          }}>
            {isPaid ? '✅ ชำระแล้ว' : '⏳ ค้างชำระ'}
          </div>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: '#f8f9fa', borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>ลูกค้า</div>
              <div style={{ fontWeight: 600 }}>{invoice.customers?.name || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>จำนวนบิล</div>
              <div style={{ fontWeight: 600 }}>{bills.length} รายการ</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>ยอดรวมทั้งสิ้น</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: '#d97706' }}>฿{fmt(invoice.total_amount)}</div>
            </div>
          </div>

          {/* Bills List */}
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#374151' }}>รายการบิล</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {bills.map((b, i) => (
              <div key={i} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f3f4f6', padding: '8px 14px', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6b7280' }}>รายการที่ {i + 1}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#d97706' }}>฿{fmt(b.amount)}</span>
                </div>
                {/* Card Body */}
                <div style={{ padding: '10px 14px', background: 'white', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Row label="วันที่" value={b.date?.split('T')[0]} />
                    <Row label="เล่ม/เลขที่" value={`${b.bill_book}/${b.bill_number}`} />
                  </div>
                  {b.vehicle_number && <Row label="ทะเบียนรถ" value={b.vehicle_number} />}
                  {b.note && <Row label="หมายเหตุ" value={b.note} highlight />}
                </div>
              </div>
            ))}
          </div>
          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, padding: '14px 16px', background: '#fffbeb', borderRadius: 10, border: '1px solid #fde68a' }}>
            <span style={{ fontWeight: 600, color: '#92400e' }}>รวมทั้งสิ้น</span>
            <span style={{ fontWeight: 800, fontSize: 20, color: '#d97706' }}>฿{fmt(invoice.total_amount)}</span>
          </div>

          {/* Footer note */}
          <div style={{ marginTop: 20, fontSize: 12, color: '#999', textAlign: 'center' }}>
            หากมีข้อสงสัยกรุณาติดต่อ BC Petroleum
          </div>
        </div>
      </div>
    </div>
  );
}
