import { useState } from 'react';
import { api } from '../lib/api.js';

/*
 * TomorrowPriceAdmin — Admin widget สำหรับ:
 *  1. Trigger scrape ด้วยมือ (กดปุ่ม "ดึงข้อมูลจากบางจาก")
 *  2. Manual override ราคา เมื่อ scrape ล้มเหลว
 *
 * Usage: <TomorrowPriceAdmin onUpdated={(data) => setTomorrowDiff(data)} />
 */
export default function TomorrowPriceAdmin({ onUpdated }) {
  const [open, setOpen]       = useState(false);
  const [scraping, setScraping] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState(null);  // { type: 'ok'|'err', text }

  const [form, setForm] = useState({
    b7_today: '', b7_tomorrow: '', b7_diff: '',
    e95_today: '', e95_tomorrow: '', e95_diff: '',
    e91_today: '', e91_tomorrow: '', e91_diff: '',
  });

  const handleScrape = async () => {
    setScraping(true);
    setMsg(null);
    try {
      const res = await api.post('/api/tomorrow-price/scrape', {});
      setMsg({ type: 'ok', text: `Scrape สำเร็จ (${res.data?.priceDate || ''})` });
      onUpdated?.(res.data);
    } catch (err) {
      setMsg({ type: 'err', text: `Scrape ล้มเหลว: ${err.message}` });
    } finally {
      setScraping(false);
    }
  };

  const handleOverride = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.post('/api/tomorrow-price/override', form);
      setMsg({ type: 'ok', text: 'บันทึก manual override สำเร็จ' });
      onUpdated?.(res.data);
    } catch (err) {
      setMsg({ type: 'err', text: `บันทึกล้มเหลว: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const field = (key, placeholder) => (
    <input
      type="number" step="0.01" placeholder={placeholder}
      value={form[key]}
      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      style={{
        width: '100%', padding: '6px 8px', fontSize: 13,
        border: '1px solid var(--border-color, #e4ddd4)',
        borderRadius: 4, background: 'var(--bg-card)',
        color: 'var(--ink-4)', fontFamily: 'var(--f-mono)',
      }}
    />
  );

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontSize: 12, padding: '5px 12px', border: '1px solid var(--border-color, #e4ddd4)',
          borderRadius: 4, background: 'var(--bg-deep)', color: 'var(--ink-3)',
          cursor: 'pointer', fontFamily: 'var(--f-body)',
        }}
      >
        {open ? '▲' : '▼'} จัดการราคาพรุ่งนี้ (Admin)
      </button>

      {open && (
        <div style={{
          marginTop: 12, padding: 20,
          border: '1px solid var(--border-color, #e4ddd4)',
          borderRadius: 8, background: 'var(--bg-deep)',
        }}>
          {/* Scrape button */}
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={handleScrape}
              disabled={scraping}
              style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 500,
                border: 'none', borderRadius: 4, cursor: scraping ? 'not-allowed' : 'pointer',
                background: 'var(--accent)', color: '#fff', fontFamily: 'var(--f-body)',
                opacity: scraping ? 0.6 : 1,
              }}
            >
              {scraping ? 'กำลังดึงข้อมูล...' : '🔄 ดึงราคาจากบางจาก'}
            </button>
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--f-mono)' }}>
              (ทำงานอัตโนมัติ 09:05 / 18:00 ทุกวัน)
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color, #e4ddd4)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-4)', marginBottom: 12, fontFamily: 'var(--f-body)' }}>
              Manual Override (กรณี scrape ล้มเหลว)
            </div>

            <form onSubmit={handleOverride}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {['น้ำมัน', 'วันนี้ (฿)', 'พรุ่งนี้ (฿)', 'ส่วนต่าง (฿)'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--ink-3)', fontFamily: 'var(--f-body)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'ดีเซล B7', prefix: 'b7' },
                    { label: 'แก๊สโซฮอล์ 95', prefix: 'e95' },
                    { label: 'แก๊สโซฮอล์ 91', prefix: 'e91' },
                  ].map(({ label, prefix }) => (
                    <tr key={prefix}>
                      <td style={{ padding: '4px 8px', color: 'var(--ink-4)', fontFamily: 'var(--f-body)', whiteSpace: 'nowrap' }}>{label}</td>
                      <td style={{ padding: '4px 8px' }}>{field(`${prefix}_today`, '0.00')}</td>
                      <td style={{ padding: '4px 8px' }}>{field(`${prefix}_tomorrow`, '0.00')}</td>
                      <td style={{ padding: '4px 8px' }}>{field(`${prefix}_diff`, '+0.00')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="submit"
                disabled={saving}
                style={{
                  marginTop: 12, padding: '7px 16px', fontSize: 13, fontWeight: 500,
                  border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer',
                  background: '#5c544e', color: '#fff', fontFamily: 'var(--f-body)',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก Override'}
              </button>
            </form>
          </div>

          {msg && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 4, fontSize: 12,
              fontFamily: 'var(--f-mono)',
              color: msg.type === 'ok' ? '#27ae60' : '#c0392b',
              background: msg.type === 'ok' ? 'rgba(39,174,96,0.08)' : 'rgba(192,57,43,0.08)',
              border: `1px solid ${msg.type === 'ok' ? 'rgba(39,174,96,0.2)' : 'rgba(192,57,43,0.2)'}`,
            }}>
              {msg.text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
