const { sbSelect, sbUpdate } = require('../../lib/supabaseAdmin');
const { requireAuth } = require('../../lib/auth');

module.exports = async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const { anggotaId } = req.body || {};
    if (!anggotaId) {
      res.status(400).json({ error: 'anggotaId wajib diisi' });
      return;
    }
    // Cuma boleh memutuskan koneksi Google Calendar milik sendiri.
    if (anggotaId !== auth.anggota.id) {
      res.status(403).json({ error: 'Cuma boleh memutuskan koneksi Google Calendar milik sendiri' });
      return;
    }

    const rows = await sbSelect('google_tokens', {
      anggota_id: `eq.${anggotaId}`,
      select: 'refresh_token',
    });
    const refreshToken = rows && rows[0] && rows[0].refresh_token;

    if (refreshToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
          method: 'POST',
        });
      } catch (err) {
        console.error('google/disconnect: revoke ke Google gagal, tetap lanjut hapus token lokal:', err);
      }
    }

    await sbUpdate('google_tokens', { anggota_id: `eq.${anggotaId}` }, {
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    });
    await sbUpdate('anggota', { id: `eq.${anggotaId}` }, { google_connected: false });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('google/disconnect error:', err);
    res.status(500).json({ error: 'Gagal memutuskan koneksi' });
  }
};
