import Footer from '../components/Footer.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import { fmt, THAI_MONTHS, FUEL_COLORS as FC, FUEL_NAMES } from '../lib/utils.js';

Chart.register(...registerables, ChartDataLabels);

const TABS = [
  { id: 'sales', label: 'ยอดขาย & กำไร' },
  { id: 'fuel', label: 'วิเคราะห์น้ำมัน' },
  { id: 'price', label: 'ราคาน้ำมัน' },
  { id: 'credit', label: 'รายงานลูกหนี้' },
  { id: 'invoice', label: 'ใบวางบิล' },
];

const FUEL_OPTS = [
  { value: 'all', label: 'น้ำมันทุกชนิด' },
  { value: 'e91', label: 'แก๊สโซฮอล์ 91' },
  { value: 'e95', label: 'แก๊สโซฮอล์ 95' },
  { value: 'b7', label: 'ดีเซล B7' },
];

const FUEL_COLORS = {
  b7: 'rgba(68, 98, 155, 0.88)',
  e91: 'rgba(174, 60, 48, 0.88)',
  e95: 'rgba(58, 120, 72, 0.88)',
};

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function fmtDate(str) {
  if (!str) return '—';
  const d = new Date(str);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function MetricItem({ label, value, sub, bordered, accent, dotColor }) {
  return (
    <div className={`metric-item${bordered ? ' bordered' : ''}`}
      style={accent ? { background: 'oklch(0.91 0.012 72)', margin: '-20px 0', padding: '20px 24px' } : undefined}>
      {dotColor && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: dotColor, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--ink-3)', letterSpacing: '0.01em' }}>{label}</span>
        </div>
      )}
      {!dotColor && <div className="metric-label">{label}</div>}
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}


