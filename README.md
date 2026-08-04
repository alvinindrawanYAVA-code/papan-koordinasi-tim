# Context Praktik: Bangun "Papan Koordinasi Tim" pakai Claude Code

**Sumber materi:** Slide Master Asep Bagja, Class 03 (Claude Code & Vibe Coding Part 1) dan Class 04/07 (Part 2), Mini Bootcamp Claude Playbook for Non-Tech Professional Cohort 2.

**Fungsi file ini:** tempel isi bagian "Deskripsi Final" (bagian 5) ke chat Claude Code (claude.ai/code) sebagai jalur aman kalau belum sempat siapkan ide sendiri lewat loop See Clearly → Imagine Boldly. Bagian lain di file ini jelasin konteks di baliknya, biar TA atau peserta paham kenapa deskripsinya dibentuk begitu.

---

## Pemetaan NextGen Builders Framework

Semua bagian di bawah ini disusun mengikuti 3 pilar dari NextGen Builders Framework. See Clearly cari masalah nyata, Imagine Boldly terjemahkan jadi deskripsi yang bisa dibangun, Ship Bravely rilis dan iterasi.

| Bagian | Pilar | Kenapa masuk pilar ini |
|---|---|---|
| 1. Masalah yang mau diselesaikan | See Clearly | Cari pain nyata pakai 4 ciri, sebelum mikirin solusi apapun |
| 2. Formula Buildable | Imagine Boldly | Terjemahkan masalah jadi deskripsi 1 fungsi yang bisa langsung dibangun |
| 3. Loop Diverge, Converge, Commit | Imagine Boldly | Eksplorasi opsi lalu manusia memilih dan mengunci 1 deskripsi final |
| 4. Ketentuan Teknis | Imagine Boldly | Bagian dari Commit, mengunci batasan teknis sebelum mulai build |
| 5. Deskripsi Final | Imagine Boldly | Hasil akhir Commit, siap dipindah ke tahap build |
| 6. Alur Kerja | Ship Bravely | Bangun secukupnya lalu rilis ke internet lewat GitHub dan Vercel |
| 7. Siklus Update | Ship Bravely | Iterate Fast, memutar loop kecil berulang setelah live |
| 8. Template Prompt Iterasi | Ship Bravely | Listen Deeply plus Iterate Fast, menjawab feedback pengguna nyata |
| 9. Cheat Sheet Troubleshooting | Ship Bravely | Bagian praktis biar proses Ship tidak macet karena error teknis |
| 10. Checklist Ship Bravely | Ship Bravely | Verifikasi akhir sebelum menganggap iterasi ini selesai |

---

## 1. Masalah yang mau diselesaikan `See Clearly`

Tim kecil biasa koordinasi kerja lewat WhatsApp. Masalahnya dicek pakai 4 ciri pain dari materi See Clearly:

- **Berulang:** setiap hari ada pertanyaan "si A ngerjain apa ya sekarang", bukan cuma sekali doang.
- **Makan waktu:** scroll chat lama buat nemuin update terakhir, gampang makan 10-15 menit per hari.
- **Bikin frustrasi:** ada tugas yang kelewat karena kebenam di chat, bikin cemas dan saling nanya ulang.
- **Dampak jelas:** kalau selesai, semua orang tahu siapa ngerjain apa tanpa perlu scroll chat lagi.

Masalah ini lolos gerbang buildable karena spesifik (1 fungsi jelas: lihat dan ubah status tugas), pengguna jelas (tim kecil), dan bisa dipakai dalam waktu singkat, bukan proyek berbulan-bulan.

---

## 2. Formula Buildable `Imagine Boldly`

```
"Saya ingin [jenis alat] yang bisa [fungsi utama] untuk [siapa penggunanya],
supaya [hasil yang diharapkan]."
```

Diterapkan ke kasus ini:

> Saya ingin papan koordinasi tim yang bisa menambah tugas (nama tugas, penanggung jawab, status), mengubah status antara Belum Mulai / Dikerjakan / Selesai, dan menampilkan semua tugas dalam satu layar, untuk tim kecil yang selama ini koordinasi lewat WhatsApp, supaya semua orang tahu siapa mengerjakan apa tanpa scroll chat.

Ini contoh "Ide Tepat" versi lolos gerbang buildable, bukan "Ide Kabur" (misal cuma "bikinin aplikasi buat tim dong") atau "Ide Kebesaran" (misal digabung dengan modul HR, payroll, dan chat internal sekaligus).

