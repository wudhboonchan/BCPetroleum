import Footer from '../components/Footer.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { api } from '../lib/api.js';
import { useToast } from '../components/Toast.jsx';
import Loading from '../components/Loading.jsx';
import { fmt, THAI_MONTHS, FUEL_COLORS } from '../lib/utils.js';

Chart.register(...registerables);

const TABS = [
  { id: 'sales',   label: 'ยอดขาย' },
  { id: 'fuel',    label: 'เชื้อเพลิง' },
  { id: 'credit',  label: 'เงินเชื่อ' },
];

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function BarChart({ data, labelKey, valueKey, color }) {
  const ref = useRef(null);
  const chart = useRef(null);

  useEffect(() => {
    if (!ref.current || !data?.length) return;
    if (chart.current) chart.current.destroy();
    chart.current = new Chart(ref.current, {
      type: 'bar',
      data: {
        labels: data.map(d => {
          const date = new Date(d[labelKey]);
          return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]}`;
        }),
        datasets: [{
          data: data.map(d => parseFloat(d[valueKey]) || 0),
          backgroundColor: color || 'var(--ink-3)',
          borderRadius: { topLeft: 3, topRight: 3 },
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            backgroundColor: 'oklch(0.985 0.005 80)',
            titleColor: 'oklch(0.235 0.018 55)',
            bodyColor: 'oklch(0.500 0.014 55)',
            borderColor: 'oklch(0.910 0.010 72)',
            borderWidth: 1, padding: 10,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'oklch(0.910 0.010 72)' },
            ticks: { font: { family: "'IBM Plex Mono', monospace", size: 10 }, color: 'oklch(0.650 0.010 60)', callback: v => '฿' + fmt(v) },
          },
          x: {
            grid: { display: false },
            ticks: { font: { family: "'IBM Plex Mono', monospace", size: 10 }, color: 'oklch(0.500 0.014 55)', maxRotation: 45 },
          },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [data]);

  return <canvas ref={ref} />;
}

export default function Reports() {
  const [tab, setTab] = useState('sales');
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      let res;
      if (tab === 'sales') {
        res = await api.get('/api/reports/sales', { start: startDate, end: endDate });
      } else if (tab === 'fuel') {
        res = await api.get('/api/reports/fuel', { start: startDate, end: endDate });
      } else if (tab === 'credit') {
        res = await api.get('/api/reports/credit', { start: startDate, end: endDate });
      }
      setData(res);
    } catch { toast.error('โหลดรายงานไม่ได้'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, startDate, endDate]);

  const salesData = data?.data || data?.sales || [];
  const summary   = data?.summary || {};

  return (
    <main className="main-container">
      {loading && <Loading />}

      <div className="page-header">
        <div>
          <div className="page-eyebrow">รายงาน · Reports</div>
          <h1 className="page-title">รายงาน</h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <DatePicker value={startDate} onChange={v => setStartDate(v)} />
          <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>—</span>
          <DatePicker value={endDate} onChange={v => setEndDate(v)} />
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 32, borderBottom: '1px solid var(--line-soft)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-link${tab === t.id ? ' active' : ''}`}
            style={{ borderRadius: 0, borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent', paddingBottom: 10 }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* SUMMARY CARDS */}
      {summary && Object.keys(summary).length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 32 }}>
          {Object.entries(summary).slice(0, 3).map(([key, val]) => (
            <div key={key} className="stat-card">
              <div className="metric-label" style={{ textTransform: 'capitalize', fontSize: 13 }}>
                {key.replace(/_/g, ' ')}
              </div>
              <div className="metric-value mono">
                {typeof val === 'number' ? (key.includes('liter') ? `${val.toFixed(3)} L` : `฿${fmt(val)}`) : val}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CHART */}
      {salesData.length > 0 && (
        <div className="card" style={{ marginBottom: 32 }}>
          <div className="card-header">
            <span className="card-title">
              {tab === 'sales' ? 'ยอดขายรายวัน' : tab === 'fuel' ? 'ปริมาณน้ำมัน' : 'ยอดเงินเชื่อ'}
            </span>
          </div>
          <div className="chart-canvas-wrap" style={{ height: 280 }}>
            <BarChart
              data={salesData}
              labelKey="date"
              valueKey={tab === 'fuel' ? 'total_liters' : 'total_sales'}
              color="oklch(0.640 0.150 60)"
            />
          </div>
        </div>
      )}

      {/* TABLE */}
      {salesData.length > 0 && (
        <div className="card">
          <div className="card-header"><span className="card-title">รายละเอียด</span></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  {tab === 'sales' && <><th className="r">ยอดขาย</th><th className="r">กำไร</th><th className="r">ลิตร</th></>}
                  {tab === 'fuel' && <><th className="r">B7 (ลิตร)</th><th className="r">E91 (ลิตร)</th><th className="r">E95 (ลิตร)</th></>}
                  {tab === 'credit' && <><th>ลูกค้า</th><th className="r">จำนวน</th><th>สถานะ</th></>}
                </tr>
              </thead>
              <tbody>
                {salesData.map((row, i) => (
                  <tr key={i}>
                    <td className="mono" style={{ fontSize: 13 }}>{row.date?.split('T')[0] || row.date}</td>
                    {tab === 'sales' && (
                      <>
                        <td className="r mono">฿{fmt(row.total_sales)}</td>
                        <td className="r mono">฿{fmt(row.total_profit)}</td>
                        <td className="r mono">{parseFloat(row.total_liters || 0).toFixed(3)}</td>
                      </>
                    )}
                    {tab === 'fuel' && (
                      <>
                        <td className="r mono">{parseFloat(row.b7_liters || 0).toFixed(3)}</td>
                        <td className="r mono">{parseFloat(row.e91_liters || 0).toFixed(3)}</td>
                        <td className="r mono">{parseFloat(row.e95_liters || 0).toFixed(3)}</td>
                      </>
                    )}
                    {tab === 'credit' && (
                      <>
                        <td>{row.customer_name || '—'}</td>
                        <td className="r mono">฿{fmt(row.amount)}</td>
                        <td><span className={`tag ${row.paid ? 'sage' : 'amber'}`}>{row.paid ? 'ชำระแล้ว' : 'ค้างชำระ'}</span></td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && salesData.length === 0 && (
        <div className="empty-state">ไม่มีข้อมูลในช่วงเวลานี้</div>
      )}
          <Footer />
    </main>
  );
}
