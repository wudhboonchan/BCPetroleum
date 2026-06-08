import { useState, useRef, useEffect, useCallback } from 'react';

const THAI_MONTHS = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const DAYS = ['จ','อ','พ','พฤ','ศ','ส','อา'];

function parseDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatISO(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplay(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

export default function DatePicker({ value, onChange, placeholder = 'วว/ดด/ปปปป', required, style, className, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = parseDate(value);
    return d || new Date();
  });
  const ref = useRef(null);

  useEffect(() => {
    const d = parseDate(value);
    if (d) setViewDate(d);
  }, [value]);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = parseDate(value);
  const today = new Date();

  const firstDay = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  // Monday-first: 0=Mon … 6=Sun
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1;

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

  const selectDay = (d) => {
    if (!d) return;
    const chosen = new Date(viewDate.getFullYear(), viewDate.getMonth(), d);
    onChange(formatISO(chosen));
    setOpen(false);
  };

  const isSelected = (d) => {
    if (!d || !selected) return false;
    return selected.getFullYear() === viewDate.getFullYear() &&
      selected.getMonth() === viewDate.getMonth() &&
      selected.getDate() === d;
  };

  const isToday = (d) => {
    if (!d) return false;
    return today.getFullYear() === viewDate.getFullYear() &&
      today.getMonth() === viewDate.getMonth() &&
      today.getDate() === d;
  };

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', ...style }} className={className}>
      {/* Input trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-deep)', border: '1px solid var(--line)',
          borderRadius: 'var(--r-1)', padding: '10px 12px',
          fontSize: 14, lineHeight: 'normal',
          color: value ? 'var(--ink)' : 'var(--ink-4)',
          fontFamily: 'var(--f-body)', cursor: 'pointer', userSelect: 'none',
          width: '100%', boxSizing: 'border-box',
          borderColor: open ? 'var(--ink-2)' : 'var(--line)',
        }}
      >
        <span>{value ? formatDisplay(value) : placeholder}</span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 8, flexShrink: 0, opacity: 0.45 }}>
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M5 1v3M11 1v3M2 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Hidden native input for form validation */}
      {required && (
        <input type="text" required value={value || ''} onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} tabIndex={-1} />
      )}

      {/* Calendar dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          left: align === 'left' ? 0 : 'auto',
          right: align === 'right' ? 0 : 'auto',
          zIndex: 999,
          background: 'var(--surface)', border: '1px solid var(--line-soft)',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          padding: '16px', minWidth: 280, userSelect: 'none',
        }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button type="button" onClick={prevMonth} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
              color: 'var(--ink-3)', fontSize: 16, borderRadius: 6, lineHeight: 1,
            }}>‹</button>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>
              {THAI_MONTHS[viewDate.getMonth()]} {viewDate.getFullYear() + 543}
            </span>
            <button type="button" onClick={nextMonth} style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
              color: 'var(--ink-3)', fontSize: 16, borderRadius: 6, lineHeight: 1,
            }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
            {DAYS.map(d => (
              <div key={d} style={{
                textAlign: 'center', fontSize: 11, fontFamily: 'var(--f-mono)',
                color: 'var(--ink-3)', letterSpacing: '0.04em', padding: '4px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Date grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
            {cells.map((d, i) => (
              <button
                key={i} type="button"
                onClick={() => selectDay(d)}
                disabled={!d}
                style={{
                  border: 'none', borderRadius: 6, cursor: d ? 'pointer' : 'default',
                  padding: '6px 0', fontSize: 13, fontFamily: 'var(--f-mono)',
                  textAlign: 'center', lineHeight: 1, transition: 'background .12s',
                  background: isSelected(d) ? 'var(--accent)' : 'transparent',
                  color: isSelected(d) ? '#fff' : isToday(d) ? 'var(--accent)' : d ? 'var(--ink)' : 'transparent',
                  fontWeight: isSelected(d) ? 500 : isToday(d) ? 600 : 400,
                  outline: isToday(d) && !isSelected(d) ? '1.5px solid var(--accent)' : 'none',
                  outlineOffset: '-1.5px',
                }}
              >
                {d || ''}
              </button>
            ))}
          </div>

          {/* Today button */}
          <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 12, paddingTop: 10, textAlign: 'center' }}>
            <button type="button" onClick={() => { onChange(formatISO(today)); setOpen(false); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 12,
              color: 'var(--ink-3)', fontFamily: 'var(--f-mono)', letterSpacing: '0.04em',
            }}>วันนี้</button>
          </div>
        </div>
      )}
    </div>
  );
}