---

## 3. Loop Diverge, Converge, Commit (opsional) `Imagine Boldly`

Sebelum commit ke 1 deskripsi final, boleh jalanin loop ini di claude.ai chat biasa (bukan Claude Code):

**Diverge (P2):**
```
"Masalah saya: tim kecil koordinasi tugas masih lewat WhatsApp, sering ada tugas
kelewat dan orang saling nanya ulang. Fungsi utama yang saya butuhkan: satu tempat
untuk lihat dan update status tugas tim. Berikan 5 bentuk solusi aplikasi yang
BERBEDA satu sama lain, jelaskan masing-masing dalam 2 kalimat beserta
kelebihan-kekurangannya."
```

Lima opsi yang biasa muncul: papan Kanban drag-and-drop, daftar tugas sederhana dengan filter status, dashboard dengan grafik progres, chat bot command-based, atau kalender tugas. Pilih yang paling ringan dibangun dalam 1 sesi, misal daftar tugas sederhana dengan 3 kolom status.

**Converge:**
Manusia yang memilih, bukan Claude. Setelah pilih 1 opsi favorit, balas:
```
"Saya pilih opsi [daftar tugas dengan status]. Tuliskan sebagai deskripsi dengan
formula: Saya ingin [jenis alat] yang bisa [fungsi utama] untuk [siapa
penggunanya], supaya [hasil yang diharapkan]."
```

**Commit (P3):**
```
"Jadilah kritikus. Apa 3 kelemahan terbesar deskripsi ini: [DESKRIPSI]?
Apakah lolos kriteria: 1 fungsi jelas, pengguna jelas, bisa dipakai dalam
seminggu? Fitur mana yang harus dibuang supaya lebih ramping?"
```

Kalau hasil Commit menyarankan pangkas fitur, pangkas. Fitur di luar fungsi inti adalah pemborosan waktu sebelum ide teruji dulu (prinsip Ship Bravely: bangun secukupnya).

---

## 4. Ketentuan Teknis (jalur aman, sudah teruji) `Imagine Boldly`

Stack ini dipilih supaya cocok sama alur Claude Code Web → GitHub → Vercel tanpa server sendiri:

- Satu halaman `index.html` dengan HTML, CSS, dan JavaScript biasa (tanpa framework)
- Tampilan bersih dan modern, teks antarmuka dalam Bahasa Indonesia
- Data disimpan di `localStorage` browser (tidak butuh database/backend)
- Siap di-deploy ke Vercel sebagai situs statis
- Sertakan README singkat yang menjelaskan aplikasinya

---

## 5. Deskripsi Final: Siap Tempel ke Claude Code (claude.ai/code) `Imagine Boldly`

Salin blok ini langsung ke chat Claude Code:

```
Buatkan aplikasi web sederhana: papan koordinasi tim yang bisa menambah tugas
(nama tugas, penanggung jawab, status), mengubah status antara Belum Mulai /
Dikerjakan / Selesai, dan menampilkan semua tugas dalam satu layar, untuk tim
kecil yang selama ini koordinasi lewat WhatsApp, supaya semua orang tahu siapa
mengerjakan apa tanpa scroll chat.

Ketentuan teknis: gunakan satu halaman index.html dengan HTML, CSS, dan
JavaScript biasa (tanpa framework), tampilan bersih dan modern, teks antarmuka
dalam Bahasa Indonesia, data disimpan di localStorage browser, dan pastikan siap
di-deploy ke Vercel sebagai situs statis. Buat README singkat yang menjelaskan
aplikasinya.
```

---

## 6. Alur Kerja: Deskripsi ke Aplikasi Live `Ship Bravely`

| Tahap | Tempat | Analogi |
|---|---|---|
| Deskripsimu | Prompt di atas | Ide |
| Claude Code (web) | claude.ai/code | Tukang Bangunan |
| Repository GitHub | github.com | Lemari Arsip |
| Vercel | vercel.com | Etalase |
| Link Publik | namaproyek.vercel.app | Pengguna Nyata |

Cara kerja: kamu kasih tugas di claude.ai/code, Claude bekerja di komputer cloud-nya, hasilnya masuk ke repo GitHub lewat pull request yang kamu setujui (Merge), lalu Vercel otomatis menerbitkan versi terbaru. Kamu adalah supir yang mengarahkan, Claude cuma mesin yang eksekusi, jadi boleh menyela kapan saja sebelum approve pull request kalau ada yang kurang pas, misal "tombolnya kurang besar" atau "tambah kolom deadline".