function BarChart({ data, labels, datasets, yUnit = '฿', showLabels = true, stacked = false, xLabelSize = 10, xMaxRotation = 0, xAutoSkip = true }) {
  const ref = useRef(null);
  const chart = useRef(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [fontTrigger, setFontTrigger] = useState(0);

  useEffect(() => {
    if (!document.fonts) {
      setFontsReady(true);
      return;
    }

    let active = true;
    const timeoutId = setTimeout(() => {
      if (active) setFontsReady(true);
    }, 400); // 400ms max wait for fonts

    document.fonts.ready.then(() => {
      if (active) {
        clearTimeout(timeoutId);
        setFontsReady(true);
      }
    });

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!fontsReady || !ref.current || !data?.length) return;

    let chartInstance = null;

    const initChart = () => {
      if (!ref.current) return;

      // Safari Thai Centering Workaround: override ctx.measureText and text rendering on the 2D context directly before Chart instantiation
      const ctx = ref.current.getContext('2d');
      if (ctx) {
        const originalMeasureText = ctx.measureText;
        const originalFillText = ctx.fillText;
        const originalStrokeText = ctx.strokeText;

        let measureSpan = document.getElementById('chart-measure-span');
        if (!measureSpan) {
          measureSpan = document.createElement('span');
          measureSpan.id = 'chart-measure-span';
          measureSpan.style.position = 'absolute';
          measureSpan.style.visibility = 'hidden';
          measureSpan.style.whiteSpace = 'nowrap';
          measureSpan.style.top = '-9999px';
          document.body.appendChild(measureSpan);
        }

        const getThaiSafariWidth = (text, font) => {
          if (!text) return null;
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          const hasThai = /[\u0e00-\u0e7f]/.test(text);
          if (isSafari && hasThai) {
            measureSpan.style.font = font;
            measureSpan.textContent = text;
            return measureSpan.getBoundingClientRect().width;
          }
          return null;
        };

        ctx.measureText = function(text) {
          const w = getThaiSafariWidth(text, ctx.font);
          if (w !== null) {
            return { width: w, actualBoundingBoxLeft: 0, actualBoundingBoxRight: w };
          }
          return originalMeasureText.call(ctx, text);
        };

        ctx.fillText = function(text, x, y, maxWidth) {
          const w = getThaiSafariWidth(text, ctx.font);
          if (w !== null) {
            const oldAlign = ctx.textAlign;
            let targetX = x;
            if (oldAlign === 'center') {
              targetX = x - w / 2;
            } else if (oldAlign === 'right') {
              targetX = x - w;
            }
            ctx.textAlign = 'left';
            originalFillText.call(ctx, text, targetX, y, maxWidth);
            ctx.textAlign = oldAlign;
          } else {
            originalFillText.call(ctx, text, x, y, maxWidth);
          }
        };

        ctx.strokeText = function(text, x, y, maxWidth) {
          const w = getThaiSafariWidth(text, ctx.font);
          if (w !== null) {
            const oldAlign = ctx.textAlign;
            let targetX = x;
            if (oldAlign === 'center') {
              targetX = x - w / 2;
            } else if (oldAlign === 'right') {
              targetX = x - w;
            }
            ctx.textAlign = 'left';
            originalStrokeText.call(ctx, text, targetX, y, maxWidth);
            ctx.textAlign = oldAlign;
          } else {
            originalStrokeText.call(ctx, text, x, y, maxWidth);
          }
        };
      }

      const styledDatasets = datasets.map(ds => ({
        borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        ...ds,
      }));

      chartInstance = new Chart(ref.current, {
        type: 'bar',
        data: { labels, datasets: styledDatasets },
        plugins: [{
          id: 'forceCenterTicks',
          beforeDraw(chart) {
            const xScale = chart.scales.x;
            if (xScale && typeof xScale.getLabelItems === 'function') {
              const items = xScale.getLabelItems();
              for (let i = 0; i < items.length; i++) {
                if (items[i] && items[i].options) {
                  items[i].options.textAlign = 'center';
                }
              }
            }
          }
        }],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          clip: false,
          plugins: {
            legend: {
              display: datasets.length > 1,
              position: 'top',
              labels: {
                font: { family: "'Bai Jamjuree', system-ui", size: 12 },
                padding: 16,
                usePointStyle: true,
                pointStyle: 'rectRounded'
              },
            },
            datalabels: {
              display: showLabels,
              anchor: 'end',
              align: 'end',
              offset: 2,
              formatter: v => v > 0 ? (yUnit + fmt(v)) : '',
              font: { family: "ui-monospace, monospace", size: 10 },
              color: '#666050',
            },
            tooltip: {
              backgroundColor: '#faf9f5',
              titleColor: '#2a2520',
              bodyColor: '#7a7060',
              borderColor: '#e8e4d8',
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: ctx => `${ctx.dataset.label || ''}: ${yUnit}${fmt(ctx.parsed.y)}`,
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              stacked,
              grid: { color: '#e8e4d8' },
              ticks: {
                font: { family: "ui-monospace, monospace", size: 11 },
                color: '#9a9080',
                padding: 12,
                crossAlign: 'near',
                callback: v => {
                  if (v === undefined || v === null) return '';
                  if (v === 0) return '0';
                  return v.toLocaleString('en-US');
                },
              },
            },
            x: {
              stacked,
              grid: { display: false },
              ticks: {
                font: { family: "'Bai Jamjuree', system-ui", size: xLabelSize },
                color: '#7a7060',
                minRotation: 0,
                maxRotation: xMaxRotation,
                autoSkip: xAutoSkip,
                align: 'center',
              },
            },
          },
          layout: { padding: { top: 24, left: 16, right: 16, bottom: 8 } },
        },
      });

      chart.current = chartInstance;
    };

    // Use requestAnimationFrame to let Safari calculate container layout first
    const animId = requestAnimationFrame(() => {
      initChart();
    });

    const handleFontsLoaded = () => {
      setFontTrigger(prev => prev + 1);
    };

    if (document.fonts) {
      document.fonts.addEventListener('loadingdone', handleFontsLoaded);
    }

    return () => {
      cancelAnimationFrame(animId);
      if (chartInstance) {
        chartInstance.destroy();
      }
      if (chart.current) {
        chart.current.destroy();
      }
      if (document.fonts) {
        document.fonts.removeEventListener('loadingdone', handleFontsLoaded);
      }
    };
  }, [fontsReady, fontTrigger, data, labels, datasets]);

  if (!data?.length) return null;
  // Use a unique key on the canvas element to force a clean backing store recreation on Safari
  return <canvas ref={ref} key={`${labels.join(',')}_${datasets.length}_${fontTrigger}`} />;
}

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [fuelType, setFuelType] = useState('all');
  const [customerId, setCustomerId] = useState('all');
  const [paidFilter, setPaidFilter] = useState('all');
  const [invoiceStatus, setInvoiceStatus] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const dayCount = Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1;
  const showBarLabels = dayCount <= 15;

  const openInvoiceModal = async (inv) => {
    setSelectedInvoice(inv);
    setInvoiceDetail(null);
    try {
      const res = await api.get(`/api/invoices/${inv.id}`);
      setInvoiceDetail(res);
    } catch { toast.error('โหลดข้อมูลใบวางบิลไม่ได้'); }
  };
  const closeInvoiceModal = () => { setSelectedInvoice(null); setInvoiceDetail(null); };

  useEffect(() => {
    api.get('/api/customer').then(r => setCustomers(Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : [])).catch(() => { });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let res;
      if (tab === 'sales') {
        res = await api.get('/api/report/profit-loss', { startDate, endDate });
      } else if (tab === 'fuel') {
        res = await api.get('/api/report/sales', { startDate, endDate, fuelType });
      } else if (tab === 'credit') {
        res = await api.get('/api/report/credit', {
          startDate, endDate,
          ...(customerId !== 'all' && { customerId }),
          ...(paidFilter !== 'all' && { paid: paidFilter }),
        });
      } else if (tab === 'price') {
        res = await api.get('/api/report/investment', { startDate, endDate });
      } else if (tab === 'invoice') {
        const params = {};
        if (customerId !== 'all') params.customer_id = customerId;
        if (invoiceStatus !== 'all') params.status = invoiceStatus;
        res = await api.get('/api/invoices', params);
      }
      setData(res);
    } catch { toast.error('โหลดรายงานไม่ได้'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, startDate, endDate, fuelType, customerId, paidFilter, invoiceStatus]);

  /* ---------- invoice rows (date-filtered) ---------- */
  const invoiceRows = (() => {
    if (tab !== 'invoice') return [];
    return (data?.invoices || []).filter(inv => {
      const d = (inv.issue_date || '').split('T')[0];
      return d >= startDate && d <= endDate;
    }).sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''));
  })();

  const rows = tab === 'invoice' ? [] : (data?.data || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const summary = data?.summary || {};

  /* ---------- build chart datasets ---------- */
  const chartLabels = rows.map(r => {
    const d = new Date(r.date);
    return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
  });

  let chartDatasets = [];
  let chartYUnit = '฿';

  if (tab === 'sales') {
    chartDatasets = [
      { label: 'ยอดขาย', data: rows.map(r => parseFloat(r.total_sales) || 0), backgroundColor: 'rgba(100, 80, 140, 0.80)' },
      { label: 'กำไร', data: rows.map(r => parseFloat(r.total_profit) || 0), backgroundColor: 'rgba(180, 140, 60, 0.85)' },
    ];
  } else if (tab === 'fuel') {
    if (fuelType === 'all') {
      chartDatasets = [
        { label: 'B7', data: rows.map(r => parseFloat(r.b7_liters) || 0), backgroundColor: FUEL_COLORS.b7 },
        { label: 'E91', data: rows.map(r => parseFloat(r.e91_liters) || 0), backgroundColor: FUEL_COLORS.e91 },
        { label: 'E95', data: rows.map(r => parseFloat(r.e95_liters) || 0), backgroundColor: FUEL_COLORS.e95 },
      ];
      chartYUnit = '';
    } else {
      chartDatasets = [
        { label: `${fuelType.toUpperCase()} (ลิตร)`, data: rows.map(r => parseFloat(r[`${fuelType}_liters`] || r.liters) || 0), backgroundColor: FUEL_COLORS[fuelType] },
      ];
      chartYUnit = '';
    }
  }

  /* ---------- invoice summary + chart ---------- */
  const invoiceSummary = (() => {
    if (tab !== 'invoice') return {};
    const total = invoiceRows.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    const paid = invoiceRows.filter(i => i.status === 'paid').reduce((s, i) => s + parseFloat(i.total_amount || 0), 0);
    const unpaid = invoiceRows.filter(i => i.status === 'active').reduce((s, i) => s + parseFloat(i.remaining_amount || 0), 0);
    return { total, paid, unpaid, count: invoiceRows.length, paidCount: invoiceRows.filter(i => i.status === 'paid').length, activeCount: invoiceRows.filter(i => i.status === 'active').length };
  })();

  const invoiceChartData = (() => {
    if (tab !== 'invoice' || !invoiceRows.length) return null;
    const map = {};
    invoiceRows.forEach(inv => {
      const name = inv.customers?.name || 'ไม่ระบุ';
      const short = name.length > 18 ? name.substring(0, 18) + '…' : name;
      if (!map[short]) map[short] = { paid: 0, unpaid: 0 };
      if (inv.status === 'paid') map[short].paid += parseFloat(inv.total_amount || 0);
      else map[short].unpaid += parseFloat(inv.remaining_amount || 0);
    });
    const labels = Object.keys(map);
    const paidArr = labels.map(k => map[k].paid);
    const unpaidArr = labels.map(k => map[k].unpaid);
    return {
      labels,
      datasets: [
        {
          label: 'ค้างชำระ',
          data: unpaidArr,
          backgroundColor: 'rgba(97, 3, 53, 0.7)',
          borderRadius: paidArr.map(p => p > 0 ? 0 : { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }),
          borderSkipped: false,
          stack: 'inv',
        },
        {
          label: 'ชำระแล้ว',
          data: paidArr,
          backgroundColor: 'rgba(2, 88, 16, 0.75)',
          borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
          borderSkipped: false,
          stack: 'inv',
        },
      ],
    };
  })();

  /* ---------- credit stacked bar by date ---------- */
  const creditByDate = (() => {
    if (tab !== 'credit' || !rows.length) return null;
    const map = {};
    rows.forEach(r => {
      const d = new Date(r.date);
      const key = r.date;
      const label = `${d.getDate()} ${THAI_MONTHS[d.getMonth()]}`;
      if (!map[key]) map[key] = { label, paid: 0, unpaid: 0 };
      const amt = parseFloat(r.amount) || 0;
      if (r.paid) map[key].paid += amt;
      else map[key].unpaid += amt;
    });
    const sorted = Object.keys(map).sort();
    return {
      labels: sorted.map(k => map[k].label),
      paidData: sorted.map(k => map[k].paid),
      unpaidData: sorted.map(k => map[k].unpaid),
    };
  })();

  const creditChartDatasets = creditByDate ? [
    {
      label: 'ค้างชำระ',
      data: creditByDate.unpaidData,
      backgroundColor: 'rgba(97, 3, 53, 0.7)',
      borderRadius: creditByDate.paidData.map(p => p > 0 ? 0 : { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 }),
      borderSkipped: false,
      stack: 'credit',
    },
    {
      label: 'ชำระแล้ว',
      data: creditByDate.paidData,
      backgroundColor: 'rgba(2, 88, 16, 0.75)',
      borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 },
      borderSkipped: false,
      stack: 'credit',
    },
  ] : [];

  /* ---------- print ---------- */
  const handlePrint = () => window.print();

  return (
    <main className="main-container">
      {loading && <Loading />}

      <div className="page-header">
        <div>
          <div className="page-eyebrow">รายงาน · Reports</div>
          <h1 className="page-title">รายงาน</h1>
        </div>
      </div>

      {/* TABS + CONTROLS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line-soft)', marginBottom: 32, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map(t => (
            <button key={t.id}
              className={`nav-link${tab === t.id ? ' active' : ''}`}
              style={{ borderRadius: 0, borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent', paddingBottom: 10 }}
              onClick={() => setTab(t.id)}
            >{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 8, flexWrap: 'wrap' }}>
          {tab === 'fuel' && (
            <select className="form-input" style={{ width: 150, fontSize: 14, padding: '10px 12px' }}
              value={fuelType} onChange={e => setFuelType(e.target.value)}>
              {FUEL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {tab === 'credit' && (
            <>
              <select className="form-input" style={{ width: 'auto', fontSize: 14, padding: '10px 28px 10px 12px' }}
                value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="all">ลูกค้าทุกราย</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto', fontSize: 14, padding: '10px 28px 10px 12px' }}
                value={paidFilter} onChange={e => setPaidFilter(e.target.value)}>
                <option value="all">ทุกสถานะ</option>
                <option value="false">ค้างชำระ</option>
                <option value="true">ชำระแล้ว</option>
              </select>
            </>
          )}
          {tab === 'invoice' && (
            <>
              <select className="form-input" style={{ width: 'auto', fontSize: 14, padding: '10px 28px 10px 12px' }}
                value={customerId} onChange={e => setCustomerId(e.target.value)}>
                <option value="all">ลูกค้าทุกราย</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className="form-input" style={{ width: 'auto', fontSize: 14, padding: '10px 28px 10px 12px' }}
                value={invoiceStatus} onChange={e => setInvoiceStatus(e.target.value)}>
                <option value="all">ทุกสถานะ</option>
                <option value="active">ค้างชำระ</option>
                <option value="paid">ชำระแล้ว</option>
              </select>
            </>
          )}
          <DatePicker value={startDate} onChange={v => setStartDate(v)} style={{ width: 130 }} />
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>—</span>
          <DatePicker value={endDate} onChange={v => setEndDate(v)} style={{ width: 130 }} align="right" />
          <button className="btn" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
            </svg>
            พิมพ์
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      {tab === 'sales' && rows.length > 0 && (
        <section className="metrics-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'stretch' }}>
          <MetricItem accent label="ยอดขายรวม" value={`฿${fmt(summary.totalSales)}`} />
          <MetricItem bordered label="กำไรสุทธิ" value={`฿${fmt(summary.totalProfit)}`} sub={`อัตรากำไร ${(summary.profitMargin || 0).toFixed(1)}%`} />
          <MetricItem bordered label="ปริมาณขาย" value={`${fmt(summary.totalLiters, 1)} ล.`} />
          <MetricItem bordered label="จำนวนวัน" value={`${summary.recordCount || 0} วัน`} />
        </section>
      )}

      {tab === 'fuel' && rows.length > 0 && (() => {
        if (fuelType === 'all') {
          const totalB7 = rows.reduce((s, r) => s + parseFloat(r.b7_liters || 0), 0);
          const totalE91 = rows.reduce((s, r) => s + parseFloat(r.e91_liters || 0), 0);
          const totalE95 = rows.reduce((s, r) => s + parseFloat(r.e95_liters || 0), 0);
          const totalAll = totalB7 + totalE91 + totalE95;
          return (
            <section className="metrics-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'stretch' }}>
              <MetricItem accent label="รวมทุกชนิด" value={`${fmt(totalAll, 1)} ล.`} />
              <MetricItem bordered label="ดีเซล B7" value={`${fmt(totalB7, 1)} ล.`} />
              <MetricItem bordered label="แก๊สโซฮอล์ 91" value={`${fmt(totalE91, 1)} ล.`} />
              <MetricItem bordered label="แก๊สโซฮอล์ 95" value={`${fmt(totalE95, 1)} ล.`} />
            </section>
          );
        } else {
          const fuelLabel = fuelType === 'b7' ? 'ดีเซล B7' : fuelType === 'e91' ? 'แก๊สโซฮอล์ 91' : 'แก๊สโซฮอล์ 95';
          const total = rows.reduce((s, r) => s + parseFloat(r.liters || 0), 0);
          const avg = rows.length > 0 ? total / rows.length : 0;
          const max = rows.reduce((m, r) => Math.max(m, parseFloat(r.liters || 0)), 0);
          return (
            <section className="metrics-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'stretch' }}>
              <MetricItem accent label={fuelLabel} value={`${fmt(total, 1)} ล.`} />
              <MetricItem bordered label="เฉลี่ย/วัน" value={`${fmt(avg, 1)} ล.`} />
              <MetricItem bordered label="สูงสุด/วัน" value={`${fmt(max, 1)} ล.`} />
              <MetricItem bordered label="จำนวนวัน" value={`${rows.length} วัน`} />
            </section>
          );
        }
      })()}

      {tab === 'credit' && rows.length > 0 && (
        <section className="metrics-strip" style={{ alignItems: 'stretch' }}>
          <MetricItem accent label="ยอดรวม" value={`฿${fmt(summary.totalAmount)}`} sub={`${summary.totalBills} บิล`} />
          <MetricItem bordered label="ค้างชำระ" value={`฿${fmt(summary.unpaidAmount)}`} sub={`${summary.unpaidBills} บิล`} />
          <MetricItem bordered label="ชำระแล้ว" value={`฿${fmt(summary.paidAmount)}`} sub={`${summary.paidBills} บิล`} />
        </section>
      )}

      {tab === 'price' && rows.length > 0 && rows[0] && (
        <section className="metrics-strip" style={{ alignItems: 'stretch' }}>
          <MetricItem dotColor={FC.B7} label="ดีเซล B7 ล่าสุด" value={`฿${rows[0].b7_sell_price}`} sub={`ต้นทุน ฿${rows[0].b7_cost_price}`} />
          <MetricItem dotColor={FC.E91} label="แก๊สโซฮอล์ 91 ล่าสุด" value={`฿${rows[0].e91_sell_price}`} sub={`ต้นทุน ฿${rows[0].e91_cost_price}`} bordered />
          <MetricItem dotColor={FC.E95} label="แก๊สโซฮอล์ 95 ล่าสุด" value={`฿${rows[0].e95_sell_price}`} sub={`ต้นทุน ฿${rows[0].e95_cost_price}`} bordered />
        </section>
      )}

      {tab === 'invoice' && invoiceRows.length > 0 && (
        <section className="metrics-strip" style={{ gridTemplateColumns: 'repeat(4, 1fr)', alignItems: 'stretch' }}>
          <MetricItem accent label="จำนวนใบวางบิลทั้งหมด" value={`${invoiceSummary.count} ใบ`} />
          <MetricItem bordered label="ยอดรวม" value={`฿${fmt(invoiceSummary.total)}`} />
          <MetricItem bordered label="ชำระแล้ว" value={`฿${fmt(invoiceSummary.paid)}`} sub={`${invoiceSummary.paidCount} ใบ`} />
          <MetricItem bordered label="ค้างชำระ" value={`฿${fmt(invoiceSummary.unpaid)}`} sub={`${invoiceSummary.activeCount} ใบ`} />
        </section>
      )}

      {/* FUEL TYPE BREAKDOWN (sales tab only) */}
      {tab === 'sales' && rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '1px solid var(--line-soft)', borderBottom: '1px solid var(--line-soft)', padding: '20px 0', marginBottom: 36 }}>
          {[['b7', 'B7'], ['e91', 'E91'], ['e95', 'E95']].map(([ft, key], i) => (
            <div key={ft} style={{ padding: '0 24px', borderLeft: i > 0 ? '1px solid var(--line-soft)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: FC[key], flexShrink: 0 }} />
                <span style={{ fontSize: 20, color: 'var(--ink)', fontWeight: 300, letterSpacing: '-0.01em' }}>{FUEL_NAMES[key]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[['ยอดขาย', `฿${fmt(summary[ft]?.sales)}`], ['กำไร', `฿${fmt(summary[ft]?.profit)}`], ['ปริมาณ', `${fmt(summary[ft]?.liters, 1)} ล.`]].map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
                    <span style={{ color: 'var(--ink-3)' }}>{l}</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHART */}
      {rows.length > 0 && tab !== 'price' && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="card-header">
            <span className="card-title">
              {tab === 'sales' ? 'ยอดขาย & กำไรรายวัน (บาท)' : tab === 'fuel' ? 'ปริมาณน้ำมันรายวัน (ลิตร)' : 'ยอดเงินเชื่อรายวัน (บาท)'}
            </span>
          </div>
          <div className="chart-canvas-wrap" style={{ height: 280 }}>
            {tab === 'credit'
              ? <BarChart data={rows} labels={creditByDate?.labels || []} datasets={creditChartDatasets} yUnit="฿" showLabels={false} stacked />
              : <BarChart data={rows} labels={chartLabels} datasets={chartDatasets} yUnit={chartYUnit} showLabels={showBarLabels} />
            }
          </div>
        </div>
      )}

      {/* INVOICE CHART */}
      {tab === 'invoice' && invoiceChartData && (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="card-header">
            <span className="card-title">ยอดใบวางบิลแยกตามลูกค้า (บาท)</span>
          </div>
          <div className="chart-canvas-wrap" style={{ height: 280 }}>
            <BarChart data={invoiceRows} labels={invoiceChartData.labels} datasets={invoiceChartData.datasets} yUnit="฿" showLabels={false} stacked xLabelSize={12} xMaxRotation={0} xAutoSkip={false} />
          </div>
        </div>
      )}

      {/* INVOICE TABLE */}
      {tab === 'invoice' && invoiceRows.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">รายละเอียดใบวางบิล</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtDate(startDate)} — {fmtDate(endDate)}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ใบวางบิล</th>
                  <th>ลูกค้า</th>
                  <th>วันที่ออก</th>
                  <th className="r">ยอดรวม (฿)</th>
                  <th className="r">ค้างชำระ (฿)</th>
                  <th style={{ paddingLeft: 32 }}>สถานะ</th>
                  <th>วิธีชำระ</th>
                  <th>วันที่ชำระ</th>
                </tr>
              </thead>
              <tbody>
                {invoiceRows.map((inv, i) => {
                  const remaining = parseFloat(inv.remaining_amount || 0);
                  const total = parseFloat(inv.total_amount || 0);
                  const isPaid = inv.status === 'paid';
                  const payMethod = inv.payment_method === 'cash' ? 'เงินสด' : inv.payment_method === 'transfer' ? 'โอนเงิน' : '—';
                  return (
                    <tr key={i} style={{ cursor: 'pointer' }} onClick={() => openInvoiceModal(inv)}>
                      <td style={{ fontWeight: 600, fontSize: 13 }}>{inv.invoice_number}</td>
                      <td>{inv.customers?.name || '—'}</td>
                      <td style={{ fontSize: 13 }}>{fmtDate(inv.issue_date)}</td>
                      <td className="r">฿{fmt(total)}</td>
                      <td className="r" style={{ color: remaining > 0 ? '#c0392b' : '#27ae60' }}>
                        ฿{fmt(isPaid ? 0 : remaining)}
                      </td>
                      <td style={{ paddingLeft: 32 }}><span className={`tag ${isPaid ? 'sage' : 'amber'}`}>{isPaid ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{isPaid ? payMethod : '—'}</td>
                      <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{inv.paid_date ? fmtDate(inv.paid_date) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
              {invoiceRows.length > 1 && (
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line-soft)' }}>
                    <td>รวม {invoiceRows.length} ใบ</td>
                    <td></td><td></td>
                    <td className="r">฿{fmt(invoiceSummary.total)}</td>
                    <td className="r" style={{ color: 'oklch(0.500 0.140 25)' }}>฿{fmt(invoiceSummary.unpaid)}</td>
                    <td></td><td></td><td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* TABLE */}
      {rows.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">รายละเอียด</span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{fmtDate(startDate)} — {fmtDate(endDate)}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table" style={{ tableLayout: 'fixed', width: '100%' }}>
              {tab === 'credit' && (
                <colgroup>
                  <col style={{ width: '13%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '18%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
              )}
              <thead>
                <tr>
                  <th>วันที่</th>
                  {tab === 'sales' && <><th className="r">ยอดขาย (฿)</th><th className="r">กำไร (฿)</th><th className="r">ปริมาณ (ล.)</th><th className="r">อัตรากำไร</th></>}
                  {tab === 'fuel' && fuelType === 'all' && <><th className="r">B7 (ล.)</th><th className="r">E91 (ล.)</th><th className="r">E95 (ล.)</th><th className="r">รวม (ล.)</th></>}
                  {tab === 'fuel' && fuelType !== 'all' && <><th className="r">ปริมาณ (ล.)</th><th className="r">ยอดขาย (฿)</th><th className="r">กำไร (฿)</th></>}
                  {tab === 'credit' && <><th>ลูกค้า</th><th className="r">ยอด (฿)</th><th style={{ paddingLeft: 48 }}>สถานะ</th><th>หมายเหตุ</th><th>เลขบิล</th></>}
                  {tab === 'price' && <><th className="r">B7 ซื้อ</th><th className="r">B7 ขาย</th><th className="r">E91 ซื้อ</th><th className="r">E91 ขาย</th><th className="r">E95 ซื้อ</th><th className="r">E95 ขาย</th></>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const totalLiters = parseFloat(row.b7_liters || 0) + parseFloat(row.e91_liters || 0) + parseFloat(row.e95_liters || 0);
                  const margin = row.total_sales > 0 ? (row.total_profit / row.total_sales * 100) : 0;
                  return (
                    <tr key={i}>
                      <td className="" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDate(row.date)}</td>
                      {tab === 'sales' && (
                        <>
                          <td className="r">฿{fmt(row.total_sales)}</td>
                          <td className="r" style={{ color: 'oklch(0.500 0.140 150)' }}>฿{fmt(row.total_profit)}</td>
                          <td className="r">{parseFloat(row.total_liters || 0).toFixed(3)}</td>
                          <td className="r" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{margin.toFixed(1)}%</td>
                        </>
                      )}
                      {tab === 'fuel' && fuelType === 'all' && (
                        <>
                          <td className="r">{parseFloat(row.b7_liters || 0).toFixed(3)}</td>
                          <td className="r">{parseFloat(row.e91_liters || 0).toFixed(3)}</td>
                          <td className="r">{parseFloat(row.e95_liters || 0).toFixed(3)}</td>
                          <td className="r" style={{ fontWeight: 600 }}>{totalLiters.toFixed(3)}</td>
                        </>
                      )}
                      {tab === 'fuel' && fuelType !== 'all' && (
                        <>
                          <td className="r">{parseFloat(row[`${fuelType}_liters`] || row.liters || 0).toFixed(3)}</td>
                          <td className="r">฿{fmt(row[`${fuelType}_sales`] || row.sales)}</td>
                          <td className="r" style={{ color: 'oklch(0.500 0.140 150)' }}>฿{fmt(row[`${fuelType}_profit`] || row.profit)}</td>
                        </>
                      )}
                      {tab === 'credit' && (
                        <>
                          <td>{row.customers?.name || row.customer_name || '—'}</td>
                          <td className="r">฿{fmt(row.amount)}</td>
                          <td style={{ paddingLeft: 48 }}><span className={`tag ${row.paid ? 'sage' : 'amber'}`}>{row.paid ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></td>
                          <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{row.note || '—'}</td>
                          <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{row.bill_book && row.bill_number ? `${row.bill_book}/${row.bill_number}` : row.bill_number || row.bill_book || '—'}</td>
                        </>
                      )}
                      {tab === 'price' && (
                        <>
                          <td className="r" style={{ color: FUEL_COLORS.b7 }}>฿{row.b7_cost_price}</td>
                          <td className="r" style={{ color: FUEL_COLORS.b7 }}>฿{row.b7_sell_price}</td>
                          <td className="r" style={{ color: FUEL_COLORS.e91 }}>฿{row.e91_cost_price}</td>
                          <td className="r" style={{ color: FUEL_COLORS.e91 }}>฿{row.e91_sell_price}</td>
                          <td className="r" style={{ color: FUEL_COLORS.e95 }}>฿{row.e95_cost_price}</td>
                          <td className="r" style={{ color: FUEL_COLORS.e95 }}>฿{row.e95_sell_price}</td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {/* TABLE TOTALS */}
              {tab === 'sales' && rows.length > 1 && (
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line-soft)' }}>
                    <td>รวม</td>
                    <td className="r">฿{fmt(summary.totalSales)}</td>
                    <td className="r" style={{ color: 'oklch(0.500 0.140 150)' }}>฿{fmt(summary.totalProfit)}</td>
                    <td className="r">{parseFloat(summary.totalLiters || 0).toFixed(3)}</td>
                    <td className="r" style={{ fontSize: 12, color: 'var(--ink-3)' }}>{(summary.profitMargin || 0).toFixed(1)}%</td>
                  </tr>
                </tfoot>
              )}
              {tab === 'fuel' && rows.length > 1 && fuelType === 'all' && (
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line-soft)' }}>
                    <td>รวม</td>
                    <td className="r">{rows.reduce((s, r) => s + parseFloat(r.b7_liters || 0), 0).toFixed(3)}</td>
                    <td className="r">{rows.reduce((s, r) => s + parseFloat(r.e91_liters || 0), 0).toFixed(3)}</td>
                    <td className="r">{rows.reduce((s, r) => s + parseFloat(r.e95_liters || 0), 0).toFixed(3)}</td>
                    <td className="r">{rows.reduce((s, r) => s + parseFloat(r.b7_liters || 0) + parseFloat(r.e91_liters || 0) + parseFloat(r.e95_liters || 0), 0).toFixed(3)}</td>
                  </tr>
                </tfoot>
              )}
              {tab === 'fuel' && rows.length > 1 && fuelType !== 'all' && (
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line-soft)' }}>
                    <td>รวม</td>
                    <td className="r">{rows.reduce((s, r) => s + parseFloat(r[`${fuelType}_liters`] || r.liters || 0), 0).toFixed(3)}</td>
                    <td className="r">฿{fmt(rows.reduce((s, r) => s + parseFloat(r[`${fuelType}_sales`] || r.sales || 0), 0))}</td>
                    <td className="r" style={{ color: 'oklch(0.500 0.140 150)' }}>฿{fmt(rows.reduce((s, r) => s + parseFloat(r[`${fuelType}_profit`] || r.profit || 0), 0))}</td>
                  </tr>
                </tfoot>
              )}
              {tab === 'credit' && rows.length > 1 && (
                <tfoot>
                  <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line-soft)' }}>
                    <td>รวม {summary.totalBills} บิล</td>
                    <td className="r">฿{fmt(summary.totalAmount)}</td>
                    <td></td><td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && invoiceRows.length === 0 && (
        <div className="empty-state">ไม่มีข้อมูลในช่วงเวลานี้</div>
      )}

      <Footer />

      <style>{`
        @media print {
          .page-header button, .nav-link, footer { display: none !important; }
          .main-container { padding: 0 !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      {/* INVOICE MODAL */}
      {selectedInvoice && (
        <div onClick={closeInvoiceModal} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--surface)', borderRadius: 16, width: '100%', maxWidth: 680,
            maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
          }}>
            {/* Header */}
            <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--line-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>ใบวางบิล</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{selectedInvoice.invoice_number}</div>
                <div style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>{selectedInvoice.customers?.name || '—'}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <span className={`tag ${selectedInvoice.status === 'paid' ? 'sage' : 'amber'}`} style={{ fontSize: 13 }}>
                  {selectedInvoice.status === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}
                </span>
                <button onClick={closeInvoiceModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
              </div>
            </div>

            {/* Summary */}
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--line-soft)', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>วันที่สร้างใบวางบิล</div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{fmtDate(selectedInvoice.created_at || selectedInvoice.issue_date)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>ยอดรวม</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>฿{fmt(parseFloat(selectedInvoice.total_amount || 0))}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>ค้างชำระ</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: selectedInvoice.status === 'paid' ? '#27ae60' : '#c0392b' }}>
                  ฿{fmt(selectedInvoice.status === 'paid' ? 0 : parseFloat(selectedInvoice.remaining_amount || 0))}
                </div>
              </div>
              {selectedInvoice.status === 'paid' && (
                <>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>วันที่ชำระ</div>
                    <div style={{ fontSize: 15 }}>{fmtDate(selectedInvoice.paid_date)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>วิธีชำระ</div>
                    <div style={{ fontSize: 15 }}>{selectedInvoice.payment_method === 'cash' ? 'เงินสด' : selectedInvoice.payment_method === 'transfer' ? 'โอนเงิน' : '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>ยืนยันโดย</div>
                    <div style={{ fontSize: 15 }}>{invoiceDetail?.invoice?.confirmed_by || '—'}</div>
                  </div>
                </>
              )}
            </div>

            {/* Bills list */}
            <div style={{ padding: '20px 28px' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', marginBottom: 12 }}>รายการบิลในใบวางบิล</div>
              {!invoiceDetail ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-3)' }}>กำลังโหลด...</div>
              ) : (invoiceDetail.invoice?.bills?.length > 0) ? (
                <table className="data-table" style={{ fontSize: 14 }}>
                  <thead>
                    <tr>
                      <th>วันที่</th>
                      <th>เลขบิล</th>
                      <th>หมายเหตุ</th>
                      <th className="r">ยอด (฿)</th>
                      <th style={{ paddingLeft: 32 }}>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceDetail.invoice.bills.map((b, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{fmtDate(b.date)}</td>
                        <td style={{ fontSize: 13 }}>{b.bill_book && b.bill_number ? `${b.bill_book}/${b.bill_number}` : b.bill_number || '—'}</td>
                        <td style={{ fontSize: 13, color: 'var(--ink-3)' }}>{b.note || '—'}</td>
                        <td className="r">฿{fmt(parseFloat(b.amount || 0))}</td>
                        <td style={{ paddingLeft: 32 }}><span className={`tag ${b.paid ? 'sage' : 'amber'}`}>{b.paid ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, borderTop: '2px solid var(--line-soft)' }}>
                      <td>รวม {invoiceDetail.invoice.bills.length} รายการ</td>
                      <td></td><td></td>
                      <td className="r">฿{fmt(invoiceDetail.invoice.bills.reduce((s, b) => s + parseFloat(b.amount || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>ไม่พบรายการ</div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
