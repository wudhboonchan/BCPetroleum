import { useState, useEffect, useRef } from 'react';

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

  const isPrintMode = new URLSearchParams(window.location.search).get('print') === '1';

  useEffect(() => {
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

  // auto-print เมื่อโหลดเสร็จและอยู่ใน print mode
  useEffect(() => {
    if (isPrintMode && invoice) {
      setTimeout(() => window.print(), 500);
    }
  }, [isPrintMode, invoice]);

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

  const printStyle = `
    @media print {
      @page { size: A4; margin: 16mm 18mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .print-container { box-shadow: none !important; border-radius: 0 !important; }
    }
  `;

  const Row = ({ label, value, highlight }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: highlight ? 600 : 400, color: highlight ? '#374151' : '#4b5563', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: isPrintMode ? 'white' : '#f5f0eb', padding: isPrintMode ? '0' : '24px 16px', fontFamily: 'Sarabun, sans-serif' }}>
      <style>{printStyle}</style>
      <div style={{ maxWidth: 680, margin: '0 auto' }} className="print-container">

        {/* Header */}
        <div style={{ background: '#2D3E50', color: 'white', borderRadius: isPrintMode ? '0' : '12px 12px 0 0', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>BC Petroleum</div>
            <div style={{ fontSize: 13, color: '#aabbcc' }}>วันที่ออก: {thaiDate(invoice.issue_date)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: '#aabbcc', marginBottom: 2 }}>เลขที่ใบวางบิล</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{invoice.invoice_number}</div>
          </div>
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

          {/* Bills Table — ใช้ตารางทั้ง mobile และ print */}
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#374151' }}>รายการบิล</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#2D3E50', color: 'white' }}>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: '5%' }}>#</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', width: '18%' }}>วันที่</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: '16%' }}>เล่ม/เลขที่</th>
                <th style={{ padding: '9px 10px', textAlign: 'center', width: '16%' }}>ทะเบียน</th>
                <th style={{ padding: '9px 10px', textAlign: 'left' }}>หมายเหตุ</th>
                <th style={{ padding: '9px 10px', textAlign: 'right', width: '16%' }}>ยอด (฿)</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'white' : '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '9px 10px', textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                  <td style={{ padding: '9px 10px' }}>{b.date?.split('T')[0]}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>{b.bill_book}/{b.bill_number}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'center' }}>{b.vehicle_number || '—'}</td>
                  <td style={{ padding: '9px 10px', color: '#4b5563' }}>{b.note || '—'}</td>
                  <td style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600 }}>฿{fmt(b.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#2D3E50', color: 'white' }}>
                <td colSpan={5} style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 600 }}>รวมทั้งสิ้น</td>
                <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800, fontSize: 15 }}>฿{fmt(invoice.total_amount)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Footer */}
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#9ca3af' }}>
            <span>หากมีข้อสงสัยกรุณาติดต่อ BC Petroleum</span>
            {!isPrintMode && (
              <button className="no-print" onClick={() => window.print()}
                style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 14px', background: 'white', cursor: 'pointer', fontSize: 12, color: '#374151' }}>
                🖨 พิมพ์ / บันทึก PDF
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