**Setup awal (sekali saja):**
1. Punya akun Claude paket Pro, akses lewat claude.ai/code
2. Punya akun GitHub, buat repository baru (nama bebas, misal `papan-koordinasi-tim`), set public, centang README
3. Punya akun Vercel, sambungkan ke akun GitHub

**Import ke Vercel (setelah repo pertama terisi Claude):**
1. Buka vercel.com, klik Add New, pilih Project
2. Pilih repo yang tadi dibuat, klik Import
3. Biarkan pengaturan default, klik Deploy, tunggu sekitar 1 menit
4. Aplikasi resmi live di `namaproyek.vercel.app`

---

## 7. Siklus Update (dipakai berulang kali) `Ship Bravely`

```
Minta perubahan ke Claude → Baca ringkasan Pull Request → Setujui/Merge
→ Vercel auto deploy → (ulangi)
```

Contoh perintah update kecil:
```
"Ganti judul aplikasi menjadi [nama pilihanmu] dan tambahkan warna favoritku
[warna] sebagai aksen."
```

Kalau ada error, salin pesan errornya lalu tempel balik ke Claude: "Ini errornya, tolong perbaiki." Jangan panik, ini bagian normal dari vibe coding.

---

## 8. Template Prompt Iterasi Lanjutan `Ship Bravely`

Dipakai setelah aplikasi live, setelah dapat feedback dari 1-2 pengguna nyata:

```
Untuk feedback: "Pengguna saya bilang: '[FEEDBACK]'. Tolong perbaiki bagian itu
tanpa mengubah fitur lain."

Untuk error: "Ini errornya: [PESAN ERROR]. Tolong cari penyebabnya dan
perbaiki."
```

Prinsip Ship Bravely: pilih SATU feedback dulu, minta Claude Code perbaiki, merge, link ter-update otomatis. Jangan gabungkan banyak perubahan sekaligus dalam 1 iterasi.

**Bonus, kalau mau polish tampilan (Claude Code untuk Design):**
```
"Ubah tampilan jadi bergaya minimalis modern: banyak ruang kosong, satu warna
aksen, sudut membulat, font yang lembut."

"Usulkan 3 arah tema visual berbeda (deskripsikan dulu, jangan langsung ubah),
lalu saya pilih satu."

"Pastikan nyaman dipakai di layar HP, ini yang akan dipakai tim saya
sehari-hari."
```

---

## 9. Cheat Sheet Troubleshooting `Ship Bravely`

| Gejala | Kemungkinan Penyebab | Solusi Cepat |
|---|---|---|
| Tidak bisa buka claude.ai/code | Paket masih Free | Settings, Billing, upgrade Pro |
| Repo tidak muncul di Claude Code | Aplikasi GitHub belum di-authorize, atau repo tidak dipilih | Ulangi koneksi GitHub, pilih repo saat authorize |
| Aplikasi di Vercel cuma tampil README | Pull request belum di-merge | Buka GitHub, tab Pull requests, klik Merge |
| Link Vercel error 404 | Salah repo saat import, atau belum ada index.html | Re-import repo yang benar, cek isi repo |
| Perubahan tidak muncul di link | Belum merge, atau masih butuh 1-2 menit build | Cek tab Deployments di Vercel |
| Email verifikasi GitHub tidak datang | Masuk folder spam | Cek folder spam atau promosi |

---

## 10. Checklist Ship Bravely Sebelum Anggap Selesai `Ship Bravely`

- [ ] Fungsi utama (tambah tugas, ubah status, tampilkan semua tugas) sudah jalan, meski fitur lain belum ada
- [ ] Link sudah dikirim ke minimal 1 orang di luar diri sendiri (bukan cuma disimpan di bookmark)
- [ ] Sudah minta 1 orang coba langsung dan diamati, bukan cuma ditanya pendapatnya
- [ ] Feedback pertama sudah ditindaklanjuti jadi 1 perbaikan kecil dan sudah live ulang
- [ ] Bisa jawab: "1 masalah nyata apa yang sudah terselesaikan untuk 1 pengguna nyata?"

---

*Mini Bootcamp Claude Playbook for Non-Tech Professional, Cohort 2 by BelajarLagi*
