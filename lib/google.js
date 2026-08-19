const crypto = require('crypto');
const { sbSelect, sbUpdate } = require('./supabaseAdmin');
const { addDays } = require('./time');

const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// state = "<anggotaId>.<hmac>" -- HMAC mencegah orang lain menyambungkan hasil
// OAuth consent-nya sendiri ke anggota_id milik orang lain.
function signState(anggotaId) {
  const hmac = crypto.createHmac('sha256', process.env.OAUTH_STATE_SECRET).update(anggotaId).digest('hex');
  return `${anggotaId}.${hmac}`;
}

function verifyState(state) {
  if (!state) return null;
  const idx = state.lastIndexOf('.');
  if (idx === -1) return null;
  const anggotaId = state.slice(0, idx);
  const hmac = state.slice(idx + 1);
  const expected = crypto.createHmac('sha256', process.env.OAUTH_STATE_SECRET).update(anggotaId).digest('hex');
  const a = Buffer.from(hmac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return anggotaId;
}

async function exchangeCodeForTokens(code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google token exchange gagal: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Google refresh gagal: ${res.status} ${JSON.stringify(data)}`);
    err.googleError = data.error;
    throw err;
  }
  return data;
}

// Ambil access_token yang valid untuk 1 anggota: pakai yang tersimpan kalau belum
// mau expired, else refresh dulu dan simpan hasilnya. Return null kalau anggota
// belum connect / statusnya bukan 'connected'. Auto-disconnect kalau Google bilang
// invalid_grant (token dicabut manual oleh user lewat akun Google-nya).
async function getValidAccessToken(anggotaId) {
  const rows = await sbSelect('google_tokens', { anggota_id: `eq.${anggotaId}`, select: '*' });
  const row = rows && rows[0];
  if (!row || row.status !== 'connected') return null;

  const bufferMs = 5 * 60 * 1000;
  if (Date.now() < new Date(row.expires_at).getTime() - bufferMs) {
    return row.access_token;
  }

  try {
    const refreshed = await refreshAccessToken(row.refresh_token);
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await sbUpdate('google_tokens', { anggota_id: `eq.${anggotaId}` }, {
      access_token: refreshed.access_token,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
    return refreshed.access_token;
  } catch (err) {
    if (err.googleError === 'invalid_grant') {
      await sbUpdate('google_tokens', { anggota_id: `eq.${anggotaId}` }, {
        status: 'disconnected',
        last_error: 'invalid_grant saat refresh (kemungkinan akses dicabut dari akun Google)',
        updated_at: new Date().toISOString(),
      });
      await sbUpdate('anggota', { id: `eq.${anggotaId}` }, { google_connected: false });
    }
    throw err;
  }
}

async function createCalendarEvent(accessToken, { summary, description, startDate, endDateExclusive }) {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description,
      start: { date: startDate },
      end: { date: endDateExclusive },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google create event gagal: ${res.status} ${JSON.stringify(data)}`);
  return data;
}

