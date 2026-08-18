# Changelog — Papan Koordinasi Tim

Ringkasan kronologis pengembangan aplikasi ini beserta **alasan** di balik keputusan-keputusan besar, supaya konteksnya bisa ditelusuri lagi kalau suatu saat perlu update lanjutan — tanpa harus menggali ulang riwayat chat. Urut dari commit paling lama ke paling baru; hash commit disertakan supaya diff persisnya bisa dicek lewat `git show <hash>`.

## Fondasi awal

- `e6001ee` Papan Kanban dasar (localStorage, belum ada backend)
- `a10e82f` Bukti kerja wajib diisi saat tugas ditandai Selesai
- `51f7659` Pengisian link bukti dipindah supaya hanya lewat update status (bukan lagi field di form tambah tugas awal)
- `901d435` Tambah periode pengerjaan (tanggal mulai/selesai, wajib), panel Anggota Tim, notifikasi email lewat EmailJS (browser SDK)
- `900d2a6` **Migrasi localStorage → Supabase.** Masalah yang dipecahkan: anggota lain tidak bisa lihat/ubah tugas yang dibuat rekan kerja, karena data cuma tersimpan di browser masing-masing. Pindah ke Postgres bersama (Supabase) + Realtime subscription supaya semua orang lihat papan yang sama secara live tanpa refresh.

## Google Calendar + reminder otomatis (versi awal)

- `13bfa5e` Fitur besar: auto-assign tugas baru ke Google Calendar pribadi penanggung jawab (OAuth per-anggota), plus reminder email otomatis lewat Vercel Cron harian (H-2 sekali, overdue tiap hari sampai Selesai). Pakai mode Google Workspace "Internal" spesifik supaya token OAuth tidak dicabut otomatis tiap 7 hari (masalah yang cuma terjadi untuk app External/Testing mode). Env var & OAuth Client dikonfigurasi manual lewat Google Cloud Console + Vercel dashboard.

## Redesign visual (bertahap)

- `5f5c185` Kartu tugas & email dari flat jadi kartu beraksen warna per status + shadow
- `f8a27c9` Fix: hint "tambahkan anggota dulu" overlap dengan tombol Tambah Tugas (margin negatif keliru)
- `5b97ea0` Hapus subtitle header, judul dibuat lebih besar dengan animasi gradient
- `cebb7eb` Fix: tinggi tombol Tambah Anggota/Tugas tidak sama dengan input di sampingnya (beda box-model border)
- `3872ee7` Tambah tampilan **Gantt Chart** (bar per tugas sepanjang sumbu waktu mingguan), toggle Papan/Gantt
- `2917c19` Redesign besar: layout sidebar + konten (terinspirasi dashboard modern), font Plus Jakarta Sans, kartu ringkasan berwarna solid
- `1c15ee9` Redesign template email biar konsisten dgn tampilan app: hero banner warna, avatar inisial, grid info tiles

## Reminder: dari otomatis jadi manual

- `b286e9c` **Ganti reminder H-2/overdue otomatis jadi tombol "Kirim Pengingat" manual per tugas.** Alasan: EmailJS versi gratis dibatasi ±200 email/bulan; reminder harian otomatis berisiko menghabiskan kuota tanpa kontrol kalau tugas overdue menumpuk. Cron dinonaktifkan (dihapus dari `vercel.json`), tapi `api/cron/check-deadlines.js` **sengaja dipertahankan** di repo untuk diaktifkan lagi kalau suatu saat kuota bukan masalah. Ditambah dropdown "Login sebagai" di sidebar (localStorage per-browser, **bukan** autentikasi sungguhan) supaya tombol reminder cuma tampil untuk pembuat tugas terkait.

## Navigasi & filter

- `0e28fc4` Anggota Tim dipisah jadi tab tersendiri di sidebar (bukan bagian dari 1 halaman panjang) — mencegah halaman kepanjangan kalau anggota tim bertambah banyak
- `dbede6b` "Login sebagai" diperluas jadi filter Papan/Gantt/ringkasan (bukan cuma penentu tombol reminder) — pilih nama untuk menyaring tugas yang terkait dia (di-assign ke dia ATAU dibuat olehnya, union), atau pilih "🔍 Semua Tugas" untuk lihat semuanya lagi
- `7baa5b1` Daftar Anggota Tim dari chip horizontal (rawan overlap kalau nama/email panjang) jadi list vertikal penuh-lebar

## Bug fix produksi: Google Calendar 404 (redirect URI mismatch)

**Gejala**: klik "Hubungkan Google Calendar" → sampai halaman consent Google → approve → muncul 404 dari Vercel (bukan error dari kode aplikasi).

