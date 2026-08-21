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

## Assign tugas ke multi user

- Ganti model penanggung jawab dari 1 kolom scalar di `tugas` (`penanggung_jawab`/`penanggung_jawab_email`/`penanggung_jawab_id` + `calendar_event_id`/`calendar_status`/`calendar_error`/`notif_status`/`reminder_overdue_last_sent_on`) jadi tabel relasi baru `tugas_pj` (1 baris per pasangan tugas-anggota). Keputusan desain (dikonfirmasi user lewat pertanyaan langsung): **1 status dipakai bersama** untuk semua penanggung jawab tugas itu (bukan progres per-orang), dan **semua penanggung jawab dapat email masing-masing** di keempat pemicu notifikasi (tugas baru, kirim pengingat, tugas selesai — ke pembuat, reminder overdue otomatis) — bukan cuma 1 "penanggung jawab utama".
- Form "Tambah Tugas": dropdown single-select PJ diganti jadi grup tombol chip yang bisa dipilih lebih dari satu (`.pj-multiselect`).
- Google Calendar: `syncTaskCalendarEvent`/`cancelTaskCalendarEvent` di `lib/google.js` sekarang beroperasi per-(tugas, PJ) — 1 event kalender independen per penanggung jawab yang sudah connect, bukan 1 event per tugas. Backfill di `api/google/callback.js` ikut disesuaikan (query lewat `tugas_pj.anggota_id`, bukan `tugas.penanggung_jawab_id`).
- Kartu tugas menampilkan 1 chip per penanggung jawab; Gantt chart menampilkan avatar penanggung jawab pertama + badge "+N" kalau lebih dari satu.
- Kolom lama di `tugas` sengaja **tidak langsung di-drop** saat migrasi (cukup `alter column ... drop not null` supaya insert baru tetap jalan tanpa mengisinya) — dibiarkan sebagai data historis, bisa di-drop belakangan kalau sudah yakin semua jalan lancar.

## Fitur Prioritas

- **Tambah tabel `prioritas`** (bukan enum tetap seperti `status`) karena user eksplisit minta **jumlah level tidak terbatas** — level dikelola sendiri lewat tab sidebar baru "Prioritas" (nama + warna dari palet swatch kurasi + urutan tampil/sort, bisa digeser naik/turun). `tugas` dapat 2 kolom baru: `prioritas_id` (nullable, `on delete set null` — hapus 1 level tidak menghapus tugasnya, cuma melepas referensi) dan `prioritas_diset_oleh` (nama anggota yang men-set/terakhir mengubah prioritas tugas itu).
- **Prioritas di tugas BARU wajib diisi** (diubah dari opsional setelah user klarifikasi ulang) — form "Tambah Tugas" menolak submit kalau `selectedPrioritasId` masih kosong, sama seperti penanggung jawab, dan picker prioritas di form itu SENGAJA tidak punya opsi "Tanpa Prioritas" (beda dari dropdown quick-edit di kartu tugas yang tetap punya opsi itu, karena tugas lama/level yang sudah dihapus tetap bisa berakhir tanpa prioritas lewat `on delete set null`). Kalau belum ada level prioritas sama sekali, hint di form mengarahkan user ke tab Prioritas dulu, dan submit tetap ditolak sampai minimal 1 level dibuat.
- **Wewenang ubah prioritas SENGAJA beda dari wewenang ubah status**: cuma pembuat tugas ATAU siapa pun yang men-set prioritas tugas itu (`prioritas_diset_oleh`) yang boleh mengubahnya — penanggung jawab TIDAK ikut boleh (beda dari `canEditStatus` yang mengizinkan penanggung jawab juga). Predikat ini ditegakkan client-side saja (badge read-only vs `<select>` editable, pola sama persis dengan status), konsisten dengan filosofi RLS terbuka yang sudah dipakai di seluruh app — tidak ada endpoint server baru karena ubah prioritas tidak punya efek samping (beda dari cancel/complete yang butuh `service_role` untuk cleanup kalender/email).
- **Warna level dinamis, bukan CSS var tetap**: karena jumlah level bebas, warna disimpan sebagai hex polos per baris (dipilih dari palet ~10 swatch kurasi saat bikin level), badge solid+soft dihitung di JS saat render (`softColorOf()`, campur manual ke arah putih) — bukan lewat `color-mix()` CSS supaya konsisten di semua browser.
- **Tampil di 4 tempat**: badge di kartu tugas (Papan, ganti jadi `<select>` kalau yang login berwenang), titik warna di dalam bar Gantt Chart (bukan border-left — `.gantt-bar` bentuknya pill penuh/`border-radius:999px`, border-left tidak akan kelihatan jelas di situ), sort utama tiap kolom Papan (level tertinggi/urutan teratas duluan, tugas tanpa prioritas selalu di bawah), dan baris ringkasan jumlah per level (`.prioritas-summary-row`, flex-wrap chip — bukan ditambahkan ke grid `.stats-row` yang 4 kolom tetap, karena jumlah level tidak terbatas).
- **Keputusan sort Gantt** (dikonfirmasi user lewat pertanyaan langsung): tanggal tetap jadi sort utama di Gantt (nilai inti tampilan Gantt adalah garis waktu kronologis), prioritas cuma dipakai sebagai tie-breaker kalau 2 tugas mulai di tanggal yang sama persis — beda dari Papan yang prioritas jadi sort utama.
- Filter baru "Prioritas" ditambahkan di `.tugas-filter-bar` (sebelah "Lihat Sebagai"/"Tampilkan"), komposisi AND dengan filter yang sudah ada di `getVisibleTasks()`.

## Fakta teknis penting untuk update berikutnya

- **Domain production yang benar**: `https://papan-koordinasi-tim-qj2c.vercel.app` — cek selalu di Vercel → Settings → Domains sebelum mengisi `GOOGLE_REDIRECT_URI` atau link apa pun yang perlu publicly-accessible (jangan pernah pakai domain per-deployment dari halaman Deployment Details, formatnya `namaproyek-xxxxxxxx.vercel.app`, itu sering diproteksi SSO)
- **Supabase**: project `rqotdhrptadhsuvjhcoa`, tabel `anggota`, `tugas`, `tugas_pj`, `prioritas`, `google_tokens`. RLS terbuka untuk `anggota`/`tugas`/`tugas_pj`/`prioritas` (app belum ada kontrol akses ketat di level DB, cuma gating UI), `google_tokens` sengaja default-deny (cuma lewat `service_role` key di server)
- Tabel `tugas` pernah dikosongkan total via SQL Editor (permintaan user, mulai dari 0) — `anggota` dan koneksi Google Calendar tetap dipertahankan
- Event Google Calendar dibuat sebagai **all-day event** (`start.date`/`end.date`, bisa membentang beberapa hari sesuai periode pengerjaan), **bukan** Google Task, **bukan** event berjam-spesifik
- Semua jalur email (tugas baru, reminder manual, reminder overdue otomatis, notifikasi Selesai, notifikasi Batal) sama-sama pakai 1 kuota EmailJS gratis yang sama (±200/bulan) — reminder overdue otomatis sengaja dibuat 3 hari sekali (bukan tiap hari) supaya tidak mendominasi kuota itu kalau tugas overdue menumpuk
- Semua env var Vercel di-scope **Production only** (bukan Preview) — `redirect_uri` OAuth Google cuma valid untuk 1 domain persis
