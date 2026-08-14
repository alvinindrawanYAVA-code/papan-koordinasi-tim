const { sbSelect, sbUpsert, sbUpdate } = require('../../lib/supabaseAdmin');
const { verifyState, exchangeCodeForTokens, syncTaskCalendarEvent } = require('../../lib/google');

module.exports = async (req, res) => {
  const { code, state, error: googleError } = req.query;

  if (googleError) {
    console.error('google/callback: Google mengembalikan error:', googleError);
    res.redirect('/?google=error');
    return;
  }

  const anggotaId = verifyState(state);
  if (!anggotaId || !code) {
    console.error('google/callback: state tidak valid atau code kosong');
    res.redirect('/?google=error');
    return;
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

    // Backfill: tugas lama milik anggota ini yang dulu dilewati karena belum
    // connect, sekarang dibuatkan event kalendernya juga. Kegagalan di sini
    // tidak menggagalkan proses connect -- token sudah tersimpan valid.
    try {
      const pendingTasks = await sbSelect('tugas', {
        penanggung_jawab_id: `eq.${anggotaId}`,
        calendar_status: 'eq.skipped_not_connected',
        status: 'neq.Selesai',
        tanggal_mulai: 'not.is.null',
        tanggal_selesai: 'not.is.null',
        select: '*',
      });
      for (const task of pendingTasks || []) {
        await syncTaskCalendarEvent(task);
      }
    } catch (err) {
      console.error('google/callback: gagal backfill event kalender tugas lama:', err);
    }

    res.redirect('/?google=connected');
  } catch (err) {
    console.error('google/callback error:', err);
    res.redirect('/?google=error');
  }
};
