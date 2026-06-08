import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Chart, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import { fmt, thaiDate, THAI_MONTHS } from '../lib/utils.js';
import Footer from '../components/Footer.jsx';

Chart.register(...registerables, ChartDataLabels);

/* ── สีน้ำมัน: ยังคง red/green/blue แต่ปรับโทนให้เข้ากับธีม Sodium Dusk ── */
const FUEL_THEME = {
  B7:  { fill: 'rgba(68, 98, 155, 0.88)',  border: 'rgba(68, 98, 155, 1)',   label: 'oklch(0.28 0.10 250)' },
  E91: { fill: 'rgba(174, 60, 48, 0.88)',  border: 'rgba(174, 60, 48, 1)',   label: 'oklch(0.28 0.12 25)'  },
  E95: { fill: 'rgba(58, 120, 72, 0.88)',  border: 'rgba(58, 120, 72, 1)',   label: 'oklch(0.28 0.10 150)' },
};

const TIP = {
  backgroundColor: '#faf8f4',
  titleColor:      '#2e2720',
  bodyColor:       '#7a7068',
  borderColor:     '#e4ddd4',
  borderWidth: 1, padding: 12,
  titleFont: { family: "'Bai Jamjuree', system-ui", size: 14, weight: '400' },
  bodyFont:  { family: "'IBM Plex Mono', monospace", size: 13 },
};

