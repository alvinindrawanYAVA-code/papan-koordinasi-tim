// lib/auth.mjs -- versi Netlify Functions (Web-standard Request) dari
// lib/auth.js. Dibuat sebagai file TERPISAH (bukan mengubah lib/auth.js di
// tempat) supaya api/*.js lama yang masih dipakai Vercel selama masa
// verifikasi paralel migrasi Netlify tidak ikut rusak -- lihat CHANGELOG.md
// "Migrasi Netlify". Logika verifikasi SAMA PERSIS dengan lib/auth.js,
// cuma cara baca header request & cara menyampaikan kegagalan yang beda
// (balikin Response langsung, bukan mutasi objek res ala Vercel).
import supabaseAdmin from './supabaseAdmin.js';
const { sbSelect } = supabaseAdmin;
import { json } from './httpResponse.mjs';

// Verifikasi lewat REST call ke /auth/v1/user (bukan verifikasi JWT lokal) supaya tidak
// bergantung ke jenis signing key project (Supabase sedang migrasi sebagian project dari
// HS256 ke ES256) -- call ini sekalian membuktikan token belum expired/di-revoke.
async function verifySession(req) {
  const authHeader = req.headers.get('authorization') || '';
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

// Guard dipakai di awal handler yang butuh identitas terverifikasi. Beda
// dari lib/auth.js (yang mengembalikan null lalu caller `if (!auth) return`
// karena res sudah dikirim di dalam sini) -- versi ini mengembalikan
// `Response` siap-pakai kalau gagal, caller cukup
// `if (auth instanceof Response) return auth;`.
async function requireAuth(req) {
  const user = await verifySession(req);
  if (!user) return json(401, { error: 'Belum login / sesi tidak valid' });

  const anggota = await resolveAnggota(user);
  if (!anggota) return json(403, { error: 'Akun ini belum terdaftar sebagai anggota tim' });

  return { user, anggota };
}

export { verifySession, resolveAnggota, requireAuth };