async function deleteCalendarEvent(accessToken, eventId) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404/410 berarti event sudah tidak ada (mis. dihapus manual oleh PJ) -- anggap sukses, bukan error.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google delete event gagal: ${res.status} ${text}`);
  }
}

// Orkestrasi 1 (tugas, penanggung jawab) -> 1 event kalender: ambil token PJ
// itu, buat event, simpan hasilnya ke baris tugas_pj-nya. Dipakai baik saat
// tugas baru dibuat (1x per assignee) maupun saat backfill tugas lama begitu
// seorang anggota baru connect. Aman dipanggil berkali-kali (idempotent di
// level pemanggil -- pemanggil yang cek calendar_event_id sudah ada atau belum).
async function syncTaskCalendarEvent(task, pj) {
  const accessToken = await getValidAccessToken(pj.anggota_id);
  if (!accessToken) {
    await sbUpdate('tugas_pj', { id: `eq.${pj.id}` }, { calendar_status: 'skipped_not_connected' });
    return 'skipped_not_connected';
  }

  try {
    const event = await createCalendarEvent(accessToken, {
      summary: task.nama,
      description: task.deskripsi || '',
      startDate: task.tanggal_mulai,
      endDateExclusive: addDays(task.tanggal_selesai, 1),
    });
    await sbUpdate('tugas_pj', { id: `eq.${pj.id}` }, {
      calendar_status: 'created',
      calendar_event_id: event.id,
      calendar_error: null,
    });
    return 'created';
  } catch (err) {
    console.error(`syncTaskCalendarEvent: gagal buat event utk tugas ${task.id} (pj ${pj.anggota_id}):`, err);
    await sbUpdate('tugas_pj', { id: `eq.${pj.id}` }, {
      calendar_status: 'failed',
      calendar_error: String((err && err.message) || err),
    });
    return 'failed';
  }
}

// Kebalikan dari syncTaskCalendarEvent -- dipanggil saat tugas dibatalkan.
// Tidak melempar error ke pemanggil: kegagalan hapus event (mis. PJ sudah
// disconnect, atau token expired) tidak boleh menggagalkan proses pembatalan
// tugas itu sendiri, cukup dicatat lewat calendar_status/calendar_error.
async function cancelTaskCalendarEvent(pj) {
  if (!pj.calendar_event_id) {
    return 'skipped_no_event';
  }

  const accessToken = await getValidAccessToken(pj.anggota_id);
  if (!accessToken) {
    return 'skipped_not_connected';
  }

  try {
    await deleteCalendarEvent(accessToken, pj.calendar_event_id);
    await sbUpdate('tugas_pj', { id: `eq.${pj.id}` }, {
      calendar_status: 'canceled',
      calendar_event_id: null,
      calendar_error: null,
    });
    return 'deleted';
  } catch (err) {
    console.error(`cancelTaskCalendarEvent: gagal hapus event utk tugas_pj ${pj.id}:`, err);
    await sbUpdate('tugas_pj', { id: `eq.${pj.id}` }, {
      calendar_error: String((err && err.message) || err),
    });
    return 'failed';
  }
}

// Sama seperti syncTaskCalendarEvent, tapi buat PEMBUAT tugas (bukan
// penanggung jawab) -- hasilnya disimpan di kolom creator_calendar_* di
// tugas langsung (bukan tugas_pj), karena cuma ada 1 pembuat per tugas.
// Pemanggil WAJIB cek dulu pembuat bukan salah satu penanggung jawab juga
// (supaya tidak dobel event kalau dia assign tugas ke dirinya sendiri).
async function syncCreatorCalendarEvent(task, creatorAnggotaId) {
  const accessToken = await getValidAccessToken(creatorAnggotaId);
  if (!accessToken) {
    await sbUpdate('tugas', { id: `eq.${task.id}` }, { creator_calendar_status: 'skipped_not_connected' });
    return 'skipped_not_connected';
  }

  try {
    const event = await createCalendarEvent(accessToken, {
      summary: task.nama,
      description: task.deskripsi || '',
      startDate: task.tanggal_mulai,
      endDateExclusive: addDays(task.tanggal_selesai, 1),
    });
    await sbUpdate('tugas', { id: `eq.${task.id}` }, {
      creator_calendar_status: 'created',
      creator_calendar_event_id: event.id,
      creator_calendar_error: null,
    });
    return 'created';
  } catch (err) {
    console.error(`syncCreatorCalendarEvent: gagal buat event utk tugas ${task.id} (creator ${creatorAnggotaId}):`, err);
    await sbUpdate('tugas', { id: `eq.${task.id}` }, {
      creator_calendar_status: 'failed',
      creator_calendar_error: String((err && err.message) || err),
    });
    return 'failed';
  }
}

// Kebalikan dari syncCreatorCalendarEvent, dipanggil saat tugas dibatalkan.
async function cancelCreatorCalendarEvent(task, creatorAnggotaId) {
  if (!task.creator_calendar_event_id) {
    return 'skipped_no_event';
  }

  const accessToken = await getValidAccessToken(creatorAnggotaId);
  if (!accessToken) {
    return 'skipped_not_connected';
  }

  try {
    await deleteCalendarEvent(accessToken, task.creator_calendar_event_id);
    await sbUpdate('tugas', { id: `eq.${task.id}` }, {
      creator_calendar_status: 'canceled',
      creator_calendar_event_id: null,
      creator_calendar_error: null,
    });
    return 'deleted';
  } catch (err) {
    console.error(`cancelCreatorCalendarEvent: gagal hapus event utk tugas ${task.id}:`, err);
    await sbUpdate('tugas', { id: `eq.${task.id}` }, {
      creator_calendar_error: String((err && err.message) || err),
    });
    return 'failed';
  }
}

module.exports = {
  buildAuthUrl,
  signState,
  verifyState,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken,
  createCalendarEvent,
  deleteCalendarEvent,
  syncTaskCalendarEvent,
  cancelTaskCalendarEvent,
  syncCreatorCalendarEvent,
  cancelCreatorCalendarEvent,
};
