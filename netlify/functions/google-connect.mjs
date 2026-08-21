import supabaseAdmin from '../../lib/supabaseAdmin.js';
const { sbSelect } = supabaseAdmin;
import googleLib from '../../lib/google.js';
const { buildAuthUrl, signState } = googleLib;
import { requireAuth } from '../../lib/auth.mjs';
import { json } from '../../lib/httpResponse.mjs';

// Dulu endpoint ini di-navigate langsung lewat <a href> (redirect ke Google).
// Sekarang balikin JSON {url} supaya bisa dipanggil lewat apiFetch (bawa
// Authorization header) -- tombol di index.html yang lakukan window.open(url).
export default async (req) => {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;

    const anggotaId = new URL(req.url).searchParams.get('anggotaId');
    if (!anggotaId) return json(400, { error: 'anggotaId wajib diisi' });
    // Cuma boleh menghubungkan Google Calendar milik sendiri.
    if (anggotaId !== auth.anggota.id) {
      return json(403, { error: 'Cuma boleh menghubungkan Google Calendar milik sendiri' });
    }

    const rows = await sbSelect('anggota', { id: `eq.${anggotaId}`, select: 'id' });
    if (!rows || rows.length === 0) return json(404, { error: 'Anggota tidak ditemukan' });

    const state = signState(anggotaId);
    return json(200, { url: buildAuthUrl(state) });
  } catch (err) {
    console.error('google/connect error:', err);
    return json(500, { error: 'Terjadi kesalahan, coba lagi.' });
  }
};

export const config = { path: '/api/google/connect' };
