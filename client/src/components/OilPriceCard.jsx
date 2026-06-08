import { useState } from 'react';
import { api } from '../lib/api.js';

export const FUEL_THEME = {
  B7:  { fill: 'rgba(68, 98, 155, 0.88)',  border: 'rgba(68, 98, 155, 1)',   label: 'oklch(0.28 0.10 250)' },
  E91: { fill: 'rgba(174, 60, 48, 0.88)',  border: 'rgba(174, 60, 48, 1)',   label: 'oklch(0.28 0.12 25)'  },
  E95: { fill: 'rgba(58, 120, 72, 0.88)',  border: 'rgba(58, 120, 72, 1)',   label: 'oklch(0.28 0.10 150)' },
};

/* แสดงส่วนต่างและราคาพรุ่งนี้ */
function TomorrowBadge({ diff, todayPrice }) {
  if (diff === null || diff === undefined) return null;

  const tomorrow = todayPrice != null ? (parseFloat(todayPrice) + diff).toFixed(2) : null;
  const abs      = Math.abs(diff).toFixed(2);

  const baseStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    fontSize: 14, fontWeight: 500, fontFamily: 'var(--f-mono)',
    borderRadius: 4, padding: '5px 10px', marginTop: 8,
  };

  if (diff > 0) return (
    <div style={{ ...baseStyle, color: '#c0392b', background: 'rgba(192,57,43,0.08)', border: '1px solid rgba(192,57,43,0.18)' }}>
      <span>▲ +{abs}</span>
      {tomorrow && <span style={{ opacity: 0.5 }}>→</span>}
      {tomorrow && <span style={{ fontWeight: 700, fontSize: 15 }}>฿{tomorrow}</span>}
    </div>
  );

  if (diff < 0) return (
    <div style={{ ...baseStyle, color: '#27ae60', background: 'rgba(39,174,96,0.08)', border: '1px solid rgba(39,174,96,0.18)' }}>
      <span>▼ -{abs}</span>
      {tomorrow && <span style={{ opacity: 0.5 }}>→</span>}
      {tomorrow && <span style={{ fontWeight: 700, fontSize: 15 }}>฿{tomorrow}</span>}
    </div>
  );

  return (
    <div style={{ ...baseStyle, color: '#7a7068', background: 'rgba(122,112,104,0.07)', border: '1px solid rgba(122,112,104,0.15)' }}>
      ● ราคาคงเดิม {tomorrow && `฿${tomorrow}`}
    </div>
  );
}

export default function OilPriceCard({ prices, station, onStationChange, loading }) {
  const [tomorrowDiff, setTomorrowDiff] = useState(null);
  const [fetchedAt, setFetchedAt]       = useState(null);
  const [fetching, setFetching]         = useState(false);

  const handleFetchTomorrow = async () => {
    setFetching(true);
    try {
      const res = await api.get('/api/tomorrow-price');
      if (res?.data) {
        setTomorrowDiff(res.data);
        setFetchedAt(new Date());
      }
    } catch (err) {
      console.error('Tomorrow price fetch failed:', err);
    } finally {
      setFetching(false);
    }
  };

  if (loading && !prices) {
    return (
      <div className="card" style={{ padding: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, marginBottom: 48 }}>
        <div style={{ color: 'var(--ink-3)', fontSize: 14 }}>กำลังโหลดราคาน้ำมัน...</div>
      </div>
    );
  }

  if (!prices) return null;

  const stationsData = prices.stations || {};
  const currentStationPrices = stationsData[station] || {};
  const dateStr = prices.date || '';

  const targetFuels = [
    {
      label: 'ดีเซล B7',
      color: FUEL_THEME.B7.fill,
      diffKey: 'b7',
      getData: (p) => p.diesel || p.disel || p.vpower_diesel,
    },
    {
      label: 'แก๊สโซฮอล์ 95',
      color: FUEL_THEME.E95.fill,
      diffKey: 'e95',
      getData: (p) => p.gasohol_95 || p.premium_gasohol_95 || p.vpower_gasohol_95,
    },
    {
      label: 'แก๊สโซฮอล์ 91',
      color: FUEL_THEME.E91.fill,
      diffKey: 'e91',
      getData: (p) => p.gasohol_91,
    },
  ];

  return (
    <div className="card" style={{ padding: 24, marginBottom: 48 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-4)', margin: 0, fontFamily: 'var(--f-body)' }}>ราคาน้ำมันขายปลีกวันนี้</h3>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)' }}>อัปเดตล่าสุด: {dateStr} (กทม. และปริมณฑล)</span>
          {fetchedAt && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', marginTop: 3 }}>
              ราคาพรุ่งนี้: ดึงเมื่อ {fetchedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} น.
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* ปุ่มดึงราคาพรุ่งนี้ */}
          <button
            onClick={handleFetchTomorrow}
            disabled={fetching}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 500, padding: '6px 12px',
              border: '1px solid var(--border-color, #e4ddd4)',
              borderRadius: 4, cursor: fetching ? 'not-allowed' : 'pointer',
              background: tomorrowDiff ? 'var(--accent)' : 'var(--bg-deep)',
              color: tomorrowDiff ? '#fff' : 'var(--ink-3)',
              opacity: fetching ? 0.6 : 1,
              transition: 'all 0.2s ease',
              fontFamily: 'var(--f-body)',
              whiteSpace: 'nowrap',
            }}
          >
            {fetching ? '⏳' : '🔄'} {fetching ? 'กำลังดึง...' : tomorrowDiff ? 'ราคาพรุ่งนี้ ✓' : 'ราคาพรุ่งนี้'}
          </button>

          {/* Station selector */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-deep)', padding: 4, borderRadius: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'ptt',   label: 'ปตท. (PTT)' },
              { key: 'bcp',   label: 'บางจาก (BCP)' },
              { key: 'pt',    label: 'พีที (PT)' },
              { key: 'shell', label: 'เชลล์ (Shell)' },
            ].map(st => (
              <button
                key={st.key}
                onClick={() => onStationChange(st.key)}
                style={{
                  border: 'none', padding: '6px 12px', fontSize: 12, fontWeight: 500,
                  borderRadius: 4, cursor: 'pointer',
                  background: station === st.key ? 'var(--accent)' : 'transparent',
                  color: station === st.key ? '#fff' : 'var(--ink-3)',
                  transition: 'all 0.2s ease', fontFamily: 'var(--f-body)',
                }}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fuel cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {targetFuels.map((fuel, idx) => {
          const fuelData  = fuel.getData(currentStationPrices) || {};
          if (!fuelData.price) return null;
          const todayPrice = parseFloat(fuelData.price);
          const price      = `฿${todayPrice.toFixed(2)}`;
          const diff       = tomorrowDiff?.[fuel.diffKey]?.diff ?? null;

          return (
            <div key={idx} style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color, #e4ddd4)',
              borderRadius: 8,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: fuel.color }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: fuel.color }} />
                <span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 500, fontFamily: 'var(--f-body)' }}>{fuel.label}</span>
              </div>

              <div style={{
                fontFamily: 'var(--f-body)', fontSize: 26, fontWeight: 300,
                color: 'var(--ink-4)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums',
              }}>
                {price}
              </div>

              <TomorrowBadge diff={diff} todayPrice={todayPrice} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
