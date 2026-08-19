const { sbSelect } = require('../../lib/supabaseAdmin');
const { buildAuthUrl, signState } = require('../../lib/google');
const { requireAuth } = require('../../lib/auth');

// Dulu endpoint ini di-navigate langsung lewat <a href> (redirect ke Google).
// Sekarang balikin JSON {url} supaya bisa dipanggil lewat apiFetch (bawa
// Authorization header) -- tombol di index.html yang lakukan window.open(url).
module.exports = async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const anggotaId = req.query.anggotaId;
    if (!anggotaId) {
      res.status(400).json({ error: 'anggotaId wajib diisi' });
      return;
    }
    // Cuma boleh menghubungkan Google Calendar milik sendiri.
    if (anggotaId !== auth.anggota.id) {
      res.status(403).json({ error: 'Cuma boleh menghubungkan Google Calendar milik sendiri' });
      return;
    }

    const rows = await sbSelect('anggota', { id: `eq.${anggotaId}`, select: 'id' });
    if (!rows || rows.length === 0) {
      res.status(404).json({ error: 'Anggota tidak ditemukan' });
      return;
    }

    const state = signState(anggotaId);
    res.status(200).json({ url: buildAuthUrl(state) });
  } catch (err) {
    console.error('google/connect error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan, coba lagi.' });
  }
};
