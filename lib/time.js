// Bali (WITA) = UTC+8, tidak ada DST, jadi offset tetap aman dipakai.
const WITA_OFFSET_MS = 8 * 60 * 60 * 1000;

function todayWita() {
  return new Date(Date.now() + WITA_OFFSET_MS).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00Z');
  const b = new Date(dateStrB + 'T00:00:00Z');
  return Math.round((a - b) / (24 * 60 * 60 * 1000));
}

function formatTanggal(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

module.exports = { todayWita, addDays, diffDays, formatTanggal };
