export const FUEL_THEME = {
  B7:  { fill: 'rgba(68, 98, 155, 0.88)',  border: 'rgba(68, 98, 155, 1)',   label: 'oklch(0.28 0.10 250)' },
  E91: { fill: 'rgba(174, 60, 48, 0.88)',  border: 'rgba(174, 60, 48, 1)',   label: 'oklch(0.28 0.12 25)'  },
  E95: { fill: 'rgba(58, 120, 72, 0.88)',  border: 'rgba(58, 120, 72, 1)',   label: 'oklch(0.28 0.10 150)' },
};

export default function OilPriceCard({ prices, station, onStationChange, loading }) {
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
