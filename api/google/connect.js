const { sbSelect } = require('../../lib/supabaseAdmin');
const { buildAuthUrl, signState } = require('../../lib/google');

module.exports = async (req, res) => {
  try {
    const anggotaId = req.query.anggotaId;
    if (!anggotaId) {
      res.status(400).send('anggotaId wajib diisi');
      return;
    }

    const rows = await sbSelect('anggota', { id: `eq.${anggotaId}`, select: 'id' });
    if (!rows || rows.length === 0) {
      res.status(404).send('Anggota tidak ditemukan');
      return;
    }

    const state = signState(anggotaId);
    res.redirect(buildAuthUrl(state));
  } catch (err) {
    console.error('google/connect error:', err);
    res.status(500).send('Terjadi kesalahan, coba lagi.');
  }
};
