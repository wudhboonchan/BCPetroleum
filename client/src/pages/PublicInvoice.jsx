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

  return (
    <div style={{ minHeight: '100vh', background: '#f5f0eb', padding: '24px 16px', fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#2D3E50', color: 'white', borderRadius: '12px 12px 0 0', padding: '20px 24px' }}>
          <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>BC Petroleum</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>ใบวางบิล {invoice.invoice_number}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>วันที่ออก: {thaiDate(invoice.issue_date)}</div>
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
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>รายการบิล</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bills.map((b, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 14px', background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#999' }}>#{i + 1}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#d97706' }}>฿{fmt(b.amount)}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 13 }}>
                  <div><span style={{ color: '#888' }}>วันที่: </span>{b.date?.split('T')[0]}</div>
                  <div><span style={{ color: '#888' }}>เล่ม/เลขที่: </span>{b.bill_book}/{b.bill_number}</div>
                  <div><span style={{ color: '#888' }}>ทะเบียน: </span>{b.vehicle_number || '—'}</div>
                  {b.note && <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#888' }}>หมายเหตุ: </span>{b.note}</div>}
                </div>
              </div>
            ))}
          </div>
          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, padding: '12px 14px', background: '#f8f9fa', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <span style={{ fontWeight: 600 }}>รวมทั้งสิ้น</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#d97706' }}>฿{fmt(invoice.total_amount)}</span>
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
