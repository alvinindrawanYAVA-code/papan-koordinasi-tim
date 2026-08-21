import supabaseAdmin from '../../lib/supabaseAdmin.js';
const { sbSelect, sbUpsert, sbUpdate } = supabaseAdmin;
import googleLib from '../../lib/google.js';
const { verifyState, exchangeCodeForTokens, syncTaskCalendarEvent, syncCreatorCalendarEvent } = googleLib;

// Target redirect langsung dari Google (browser navigate, bukan lewat
// apiFetch) -- makanya TIDAK ada requireAuth di sini, identitas anggota
// ditentukan dari `state` yang di-sign sendiri oleh api/google/connect.js.
function redirect(path, req) {
  return Response.redirect(new URL(path, req.url).toString(), 302);
}

export default async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const googleError = url.searchParams.get('error');

  if (googleError) {
    console.error('google/callback: Google mengembalikan error:', googleError);
    return redirect('/?google=error', req);
  }

  const anggotaId = verifyState(state);
  if (!anggotaId || !code) {
    console.error('google/callback: state tidak valid atau code kosong');
    return redirect('/?google=error', req);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Google kadang tidak mengirim refresh_token baru saat re-consent -- kalau
    // begitu, pertahankan yang sudah tersimpan, jangan pernah timpa dengan null.
    let refreshToken = tokens.refresh_token;
    if (!refreshToken) {
      const existing = await sbSelect('google_tokens', {
        anggota_id: `eq.${anggotaId}`,
        select: 'refresh_token',
      });
      refreshToken = existing && existing[0] && existing[0].refresh_token;
    }
    if (!refreshToken) {
      throw new Error('Tidak ada refresh_token dari Google dan tidak ada yang tersimpan sebelumnya');
    }

    await sbUpsert(
      'google_tokens',
      {
        anggota_id: anggotaId,
        access_token: tokens.access_token,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        status: 'connected',
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      'anggota_id'
    );

    await sbUpdate(
      'anggota',
      { id: `eq.${anggotaId}` },
      { google_connected: true, google_connected_at: new Date().toISOString() }
    );

    // Backfill: tugas lama yang anggota ini di-assign, dulu dilewati karena belum
    // connect, sekarang dibuatkan event kalendernya juga. Kegagalan di sini
    // tidak menggagalkan proses connect -- token sudah tersimpan valid.
    try {
      const pendingPj = await sbSelect('tugas_pj', {
        anggota_id: `eq.${anggotaId}`,
        calendar_status: 'eq.skipped_not_connected',
        select: '*,tugas(*)',
      });
      for (const pj of pendingPj || []) {
        const task = pj.tugas;
        if (!task || task.status === 'Selesai' || !task.tanggal_mulai || !task.tanggal_selesai) continue;
        await syncTaskCalendarEvent(task, pj);
      }
    } catch (err) {
      console.error('google/callback: gagal backfill event kalender tugas lama:', err);
    }

    // Backfill juga buat tugas-tugas LAMA yang dia BUAT (bukan cuma yang di-assign
    // ke dia) -- nama dulu, karena dibuat_oleh nyimpan nama teks, bukan anggota_id.
    try {
      const anggotaRows = await sbSelect('anggota', { id: `eq.${anggotaId}`, select: 'nama' });
      const anggotaNama = anggotaRows && anggotaRows[0] && anggotaRows[0].nama;
      if (anggotaNama) {
        const createdTasks = await sbSelect('tugas', {
          dibuat_oleh: `eq.${anggotaNama}`,
          status: 'neq.Selesai',
          creator_calendar_event_id: 'is.null',
          tanggal_mulai: 'not.is.null',
          tanggal_selesai: 'not.is.null',
          select: '*, tugas_pj(*)',
        });
        for (const task of createdTasks || []) {
          const isAlsoPj = (task.tugas_pj || []).some(pj => pj.anggota_id === anggotaId);
          if (isAlsoPj) continue; // sudah/akan dapat event lewat backfill PJ di atas
          await syncCreatorCalendarEvent(task, anggotaId);
        }
      }
    } catch (err) {
      console.error('google/callback: gagal backfill event kalender tugas yang dia buat:', err);
    }

    return redirect('/?google=connected', req);
  } catch (err) {
    console.error('google/callback error:', err);
    return redirect('/?google=error', req);
  }
};

export const config = { path: '/api/google/callback' };
