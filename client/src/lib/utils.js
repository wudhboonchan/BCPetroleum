export const THAI_DAYS = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
export const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
export const THAI_MONTHS_LONG = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

export function thaiDate(d) {
  const day = THAI_DAYS[d.getDay()];
  return `วัน${day}ที่ ${d.getDate()} ${THAI_MONTHS_LONG[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function thaiShort(d) {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

export function fmt(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtThai(n, decimals = 0) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function dateStr(d) {
  return d.toISOString().split('T')[0];
}

export function getShiftLabel() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return 'กะ A กำลังขาย · 06:00 – 14:00';
  if (h >= 14 && h < 22) return 'กะ B กำลังขาย · 14:00 – 22:00';
  return 'นอกเวลาทำการ';
}

export function getTimeRemaining() {
  const now = new Date();
  const close = new Date(now);
  close.setHours(22, 0, 0, 0);
  if (now >= close) return '';
  const diff = close - now;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `เหลือเวลาเปิดอีก ${h} ชม. ${m} น.`;
}

export const FUEL_COLORS = {
  B7:  'oklch(0.50 0.13 250)',
  E91: 'oklch(0.55 0.18 25)',
  E95: 'oklch(0.55 0.13 150)',
};

export const FUEL_PRICES = { B7: 30.94, E91: 36.18, E95: 36.45 };
export const FUEL_NAMES  = { B7: 'ดีเซล B7', E91: 'แก๊สโซฮอล์ 91', E95: 'แก๊สโซฮอล์ 95' };