**Akar masalah**: `GOOGLE_REDIRECT_URI` (env var Vercel) dan "Authorized redirect URIs" (Google Cloud Console) sama-sama mengarah ke domain **per-deployment** (`papan-koordinasi-tim-qj2c-igk0iolab.vercel.app`) yang ternyata dilindungi Vercel SSO (butuh login akun Vercel tim), bukan domain **production publik** (`papan-koordinasi-tim-qj2c.vercel.app`). Karena domain tujuannya salah, request redirect dari Google tidak pernah sampai ke server aplikasi — makanya tidak ada jejaknya sama sekali di Vercel Runtime Logs, cuma 404 generik. Petunjuk kunci yang mengarahkan ke sini: log kosong untuk request ID yang dilaporkan user, padahal request lain (dgn parameter salah) muncul normal di log.

**Perbaikan**:
- `756bd56` + perubahan manual env var `GOOGLE_REDIRECT_URI` di Vercel dashboard, dan "Authorized redirect URIs" di Google Cloud Console → disamakan ke domain production yang benar
- Sekalian diperbaiki: link tombol CTA di kedua template email (`email-template.html`, `email-template-reminder.html`) yang kena bug domain identik
- `c729934` **Backfill kalender**: tugas yang dibuat *sebelum* penanggung jawabnya connect Google Calendar dulunya selamanya berstatus `skipped_not_connected`. Sekarang begitu dia connect, semua tugas lamanya yang masih aktif (belum Selesai) otomatis dibuatkan event kalender juga.

## Reminder overdue: dari nonaktif jadi otomatis lagi (3 hari sekali)

- `b30d8a0` **Aktifkan lagi `api/cron/check-deadlines.js`, tapi dengan cadence dikurangi.** User menetapkan kebijakan eksplisit: notifikasi email otomatis cuma boleh terkirim di 4 pemicu — tugas baru dibuat, klik "Kirim Pengingat" manual, tugas ditandai Selesai, dan reminder overdue otomatis ini. Reminder H-2 (sebelum deadline) dihapus dari cron ini karena tidak masuk daftar. Reminder overdue sekarang dikirim tiap **3 hari sekali per tugas** (hari-0 = tepat di tanggal deadline, lalu hari-3, hari-6, dst, berhenti kalau status jadi Selesai/Dibatalkan) — bukan tiap hari seperti versi awal (`13bfa5e`), supaya kuota EmailJS gratis (±200/bulan) tidak cepat habis kalau tugas overdue menumpuk. Terdaftar ulang di `vercel.json` sebagai Vercel Cron harian (cron-nya sendiri tetap jalan tiap hari untuk *mengecek*, tapi cuma benar-benar *kirim email* pada hari-hari kelipatan 3 itu). Notifikasi pembatalan tugas (`api/task/cancel.js`) sengaja dipertahankan meski tidak eksplisit di daftar 4 poin — dianggap setara "Kirim Pengingat" karena sama-sama dipicu klik tombol manual oleh pembuat tugas, bukan otomatis tanpa interaksi.

## Fakta teknis penting untuk update berikutnya

- **Domain production yang benar**: `https://papan-koordinasi-tim-qj2c.vercel.app` — cek selalu di Vercel → Settings → Domains sebelum mengisi `GOOGLE_REDIRECT_URI` atau link apa pun yang perlu publicly-accessible (jangan pernah pakai domain per-deployment dari halaman Deployment Details, formatnya `namaproyek-xxxxxxxx.vercel.app`, itu sering diproteksi SSO)
- **Supabase**: project `rqotdhrptadhsuvjhcoa`, tabel `anggota`, `tugas`, `google_tokens`. RLS terbuka untuk `anggota`/`tugas` (app belum ada login), `google_tokens` sengaja default-deny (cuma lewat `service_role` key di server)
- Tabel `tugas` pernah dikosongkan total via SQL Editor (permintaan user, mulai dari 0) — `anggota` dan koneksi Google Calendar tetap dipertahankan
- Event Google Calendar dibuat sebagai **all-day event** (`start.date`/`end.date`, bisa membentang beberapa hari sesuai periode pengerjaan), **bukan** Google Task, **bukan** event berjam-spesifik
- Semua jalur email (tugas baru, reminder manual, reminder overdue otomatis, notifikasi Selesai, notifikasi Batal) sama-sama pakai 1 kuota EmailJS gratis yang sama (±200/bulan) — reminder overdue otomatis sengaja dibuat 3 hari sekali (bukan tiap hari) supaya tidak mendominasi kuota itu kalau tugas overdue menumpuk
- Semua env var Vercel di-scope **Production only** (bukan Preview) — `redirect_uri` OAuth Google cuma valid untuk 1 domain persis
