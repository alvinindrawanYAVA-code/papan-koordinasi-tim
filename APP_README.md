# Papan Koordinasi Tim

Aplikasi web sederhana untuk tim kecil yang selama ini koordinasi tugas lewat WhatsApp. Semua orang bisa langsung lihat siapa mengerjakan apa tanpa scroll chat.

## Fitur

- **Layout dashboard modern**: sidebar navigasi (Ringkasan, Tambah Tugas, Tugas, Gantt Chart, Anggota Tim, Panduan) + area konten utama, kartu ringkasan berwarna (Total/Belum Mulai/Dikerjakan/Selesai)
- Kelola **Anggota Tim**: tambah/hapus nama + email anggota, jadi bisa dipilih sebagai penanggung jawab tugas — tampil sebagai tab tersendiri di sidebar (tidak numpuk di halaman utama biar tetap rapi walau anggotanya banyak)
- Tambah tugas: nama tugas, **deskripsi tambahan (opsional)**, **penanggung jawab (bisa pilih lebih dari 1 anggota sekaligus — 1 status dipakai bersama, bukan progres per-orang)**, **pembuat tugas (pilih dari Anggota Tim, untuk transparansi siapa yang assign)**, **periode pengerjaan (tanggal mulai & tanggal selesai, wajib diisi)**, dan status awal (Belum Mulai/Dikerjakan)
- Ubah status tugas antara **Belum Mulai**, **Dikerjakan**, dan **Selesai** — wajib isi link bukti kerja (mis. link Google Drive/foto yang sudah diupload ke tempat lain) saat ditandai **Selesai**
- **Prioritas tugas (wajib diisi)**: level prioritas (nama + warna) dikelola langsung lewat Supabase SQL Editor, **bukan** lewat tab sidebar (tab "Prioritas" sudah dihapus dari UI atas permintaan user — lihat CHANGELOG.md) — beda dari status yang cuma 3 nilai tetap. Tiap tugas **wajib** diberi 1 level prioritas saat dibuat (submit "Tambah Tugas" ditolak kalau belum dipilih — sama seperti penanggung jawab), tampil sebagai badge warna di kartu tugas & Gantt Chart, bisa dipakai buat menyortir (kartu di Papan diurutkan sesuai level, tertinggi dulu) dan menyaring papan/Gantt/ringkasan lewat filter "Prioritas". **Cuma pembuat tugas atau siapa pun yang terakhir men-set prioritas tugas itu** yang boleh mengubahnya — beda dari ubah status yang juga boleh dilakukan penanggung jawab. Tugas lama (dibuat sebelum fitur ini wajib) atau yang level prioritasnya sudah dihapus tetap bisa berstatus "Tanpa Prioritas".
- **2 cara lihat tugas**: tampilan **Papan** (kolom per status) atau **Gantt Chart** (bar per tugas di sepanjang sumbu waktu mingguan, warna sesuai status) — tinggal toggle
- **Filter "Lihat Sebagai"**: pilih nama anggota di sidebar untuk menyaring papan/Gantt/ringkasan supaya cuma menampilkan tugas yang terkait dia (di-assign ke dia ATAU dibuat olehnya); pilih "🔍 Semua Tugas" untuk lihat semuanya lagi. Filter ini juga menentukan siapa yang boleh klik tombol "Kirim Pengingat" (lihat di bawah) — bukan sistem login sungguhan, cuma pembatas kenyamanan di UI karena app ini belum punya autentikasi.
- **Notifikasi email otomatis saat tugas dibuat**: email rincian tugas (semacam tanda terima) otomatis dikirim ke **setiap** penanggung jawab (masing-masing dapat email sendiri-sendiri) lewat EmailJS begitu tugas baru dibuat (lihat setup di bawah)
- **Pengingat deadline**: 2 jalur — (1) tombol "🔔 Kirim Pengingat" manual di kartu tugas yang belum Selesai, khusus untuk anggota yang sedang dipilih di "Lihat Sebagai" DAN merupakan pembuat tugas itu, klik kapan pun dirasa perlu; (2) **reminder overdue otomatis lewat Vercel Cron**, jalan 1x/hari tapi cuma benar-benar kirim email tiap **3 hari sekali per tugas** (hari-0 = tepat di tanggal deadline, lalu hari-3, hari-6, dst, selama status belum Selesai/Dibatalkan) — bukan tiap hari seperti versi awal, supaya kuota EmailJS gratis (±200 email/bulan) tidak cepat terkuras kalau tugas overdue menumpuk. Kedua jalur ini mengirim ke **semua** penanggung jawab tugas itu. Tidak ada lagi reminder H-2 (sebelum deadline). Kebijakan notifikasi email di app ini sengaja dibatasi cuma 4 pemicu: tugas baru dibuat, klik "Kirim Pengingat", tugas ditandai Selesai, dan reminder overdue otomatis ini — lihat [CHANGELOG.md](./CHANGELOG.md) untuk riwayat lengkapnya.
- **Data tersinkron real-time**: semua anggota tim melihat papan yang sama secara langsung lewat Supabase Realtime — begitu satu orang tambah/ubah tugas, orang lain yang sedang membuka halaman langsung lihat perubahannya tanpa perlu refresh
- **Auto-assign ke Google Calendar pribadi**: begitu tugas dibuat, otomatis muncul sebagai event all-day (bisa membentang beberapa hari sesuai periode pengerjaan) di kalender Google **masing-masing** penanggung jawab yang sudah connect (1 event per orang, independen — kalau salah satu belum connect, yang lain tetap dapat event-nya) lewat panel Anggota Tim (sekali connect, berlaku seterusnya). **Backfill otomatis**: kalau seorang anggota baru connect *setelah* beberapa tugas sudah di-assign ke dia, tugas-tugas lama yang masih aktif (belum Selesai) otomatis ikut dibuatkan event begitu dia selesai connect — tidak perlu dibuat ulang manual.

