# Papan Koordinasi Tim

Aplikasi web sederhana untuk tim kecil yang selama ini koordinasi tugas lewat WhatsApp. Semua orang bisa langsung lihat siapa mengerjakan apa tanpa scroll chat.

## Fitur

- Tambah tugas: nama tugas, penanggung jawab, dan status awal (Belum Mulai/Dikerjakan)
- Ubah status tugas antara **Belum Mulai**, **Dikerjakan**, dan **Selesai**
- Semua tugas tampil dalam satu layar, dikelompokkan per status
- Saat tugas ditandai **Selesai** (lewat dropdown status pada tugasnya), wajib isi link bukti kerja (mis. link Google Drive/foto/dokumen yang sudah diupload ke tempat lain) sebagai bukti tugas benar-benar sudah dikerjakan

## Cara Pakai

Buka `index.html` langsung di browser (double click, atau lewat live server jika ada). Tidak perlu instalasi atau server tambahan.

Data tugas disimpan di `localStorage` browser masing-masing perangkat — artinya data tidak otomatis tersinkron antar pengguna atau perangkat berbeda, dan akan hilang jika cache/local storage browser dibersihkan. Bukti kerja disimpan sebagai **link/URL saja** (bukan file), supaya tidak membebani kuota penyimpanan browser — file buktinya sendiri perlu diupload dulu ke tempat lain (Google Drive, WhatsApp, dll) baru link-nya ditempel di sini.

## Teknologi

Satu halaman `index.html` berisi HTML, CSS, dan JavaScript biasa, tanpa framework atau dependency eksternal.

## Deploy ke Vercel

1. Push repo ini ke GitHub.
2. Buka [vercel.com](https://vercel.com), klik **Add New → Project**.
3. Pilih repo ini, klik **Import**.
4. Biarkan pengaturan default (situs statis), klik **Deploy**.
5. Setelah build selesai (~1 menit), aplikasi live di `namaproyek.vercel.app`.
