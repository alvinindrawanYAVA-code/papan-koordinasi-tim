# Papan Koordinasi Tim

Aplikasi web sederhana untuk tim kecil yang selama ini koordinasi tugas lewat WhatsApp. Semua orang bisa langsung lihat siapa mengerjakan apa tanpa scroll chat.

## Fitur

- Kelola **Anggota Tim**: tambah/hapus nama + email anggota, jadi bisa dipilih sebagai penanggung jawab tugas
- Tambah tugas: nama tugas, penanggung jawab (pilih dari Anggota Tim), **pembuat tugas (pilih dari Anggota Tim, untuk transparansi siapa yang assign)**, **periode pengerjaan (tanggal mulai & tanggal selesai, wajib diisi)**, dan status awal (Belum Mulai/Dikerjakan)
- Ubah status tugas antara **Belum Mulai**, **Dikerjakan**, dan **Selesai**
- Semua tugas tampil dalam satu layar, dikelompokkan per status, lengkap dengan periode tanggal pengerjaannya
- Saat tugas ditandai **Selesai** (lewat dropdown status pada tugasnya), wajib isi link bukti kerja (mis. link Google Drive/foto/dokumen yang sudah diupload ke tempat lain) sebagai bukti tugas benar-benar sudah dikerjakan
- **Notifikasi email otomatis**: begitu tugas baru dibuat, email berisi rincian tugas (semacam tanda terima/receipt) otomatis dikirim ke alamat email penanggung jawab, lewat EmailJS (lihat setup di bawah)
- **Data tersinkron real-time**: semua anggota tim melihat papan yang sama secara langsung — begitu satu orang tambah/ubah tugas, orang lain yang sedang membuka halaman langsung lihat perubahannya tanpa perlu refresh

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
   create table anggota (id uuid primary key default gen_random_uuid(), nama text not null, email text not null, created_at timestamptz not null default now());
   create table tugas (id uuid primary key default gen_random_uuid(), nama text not null, penanggung_jawab text not null, penanggung_jawab_email text not null, dibuat_oleh text not null, status text not null default 'Belum Mulai', bukti text, tanggal_mulai date not null, tanggal_selesai date not null, dibuat_pada timestamptz not null default now(), notif_status text);
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
   ```
3. Buka **Settings → API Keys**, catat **Project URL** dan **Publishable key**.
4. Buka `index.html`, cari bagian `SUPABASE_CONFIG` di dalam tag `<script>`, ganti 2 nilainya dengan punya Anda:
   ```js
   const SUPABASE_CONFIG = {
     url: 'URL_PROJECT_ANDA',
     publishableKey: 'PUBLISHABLE_KEY_ANDA'
   };
   ```

Tabel `tugas` sengaja tidak punya kebijakan **delete** (tidak ada fitur hapus tugas di aplikasi) — kalau perlu bersihkan data lewat Table Editor di dashboard Supabase.

## Teknologi

Satu halaman `index.html` berisi HTML, CSS, dan JavaScript biasa, tanpa framework, ditambah 2 dependency eksternal via CDN: [EmailJS SDK](https://www.emailjs.com/) untuk notifikasi email, dan [Supabase JS SDK](https://supabase.com/docs/reference/javascript) untuk database bersama real-time.

## Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Buka [vercel.com](https://vercel.com), klik **Add New → Project**.
3. Pilih repo ini, klik **Import**.
4. Biarkan pengaturan default (situs statis), klik **Deploy**.
5. Setelah build selesai (~1 menit), aplikasi live di `namaproyek.vercel.app`.