## Cara Pakai

Buka `index.html` langsung di browser (double click, atau lewat live server jika ada), atau lewat link Vercel yang sudah di-deploy. Tidak perlu instalasi tambahan.

Data tugas dan anggota tim disimpan di **database bersama (Supabase)**, bukan di browser masing-masing — artinya siapa pun yang buka link aplikasi ini (dari perangkat apa saja) akan melihat data yang sama, dan perubahan oleh satu orang langsung terlihat oleh yang lain. Bukti kerja disimpan sebagai **link/URL saja** (bukan file), supaya tidak membebani kuota database — file buktinya sendiri perlu diupload dulu ke tempat lain (Google Drive, WhatsApp, dll) baru link-nya ditempel di sini.

Catatan: aplikasi ini belum punya sistem login/akun. Siapa pun yang punya link bisa menambah anggota, membuat tugas, dan mengubah status tugas apa saja — cocok untuk tim kecil yang saling percaya, belum untuk skala dengan kontrol akses ketat.

## Setup Notifikasi Email (EmailJS)

Notifikasi email **opsional** — kalau belum di-setup, aplikasi tetap jalan normal (tugas tetap bisa ditambah), cuma email tidak terkirim. Untuk mengaktifkannya:

1. Daftar akun gratis di [emailjs.com](https://www.emailjs.com/) (gratis sampai ±200 email/bulan).
2. Di dashboard EmailJS, buka **Email Services** → **Add New Service** → pilih **Gmail**, lalu hubungkan/login dengan akun Gmail yang mau jadi pengirim. Catat **Service ID**-nya.
3. Buka **Email Templates** → **Create New Template**. Isi subjek & isi email bebas, tapi gunakan variabel berikut supaya rincian tugas otomatis terisi (contoh isi template ada di bawah). Catat **Template ID**-nya.
   - Mau tampilan siap pakai bergaya "struk" (badge centang, kotak rincian tugas, tombol buka papan)? Buka editor template EmailJS, klik ikon **`<>` Code Editor**, lalu tempel isi file [`email-template.html`](./email-template.html) dari repo ini (ganti dulu URL di tombol "Buka Papan Koordinasi Tim" dengan link Vercel Anda).
   - **Kalau template Anda sudah pernah dibuat sebelumnya** (sebelum field Deskripsi ini ada): tempel ulang isi `email-template.html` yang terbaru, atau cukup tambahkan sendiri baris `{{task_description}}` di template lama Anda supaya deskripsi tugas ikut muncul di email.
4. Buka **Account** → **General**, catat **Public Key**-nya.
5. Buka `index.html`, cari bagian `EMAILJS_CONFIG` di dalam tag `<script>` paling bawah, lalu ganti 3 nilainya:
   ```js
   const EMAILJS_CONFIG = {
     publicKey: 'PASTE_PUBLIC_KEY_DI_SINI',
     serviceId: 'PASTE_SERVICE_ID_DI_SINI',
     templateId: 'PASTE_TEMPLATE_ID_DI_SINI'
   };
   ```
6. Simpan, refresh halaman, coba tambah 1 tugas — email harus masuk ke inbox penanggung jawabnya (cek folder spam kalau belum muncul).

**Variabel yang tersedia untuk template email:**

| Variabel | Isi |
|---|---|
| `{{to_email}}` | Email penanggung jawab (tujuan email) |
| `{{to_name}}` | Nama penanggung jawab |
| `{{task_name}}` | Nama tugas |
| `{{task_description}}` | Deskripsi/detail tambahan tugas (isi `-` kalau kosong) |
| `{{task_creator}}` | Nama yang membuat/assign tugas |
| `{{task_status}}` | Status awal tugas |
| `{{task_start}}` | Tanggal mulai pengerjaan |
| `{{task_end}}` | Tanggal selesai pengerjaan |
| `{{created_at}}` | Tanggal tugas dibuat |

Contoh isi template:
```
Subjek: Tugas Baru: {{task_name}}

Halo {{to_name}},

Kamu ditugaskan untuk: {{task_name}}
Deskripsi: {{task_description}}
Ditugaskan oleh: {{task_creator}}
Periode pengerjaan: {{task_start}} – {{task_end}}
Status saat ini: {{task_status}}
Dibuat pada: {{created_at}}

- Papan Koordinasi Tim
```

## Setup Database (Supabase)

Aplikasi ini butuh 1 project Supabase (gratis) sebagai database bersama. Kalau mau bikin ulang dari nol (misal pindah ke akun lain):

1. Daftar/login di [supabase.com](https://supabase.com), buat **New project** (catat nama, region terdekat misal Southeast Asia/Singapore).
2. Buka **SQL Editor**, jalankan skrip untuk membuat tabel `anggota` dan `tugas` beserta kebijakan Row Level Security (akses baca/tulis terbuka, karena app belum punya sistem login):
   ```sql
   create table anggota (id uuid primary key default gen_random_uuid(), nama text not null, email text not null, created_at timestamptz not null default now(), google_connected boolean not null default false, google_connected_at timestamptz);
   create table tugas (id uuid primary key default gen_random_uuid(), nama text not null, deskripsi text, dibuat_oleh text not null, status text not null default 'Belum Mulai', bukti text, tanggal_mulai date not null, tanggal_selesai date not null, dibuat_pada timestamptz not null default now());
   alter table anggota enable row level security;
   alter table tugas enable row level security;
   create policy "anggota_select" on anggota for select using (true);
   create policy "anggota_insert" on anggota for insert with check (true);
   create policy "anggota_delete" on anggota for delete using (true);
   create policy "tugas_select" on tugas for select using (true);
   create policy "tugas_insert" on tugas for insert with check (true);
   create policy "tugas_update" on tugas for update using (true) with check (true);
   alter publication supabase_realtime add table tugas;
   alter publication supabase_realtime add table anggota;

   -- Penanggung jawab: 1 baris per (tugas, anggota) -- 1 tugas bisa punya lebih
   -- dari 1 penanggung jawab, masing-masing dilacak terpisah utk kalender & email.
   create table tugas_pj (id uuid primary key default gen_random_uuid(), tugas_id uuid not null references tugas(id) on delete cascade, anggota_id uuid not null references anggota(id) on delete cascade, nama text not null, email text not null, calendar_event_id text, calendar_status text, calendar_error text, notif_status text, reminder_overdue_last_sent_on date, unique (tugas_id, anggota_id));
   alter table tugas_pj enable row level security;
   create policy "tugas_pj_select" on tugas_pj for select using (true);
   create policy "tugas_pj_insert" on tugas_pj for insert with check (true);
   alter publication supabase_realtime add table tugas_pj;

   create table google_tokens (id uuid primary key default gen_random_uuid(), anggota_id uuid not null unique references anggota(id) on delete cascade, access_token text not null, refresh_token text not null, expires_at timestamptz not null, status text not null default 'connected', last_error text, connected_at timestamptz not null default now(), updated_at timestamptz not null default now());
   alter table google_tokens enable row level security;
   ```

   `google_tokens` **sengaja tidak diberi kebijakan RLS apa pun** (default-deny) — tabel ini menyimpan token OAuth Google dan cuma boleh diakses lewat `service_role` key dari server function, tidak pernah lewat publishable key yang ada di `index.html`.

   ```sql
   -- Prioritas: level custom, jumlah tak terbatas. TIDAK ada tab UI untuk kelola
   -- level (dihapus atas permintaan user) -- tambah/ubah/hapus/urutkan level
   -- dilakukan manual lewat Supabase SQL Editor. `urutan` menentukan urutan
   -- tampil/sort (0 = paling atas/prioritas tertinggi).
   create table prioritas (id uuid primary key default gen_random_uuid(), nama text not null, warna text not null, urutan integer not null default 0, dibuat_oleh text, created_at timestamptz not null default now());
   alter table prioritas enable row level security;
   create policy "prioritas_select" on prioritas for select using (true);
   create policy "prioritas_insert" on prioritas for insert with check (true);
   create policy "prioritas_update" on prioritas for update using (true) with check (true);
   create policy "prioritas_delete" on prioritas for delete using (true);
   alter publication supabase_realtime add table prioritas;

   -- Tugas: prioritas wajib diisi utk tugas BARU (ditegakkan client-side di form
   -- Tambah Tugas), tapi kolomnya tetap nullable di DB -- tugas lama (sebelum jadi
   -- wajib) otomatis tanpa prioritas, dan on delete set null: hapus 1 level
   -- prioritas TIDAK menghapus tugas, cuma melepas referensinya (tugas jadi
   -- "Tanpa Prioritas" lagi).
   alter table tugas add column prioritas_id uuid references prioritas(id) on delete set null;
   alter table tugas add column prioritas_diset_oleh text;
   ```

   Riwayat: sebelum fitur multi-assignee, kolom `penanggung_jawab`, `penanggung_jawab_email`, `penanggung_jawab_id`, `calendar_event_id`, `calendar_status`, `calendar_error`, `notif_status`, `reminder_overdue_last_sent_on` ada langsung di tabel `tugas` (1 penanggung jawab per tugas). Sekarang semuanya pindah ke `tugas_pj` supaya 1 tugas bisa punya banyak penanggung jawab, masing-masing dengan status kalender/notifikasi sendiri. Lihat [CHANGELOG.md](./CHANGELOG.md) untuk SQL migrasinya kalau meng-upgrade instalasi lama.
3. Buka **Settings → API Keys**, catat **Project URL** dan **Publishable key**.
4. Buka `index.html`, cari bagian `SUPABASE_CONFIG` di dalam tag `<script>`, ganti 2 nilainya dengan punya Anda:
   ```js
   const SUPABASE_CONFIG = {
     url: 'URL_PROJECT_ANDA',
     publishableKey: 'PUBLISHABLE_KEY_ANDA'
   };
   ```

Tabel `tugas` sengaja tidak punya kebijakan **delete** (tidak ada fitur hapus tugas di aplikasi) — kalau perlu bersihkan data lewat Table Editor di dashboard Supabase.

## Setup Google Calendar & Reminder

Fitur ini **opsional** — kalau belum di-setup, tugas tetap bisa dibuat & dikelola seperti biasa, cuma tidak otomatis masuk kalender dan tombol "Kirim Pengingat" akan gagal terkirim. Fitur ini butuh backend kecil (folder `/api`) yang jalan di Vercel, beda dari sisa aplikasi yang murni `index.html` statis.

> **Catatan**: pengingat deadline sekarang **manual (tombol per tugas) + otomatis (cron overdue tiap 3 hari sekali)**, tidak lagi cron harian penuh (H-2 + overdue tiap hari) seperti versi paling awal — lihat [CHANGELOG.md](./CHANGELOG.md) untuk riwayat kenapa diubah (soal kuota EmailJS gratis).

**Prasyarat penting:** fitur kalender didesain untuk tim yang pakai **Google Workspace** (akun kantor yang di-manage lewat Google Workspace, bukan Gmail pribadi biasa). Kalau tim Anda pakai Gmail pribadi, Google otomatis mencabut akses kalender tiap 7 hari untuk app yang belum lolos verifikasi resmi Google — anggota akan perlu "Hubungkan ulang" tiap minggu. Dengan Workspace, koneksi sekali berlaku seterusnya.

### 1. Google Cloud Console (buat OAuth Client)

1. Buka [console.cloud.google.com](https://console.cloud.google.com), buat project baru (atau pakai yang sudah ada).
2. Buka **APIs & Services → Library**, cari **Google Calendar API**, klik **Enable**.
3. Buka **APIs & Services → OAuth consent screen**. Set **User Type = Internal** (cuma muncul kalau akun Anda bagian dari organisasi Google Workspace — ini yang menghindari masalah token 7 hari di atas). Isi nama app & email seadanya, tidak perlu submit untuk verifikasi karena mode Internal tidak melalui proses itu.
4. Buka **APIs & Services → Credentials → Create Credentials → OAuth client ID**, tipe **Web application**. Di **Authorized redirect URIs**, tambahkan:
   ```
   https://<domain-production-vercel-Anda>.vercel.app/api/google/callback
   ```
5. Catat **Client ID** dan **Client Secret** yang muncul.

> ⚠️ **Jebakan yang pernah kejadian**: pastikan `<domain-production-vercel-Anda>` di atas adalah domain **production publik** proyek (lihat di Vercel → **Settings → Domains** — biasanya `namaproyek.vercel.app` tanpa akhiran acak), **bukan** salah satu domain per-deployment yang muncul di halaman Deployment Details (yang formatnya `namaproyek-xxxxxxxx.vercel.app` dengan akhiran hash/nama acak). Domain per-deployment itu sering kali dilindungi Vercel SSO (butuh login akun Vercel tim untuk diakses) — kalau nilai ini salah pakai domain itu, alur connect akan tampak jalan sampai halaman consent Google, tapi begitu Google redirect balik, akan muncul halaman 404 dari Vercel (bukan error dari kode aplikasi ini), dan **tidak ada jejaknya sama sekali di Runtime Logs** karena request-nya tidak pernah sampai ke server aplikasi. Nilai `GOOGLE_REDIRECT_URI` di Vercel (langkah berikutnya) dan yang didaftarkan di sini **harus identik persis** — kalau salah satu diubah, ubah juga yang satunya.

### 2. Environment Variables di Vercel

Buka project di [vercel.com](https://vercel.com) → **Settings → Environment Variables**, tambahkan (scope **Production** saja):

| Nama | Isi |
|---|---|
| `SUPABASE_URL` | URL project Supabase Anda (sama seperti `SUPABASE_CONFIG.url` di `index.html`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dari Supabase **Settings → API Keys** (BUKAN publishable key — ini kunci penuh, jangan pernah taruh di `index.html`) |
| `GOOGLE_CLIENT_ID` | Dari langkah Google Cloud Console di atas |
| `GOOGLE_CLIENT_SECRET` | Dari langkah Google Cloud Console di atas |
| `GOOGLE_REDIRECT_URI` | `https://<domain-production-vercel-Anda>.vercel.app/api/google/callback` — **domain production publik**, sama persis dengan yang didaftarkan di Google Cloud Console (lihat catatan ⚠️ di atas) |
| `OAUTH_STATE_SECRET` | String acak bebas, minimal 32 karakter (dipakai untuk menandatangani parameter `state` OAuth) |
| `CRON_SECRET` | String acak bebas — dipakai `api/cron/check-deadlines.js` untuk verifikasi pemicu dari Vercel Cron (terdaftar di `vercel.json`, jalan otomatis 1x/hari) |
| `EMAILJS_SERVICE_ID` | Sama dengan `EMAILJS_CONFIG.serviceId` di `index.html` |
| `EMAILJS_PUBLIC_KEY` | Sama dengan `EMAILJS_CONFIG.publicKey` di `index.html` |
| `EMAILJS_PRIVATE_KEY` | Lihat langkah 3 di bawah |
| `EMAILJS_REMINDER_TEMPLATE_ID` | Lihat langkah 3 di bawah |

### 3. EmailJS — aktifkan akses server + buat template reminder

1. Dashboard EmailJS → **Account → Security**, aktifkan toggle **"Allow EmailJS API for non-browser applications"**, lalu catat **Private Key** yang muncul di halaman yang sama → isi ke `EMAILJS_PRIVATE_KEY`.
2. **Email Templates → Create New Template** (ini template ke-2, akun gratis EmailJS maksimal 2 template — cukup karena tombol "Kirim Pengingat" manual pakai 1 template ini untuk semua kasus, cuma beda teks lewat variabel).
3. Klik ikon **`<>` Code Editor**, tempel isi file [`email-template-reminder.html`](./email-template-reminder.html) dari repo ini.
4. Catat **Template ID**-nya → isi ke `EMAILJS_REMINDER_TEMPLATE_ID`.

### 4. Deploy & aktifkan

Setelah SQL migration (bagian Supabase di atas, termasuk tabel `google_tokens`), semua env var di atas terisi, dan kode di-push — Vercel otomatis mendeteksi folder `/api` sebagai Serverless Functions, dan `vercel.json` mendaftarkan `/api/cron/check-deadlines` untuk jalan otomatis 1x/hari (Vercel Cron), tidak perlu setting tambahan. Endpoint ini sendiri cuma benar-benar kirim email tiap 3 hari sekali per tugas overdue (lihat [CHANGELOG.md](./CHANGELOG.md)), jadi pengecekan hariannya ringan buat kuota EmailJS meski cron-nya sendiri jalan tiap hari.

Tiap anggota tim tinggal klik **"📅 Hubungkan Google Calendar"** di panel Anggota Tim (sekali saja, per orang) untuk mengaktifkan auto-assign kalender untuk tugas yang di-assign ke mereka (termasuk tugas lama yang sudah ada sebelum mereka connect — lihat fitur backfill di atas).

## Teknologi

Halaman utama `index.html` berisi HTML, CSS, dan JavaScript biasa, tanpa framework, ditambah 2 dependency eksternal via CDN: [EmailJS SDK](https://www.emailjs.com/) untuk notifikasi email, dan [Supabase JS SDK](https://supabase.com/docs/reference/javascript) untuk database bersama real-time. Font judul pakai [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) dari Google Fonts.

Untuk fitur Google Calendar & pengingat, ada tambahan backend kecil (Vercel Serverless Functions, Node.js polos tanpa dependency npm) di folder `/lib` (helper) dan `/api` (endpoint: `google/connect`, `google/callback`, `google/disconnect`, `google/create-event`, `reminder/send`, `cron/check-deadlines`). Ini satu-satunya bagian aplikasi yang tidak murni static site.

## Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Buka [vercel.com](https://vercel.com), klik **Add New → Project**.
3. Pilih repo ini, klik **Import**.
4. Biarkan pengaturan default, klik **Deploy** (Vercel otomatis mendeteksi folder `/api` sebagai Serverless Functions, tidak perlu konfigurasi tambahan).
5. Setelah build selesai (~1 menit), aplikasi live di `namaproyek.vercel.app` — **catat domain persis ini**, dipakai lagi di langkah OAuth Google berikutnya.
6. Kalau mau aktifkan fitur Google Calendar & reminder, lanjutkan ke bagian "Setup Google Calendar & Reminder" di atas (isi environment variables dulu, baru fiturnya aktif) — perhatikan baik-baik catatan ⚠️ soal domain redirect URI supaya tidak kejadian error 404 seperti yang pernah terjadi.
