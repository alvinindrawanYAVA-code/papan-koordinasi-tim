// lib/auth.js -- Verifikasi identitas pemanggil endpoint api/*.js lewat header
// Authorization: Bearer <supabase access token> yang dikirim client. Sesi login (Google
// Workspace lewat Supabase Auth) sepenuhnya dikelola Supabase -- di sini cuma perlu tahu
// SIAPA yang sah memanggil, terpisah total dari token Google Calendar di google_tokens
// (itu OAuth kedua yang berbeda tujuan, lihat lib/google.js).

const { sbSelect } = require('./supabaseAdmin');

// Verifikasi lewat REST call ke /auth/v1/user (bukan verifikasi JWT lokal) supaya tidak
// bergantung ke jenis signing key project (Supabase sedang migrasi sebagian project dari
// HS256 ke ES256) -- call ini sekalian membuktikan token belum expired/di-revoke.
async function verifySession(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;

  const res = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function resolveAnggota(user) {
  if (!user) return null;
  const rows = await sbSelect('anggota', { user_id: `eq.${user.id}`, select: '*' });
  return (rows && rows[0]) || null;
}

// Guard dipakai di awal handler yang butuh identitas terverifikasi -- pola early-return
// yang sama seperti validasi lain di api/*.js. Kalau gagal, response 401/403 sudah dikirim
// di sini, pemanggil tinggal `const auth = await requireAuth(req, res); if (!auth) return;`.
async function requireAuth(req, res) {
  const user = await verifySession(req);
  if (!user) {
    res.status(401).json({ error: 'Belum login / sesi tidak valid' });
    return null;
  }
  const anggota = await resolveAnggota(user);
  if (!anggota) {
    res.status(403).json({ error: 'Akun ini belum terdaftar sebagai anggota tim' });
    return null;
  }
  return { user, anggota };
}

module.exports = { verifySession, resolveAnggota, requireAuth };