/* ── กราฟ 7 วัน: แท่งพร้อม label ค่า + trend indicator ── */
function SevenDayBars({ data }) {
  const ref = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.length) return;
    if (chart.current) chart.current.destroy();

    const vals  = data.map(d => parseFloat(d.total_sales) || 0);
    const avg   = vals.reduce((s, v) => s + v, 0) / vals.length;
    const max   = Math.max(...vals);

    const colors = vals.map(v =>
      v === max  ? '#c27a3a'   /* accent ส้ม = วันสูงสุด */
      : v >= avg ? '#5c544e'   /* เหนือค่าเฉลี่ย */
                 : '#b8b0a8'   /* ต่ำกว่าค่าเฉลี่ย */
    );

    chart.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map((_, i) => i), // index เฉย ๆ ไม่แสดง
        datasets: [{
          data: vals,
          backgroundColor: colors,
          borderRadius: 6,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 32, left: 4, right: 4, bottom: 0 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            ...TIP,
            callbacks: {
              title: ctx => {
                const dt = new Date(data[ctx[0].dataIndex].date);
                const days = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
                return `${days[dt.getDay()]} ${dt.getDate()} ${THAI_MONTHS[dt.getMonth()]}`;
              },
              label: ctx => `฿${fmt(ctx.parsed.y)}`,
            },
          },
          datalabels: {
            anchor: 'end',
            align: 'top',
            offset: 2,
            color: ctx => ctx.dataIndex === vals.indexOf(max) ? '#c27a3a' : '#5c544e',
            font: { family: "'IBM Plex Mono', monospace", size: 12, weight: '500' },
            formatter: v => v > 0 ? '฿' + fmt(v) : '',
          },
        },
        scales: {
          y: {
            display: false,
            beginAtZero: false,
            min: Math.max(0, Math.min(...vals) * 0.85),
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { display: false }, // ซ่อน canvas labels — ใช้ HTML แทน
          },
        },
      },
    });

    return () => chart.current?.destroy();
  }, [data]);

  if (!data?.length) return null;

  const vals = data.map(d => parseFloat(d.total_sales) || 0);
  const avg  = vals.reduce((s, v) => s + v, 0) / vals.length;
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2] || last;
  const diff = last - prev;
  const diffPct = prev > 0 ? ((diff / prev) * 100) : 0;
  const up = diff >= 0;

  return (
    <section style={{ marginBottom: 72 }}>
      <div className="section-hd" style={{ marginBottom: 24 }}>
        <span className="eyebrow" style={{ fontSize: 13 }}>7 วันล่าสุด</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{
            fontFamily: 'var(--f-mono)', fontSize: 13,
            color: up ? 'var(--sage)' : 'var(--rust)',
          }}>
            {up ? '↑' : '↓'} {up ? '+' : ''}{fmt(diff)} ({up ? '+' : ''}{diffPct.toFixed(1)}%) จากเมื่อวาน
          </span>
          <span style={{ fontFamily: 'var(--f-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
            เฉลี่ย ฿{fmt(avg)} / วัน
          </span>
        </div>
      </div>
      <div>
        <div style={{ height: 190 }}>
          <canvas ref={ref} />
        </div>
        {/* HTML labels — Safari-safe, ไม่ผ่าน canvas */}
        <div style={{
          display: 'flex',
          paddingLeft: 4,
          paddingRight: 4,
          marginTop: 6,
        }}>
          {data.map((d, i) => {
            const dt = new Date(d.date);
            const days = ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'];
            return (
              <div key={i} style={{
                flex: 1,
                textAlign: 'center',
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 13,
                color: '#7a7068',
                whiteSpace: 'nowrap',
              }}>
                {days[dt.getDay()]} {dt.getDate()} {THAI_MONTHS[dt.getMonth()]}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Donut: สัดส่วนเชื้อเพลิง ── */
function FuelDonut({ data }) {
  const ref = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    if (chart.current) chart.current.destroy();

    const b7  = parseFloat(data?.b7Sales)  || 0;
    const e91 = parseFloat(data?.e91Sales) || 0;
    const e95 = parseFloat(data?.e95Sales) || 0;

    chart.current = new Chart(ref.current, {
      type: 'doughnut',
      data: {
        labels: ['B7', 'E91', 'E95'],
        datasets: [{
          data: [b7, e91, e95],
          backgroundColor: [FUEL_THEME.B7.fill, FUEL_THEME.E91.fill, FUEL_THEME.E95.fill],
          borderColor: '#faf8f4',
          borderWidth: 3,
          hoverOffset: 10,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: "'Bai Jamjuree', system-ui", size: 14 },
              color: '#6b6058',
              usePointStyle: true, pointStyle: 'circle', padding: 16,
            },
          },
          datalabels: { display: false },
          tooltip: { ...TIP, callbacks: { label: ctx => `฿${fmt(ctx.parsed)}` } },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [data]);

  return <canvas ref={ref} />;
}

/* ── Bar chart: ยอดแต่ละหัวจ่าย ── */
function NozzleChart({ data }) {
  const ref = useRef(null);
  const chart = useRef(null);
  const labels    = ['ตู้1-หัว1','ตู้1-หัว2','ตู้1-หัว3','ตู้1-หัว4','ตู้2-หัว1','ตู้2-หัว2','ตู้2-หัว3','ตู้2-หัว4'];
  const fuelTypes = ['E91','B7','E91','B7','E95','B7','E95','B7'];

  useEffect(() => {
    if (!ref.current) return;
    if (chart.current) chart.current.destroy();

    chart.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: data || Array(8).fill(0),
          backgroundColor: fuelTypes.map(f => FUEL_THEME[f].fill),
          borderColor:     fuelTypes.map(f => FUEL_THEME[f].border),
          borderWidth: 1,
          borderRadius: { topLeft: 4, topRight: 4 },
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 28 } },
        plugins: {
          legend: { display: false },
          datalabels: {
            anchor: 'end', align: 'top', offset: 2,
            color: '#6b6058',
            font: { family: "'IBM Plex Mono', monospace", size: 11 },
            formatter: v => v > 0 ? v.toFixed(0) : '',
          },
          tooltip: { ...TIP, callbacks: { label: ctx => `${ctx.parsed.y.toFixed(3)} L` } },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#e4ddd4' },
            border: { display: false },
            ticks: {
              font: { family: "'IBM Plex Mono', monospace", size: 12 },
              color: '#9a9088',
              callback: v => fmt(v) + ' L',
            },
          },
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { family: "'Bai Jamjuree', system-ui", size: 13 },
              color: '#6b6058',
              maxRotation: 0,
            },
          },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [data]);

  return <canvas ref={ref} />;
}

function OilPriceCard({ prices, station, onStationChange, loading }) {
  if (loading && !prices) {
    return (
      <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, marginBottom: 48 }}>
        <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>กำลังโหลดราคาน้ำมัน...</div>
      </div>
    );
  }

  if (!prices) {
    return null; // Don't show anything or show empty
  }

  const stationsData = prices.stations || {};
  const currentStationPrices = stationsData[station] || {};
  const dateStr = prices.date || '';

  // Only display the 3 fuel types sold in our system: Diesel B7, Gasohol 95, and Gasohol 91
  // Using dynamic fallback keys to support different station spelling/keys (e.g. Shell uses vpower_diesel, BCP uses disel)
  const targetFuels = [
    { 
      label: 'ดีเซล B7', 
      color: FUEL_THEME.B7.fill, 
      getData: (prices) => prices.diesel || prices.disel || prices.vpower_diesel 
    },
    { 
      label: 'แก๊สโซฮอล์ 95', 
      color: FUEL_THEME.E95.fill, 
      getData: (prices) => prices.gasohol_95 || prices.premium_gasohol_95 || prices.vpower_gasohol_95 
    },
    { 
      label: 'แก๊สโซฮอล์ 91', 
      color: FUEL_THEME.E91.fill, 
      getData: (prices) => prices.gasohol_91 
    }
  ];

  return (
    <div className="card" style={{ padding: 24, marginBottom: 48 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-4)', margin: 0, fontFamily: 'var(--f-body)' }}>ราคาน้ำมันขายปลีกวันนี้</h3>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)' }}>อัปเดตล่าสุด: {dateStr} (กทม. และปริมณฑล)</span>
        </div>
        
        <div style={{ display: 'flex', gap: 6, background: 'var(--bg-deep)', padding: 4, borderRadius: 6, flexWrap: 'wrap' }}>
          {[
            { key: 'ptt', label: 'ปตท. (PTT)' },
            { key: 'bcp', label: 'บางจาก (BCP)' },
            { key: 'pt', label: 'พีที (PT)' },
            { key: 'shell', label: 'เชลล์ (Shell)' }
          ].map(st => (
            <button
              key={st.key}
              onClick={() => onStationChange(st.key)}
              style={{
                border: 'none',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                borderRadius: 4,
                cursor: 'pointer',
                background: station === st.key ? 'var(--accent)' : 'transparent',
                color: station === st.key ? '#fff' : 'var(--ink-3)',
                transition: 'all 0.2s ease',
                fontFamily: 'var(--f-body)'
              }}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {targetFuels.map((fuel, idx) => {
          const fuelData = fuel.getData(currentStationPrices) || {};
          if (!fuelData.price) return null;
          const price = `฿${parseFloat(fuelData.price).toFixed(2)}`;
          return (
            <div key={idx} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color, #e4ddd4)',
              borderRadius: 8,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: fuel.color }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: fuel.color }} />
                <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, fontFamily: 'var(--f-body)' }}>{fuel.label}</span>
              </div>
              <div style={{
                fontFamily: 'var(--f-body)',
                fontSize: 26,
                fontWeight: 300,
                color: 'var(--ink-4)',
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums'
              }}>
                {price}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────── Dashboard ─────────────────────────────── */
export default function Dashboard() {
  const [dashData, setDashData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [oilPrices, setOilPrices] = useState(null);
  const [oilStation, setOilStation] = useState('ptt');
  const [oilLoading, setOilLoading] = useState(false);
  const toast = useToast();
  const now = new Date();

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.get('/api/dashboard/summary');
      setDashData(data);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const loadOilPrices = async () => {
    try {
      setOilLoading(true);
      const data = await api.get('/api/dashboard/oil-prices');
      setOilPrices(data);
    } catch (err) {
      console.error('Failed to load oil prices:', err);
    } finally {
      setOilLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadOilPrices();
    const id = setInterval(() => {
      load();
      loadOilPrices();
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const today  = dashData?.today;
  const total  = parseFloat(today?.totalSales)  || 0;
  const profit = parseFloat(today?.totalProfit) || 0;
  const liters = parseFloat(today?.totalLiters) || 0;
  const credit = parseFloat(dashData?.totalCredit) || 0;

  const cash      = Math.round(total * 0.62);
  const cred      = Math.round(total * 0.31);
  const qr        = total - cash - cred;
  const cashPct   = total > 0 ? (cash / total * 100).toFixed(1) : '0';
  const creditPct = total > 0 ? (cred / total * 100).toFixed(1) : '0';
  const qrPct     = total > 0 ? (qr   / total * 100).toFixed(1) : '0';

  return (
    <main className="main-container">
      {loading && <Loading />}

      {/* PAGE HEADER — ตรงกับหน้าอื่นๆ */}
      <div className="page-header">
        <div>
          <div className="page-eyebrow">แดชบอร์ด · Dashboard</div>
          <h1 className="page-title">ภาพรวมวันนี้</h1>
        </div>
        <span style={{
          fontFamily: 'var(--f-mono)', fontSize: 13,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}>
          {thaiDate(now)}
        </span>
      </div>

      {/* HERO — ยอดขาย (ซ้าย) + pay split (ขวา) */}
      <section style={{
        marginTop: 32, marginBottom: 48,
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 48, alignItems: 'center',
      }}>
        {/* ซ้าย: ยอดขาย */}
        <div>
          <div style={{ fontSize: 15, color: 'var(--ink-3)', marginBottom: 10 }}>ยอดขายรวมวันนี้</div>
          <div style={{
            fontFamily: 'var(--f-body)',
            fontSize: 'clamp(52px, 6vw, 80px)',
            fontWeight: 300,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <span style={{ color: 'var(--ink-4)' }}>฿</span>{fmt(total)}
          </div>
        </div>

        {/* ขวา: pay split */}
        <div>
          <div style={{ fontSize: 13, fontFamily: 'var(--f-mono)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 14 }}>
            แยกตามช่องทาง
          </div>
          <div style={{ height: 5, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
            <div style={{ background: 'var(--accent)', width: cashPct   + '%', transition: 'width .6s ease' }} />
            <div style={{ background: '#a89e95',       width: creditPct + '%', transition: 'width .6s ease' }} />
            <div style={{ background: '#7a1e1e',       width: qrPct     + '%', transition: 'width .6s ease' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 18 }}>
            {[
              { label: 'เงินสด',   color: 'var(--accent)', val: cash, pct: cashPct },
              { label: 'เงินเชื่อ', color: '#a89e95',       val: cred, pct: creditPct },
              { label: 'QR · โอน', color: '#7a1e1e',       val: qr,   pct: qrPct },
            ].map(({ label, color, val, pct }) => (
              <div key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-3)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--f-body)', fontSize: 22, fontWeight: 300, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 6 }}>
                  ฿{fmt(val)}
                </div>
                <div style={{ fontFamily: 'var(--f-mono)', fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{pct}%</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* METRICS STRIP */}
      <section className="metrics-strip">
        <div className="metric-item">
          <div className="metric-label">กำไรวันนี้</div>
          <div className="metric-value">฿{fmt(profit)}</div>
          <div className="metric-sub">≈ {total > 0 ? ((profit / total) * 100).toFixed(1) : '—'}% ของยอดขาย</div>
        </div>
        <div className="metric-item bordered">
          <div className="metric-label">ปริมาณรวม</div>
          <div className="metric-value">
            {fmt(liters, 1)}<span className="metric-suffix">ลิตร</span>
          </div>
          <div className="metric-sub">3 ประเภทเชื้อเพลิง</div>
        </div>
        <div className="metric-item bordered">
          <div className="metric-label">ค้างชำระเงินเชื่อ</div>
          <div className="metric-value" style={{ color: credit > 0 ? 'var(--rust)' : 'var(--ink)' }}>
            ฿{fmt(credit)}
          </div>
          <div className="metric-sub">{credit > 0 ? 'ยังค้างชำระ' : 'ชำระครบแล้ว'}</div>
          <Link to="/credit" className="metric-action">ดูทั้งหมด →</Link>
        </div>
      </section>

      {/* OIL PRICES WIDGET */}
      <OilPriceCard 
        prices={oilPrices} 
        station={oilStation} 
        onStationChange={setOilStation} 
        loading={oilLoading} 
      />

      {/* 7-DAY BARS */}
      <SevenDayBars data={dashData?.last7Days} />

      {/* FUEL DONUT + NOZZLE CHART */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, marginBottom: 80 }} id="fuelNozzleGrid">
        <div className="card">
          <div className="card-header" style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>สัดส่วนเชื้อเพลิง</span>
          </div>
          <div className="chart-canvas-wrap" style={{ height: 240 }}>
            <FuelDonut data={today} />
          </div>
        </div>
        <div className="card">
          <div className="card-header" style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 15, color: 'var(--ink-2)' }}>ยอดขายแต่ละหัวจ่าย (วันนี้)</span>
          </div>
          <div className="chart-canvas-wrap" style={{ height: 240 }}>
            <NozzleChart data={today?.nozzleData} />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
