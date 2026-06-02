import { useState, useEffect } from 'react';

const fmt = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });
const fmtShort = (n) => Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2 });

const thaiDate = (str) => {
  if (!str) return '—';
  const d = new Date(str);
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
};

const C = {
  bg: '#f5f0eb',
  surface: '#faf7f4',
  card: '#ffffff',
  border: '#e2d9cf',
  ink1: '#1a1410',
  ink2: '#4a3f35',
  ink3: '#9c8c7e',
  rust: '#b5451b',
  green: '#2d6a4f',
  mono: "'JetBrains Mono', 'Courier New', monospace",
  body: "'Sarabun', 'IBM Plex Sans Thai', sans-serif",
};

const printStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; background: ${C.bg}; font-family: ${C.body}; color: ${C.ink1}; }
  @media print {
    @page { size: A4; margin: 14mm 16mm; }
    body { background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
    .page { padding: 0 !important; background: white !important; }
    .card { box-shadow: none !important; }
  }
`;

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

  useEffect(() => {
    if (isPrintMode && invoice) setTimeout(() => window.print(), 600);
  }, [isPrintMode, invoice]);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: C.bg, fontFamily: C.body }}>
      <div style={{ color: C.ink3, fontSize: 14 }}>กำลังโหลด…</div>
    </div>
  );

  if (error) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: C.bg, fontFamily: C.body }}>
      <div style={{ textAlign: 'center', color: C.rust }}><div style={{ fontSize: 32, marginBottom: 8 }}>✕</div><div>{error}</div></div>
    </div>
  );

  const isPaid = invoice.status === 'paid';
  const bills = invoice.bills || [];

  return (
    <div className="page" style={{ minHeight: '100vh', background: C.bg, padding: isPrintMode ? 0 : '32px 16px', fontFamily: C.body }}>
      <style>{printStyle}</style>
      <div className="card" style={{ maxWidth: 740, margin: '0 auto', background: C.card, borderRadius: isPrintMode ? 0 : 4, boxShadow: isPrintMode ? 'none' : '0 2px 16px rgba(0,0,0,0.08)', overflow: 'hidden', border: `1px solid ${C.border}` }}>

        {/* ── TOP BAR ── */}
        <div style={{ background: C.bg, borderBottom: `1px solid ${C.border}`, padding: '18px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo.png" alt="" style={{ height: 40, width: 40, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.ink1, letterSpacing: 0.3 }}>BC Petroleum</div>
              <div style={{ fontSize: 11, color: C.ink3, marginTop: 1, letterSpacing: 1, textTransform: 'uppercase' }}>ใบวางบิล · Invoice</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.ink3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>Invoice No.</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: C.mono, color: C.ink1 }}>{invoice.invoice_number}</div>
          </div>
        </div>

        {/* ── META ── */}
        <div style={{ padding: '20px 32px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: C.ink3, marginBottom: 4, letterSpacing: 0.5 }}>ลูกค้า · BILL TO</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.ink1 }}>{invoice.customers?.name || '—'}</div>
            <div style={{ fontSize: 12, color: C.ink3, marginTop: 4 }}>
              วันที่ออก {thaiDate(invoice.issue_date)} · {bills.length} รายการ
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.ink3, marginBottom: 4, letterSpacing: 0.5 }}>สถานะ</div>
            <div style={{
              display: 'inline-block', padding: '4px 14px', borderRadius: 2, fontSize: 12, fontWeight: 600, letterSpacing: 0.5,
              background: isPaid ? 'rgba(45,106,79,0.1)' : 'rgba(181,69,27,0.1)',
              color: isPaid ? C.green : C.rust,
              border: `1px solid ${isPaid ? 'rgba(45,106,79,0.25)' : 'rgba(181,69,27,0.25)'}`,
            }}>
              {isPaid ? 'ชำระแล้ว' : 'ค้างชำระ'}
            </div>
          </div>
        </div>

        {/* ── TABLE ── */}
        <div style={{ padding: '24px 32px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.ink1}` }}>
                {[
                  { label: '#', w: '5%', align: 'center' },
                  { label: 'วันที่', w: '17%', align: 'left' },
                  { label: 'เล่ม / เลขที่', w: '16%', align: 'center' },
                  { label: 'ทะเบียนรถ', w: '16%', align: 'center' },
                  { label: 'หมายเหตุ', w: 'auto', align: 'left' },
                  { label: 'ยอดเงิน', w: '16%', align: 'right' },
                ].map((h, i) => (
                  <th key={i} style={{ padding: '8px 6px', textAlign: h.align, width: h.w, fontWeight: 600, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: C.ink2 }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bills.map((b, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '11px 6px', textAlign: 'center', color: C.ink3, fontSize: 11, fontFamily: C.mono }}>{i + 1}</td>
                  <td style={{ padding: '11px 6px', fontFamily: C.mono, fontSize: 12 }}>{b.date?.split('T')[0]}</td>
                  <td style={{ padding: '11px 6px', textAlign: 'center', fontFamily: C.mono, fontSize: 12 }}>{b.bill_book}/{b.bill_number}</td>
                  <td style={{ padding: '11px 6px', textAlign: 'center', fontFamily: C.mono, fontSize: 12 }}>{b.vehicle_number || '—'}</td>
                  <td style={{ padding: '11px 6px', color: C.ink2 }}>{b.note || <span style={{ color: C.ink3 }}>—</span>}</td>
                  <td style={{ padding: '11px 6px', textAlign: 'right', fontFamily: C.mono, fontWeight: 500 }}>{fmtShort(b.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* ── TOTAL ── */}
          <div style={{ borderTop: `2px solid ${C.ink1}`, marginTop: 0, paddingTop: 14, display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: 32 }}>
            <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: C.ink3, fontWeight: 600 }}>รวมทั้งสิ้น · Total</span>
            <div>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: C.mono, color: C.rust }}>
                {fmt(invoice.total_amount).split('.')[0]}
              </span>
              <span style={{ fontSize: 16, fontFamily: C.mono, color: C.rust }}>.{fmt(invoice.total_amount).split('.')[1]}</span>
              <span style={{ fontSize: 13, color: C.ink3, marginLeft: 6 }}>บาท</span>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ background: C.bg, borderTop: `1px solid ${C.border}`, padding: '14px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: C.ink3 }}>หากมีข้อสงสัยกรุณาติดต่อ BC Petroleum</div>
          <button className="no-print" onClick={() => window.print()}
            style={{ border: `1px solid ${C.border}`, borderRadius: 3, padding: '6px 16px', background: 'white', cursor: 'pointer', fontSize: 12, color: C.ink2, fontFamily: C.body, fontWeight: 500 }}>
            บันทึก PDF
          </button>
        </div>

      </div>
    </div>
  );
}
