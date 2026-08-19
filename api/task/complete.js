const { sbSelect } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { formatTanggal, todayWita, diffDays } = require('../../lib/time');
const { requireAuth } = require('../../lib/auth');

// Bangun blok "Selesai Pada (Aktual)" + badge "Ketepatan Waktu" (dibandingkan
// terhadap tenggat asli/task.tanggal_selesai). Cuma dipakai di notifikasi
// tugas Selesai -- 3 pemanggil template Task Reminder lainnya (reminder
// manual, overdue otomatis, cancel) kirim string kosong untuk var ini.
function buildCompletionInfoHtml(tanggalSelesai) {
  const today = todayWita();
  const tile = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f6f8; border-radius:16px; margin:0 0 12px;"><tr><td style="padding:14px 16px;"><p style="margin:0 0 4px; font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:#9ca3af;">Selesai Pada (Aktual)</p><p style="margin:0; font-size:15px; font-weight:800; color:#1f2430;">${formatTanggal(today)}</p></td></tr></table>`;

  if (!tanggalSelesai) return tile;

  const diff = diffDays(today, tanggalSelesai);
  let label, color, bg;
  if (diff > 0) {
    label = `⚠️ Terlambat ${diff} hari`;
    color = '#dc2626';
    bg = '#fee2e2';
  } else if (diff < 0) {
    label = `🚀 Lebih Cepat ${Math.abs(diff)} hari`;
    color = '#16a34a';
    bg = '#dcfce7';
  } else {
    label = '✅ Tepat Waktu';
    color = '#4f46e5';
    bg = '#eef2ff';
  }
  const badge = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg}; border-radius:16px; margin:0 0 12px;"><tr><td style="padding:16px 18px;"><p style="margin:0 0 4px; font-size:12px; font-weight:800; letter-spacing:0.04em; text-transform:uppercase; color:${color};">Ketepatan Waktu</p><p style="margin:0; font-size:18px; font-weight:800; color:${color};">${label}</p></td></tr></table>`;

  return tile + badge;
}

// Dipicu (fire-and-forget) dari client tepat setelah penanggung jawab menandai
// tugas "Selesai" (lihat commitStatusChange di index.html). Memberi tahu
// pembuat tugas lewat email -- arah kebalikan dari notifikasi saat tugas
// dibuat (yang tujuannya ke penanggung jawab). Pakai ulang template EmailJS
// reminder yang sudah ada (headline/pesan/warna beda), sama seperti
// api/task/cancel.js -- supaya tidak nambah kuota template EmailJS gratis.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { taskId } = req.body || {};
  if (!taskId) {
    res.status(400).json({ error: 'taskId wajib diisi' });
    return;
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const tasks = await sbSelect('tugas', { id: `eq.${taskId}`, select: '*' });
    const task = tasks && tasks[0];
    if (!task) {
      res.status(404).json({ error: 'Tugas tidak ditemukan' });
      return;
    }

    const pjRows = await sbSelect('tugas_pj', { tugas_id: `eq.${taskId}`, select: '*' });
    // Beda dari cancel/reminder (creator-only) -- ini boleh dipicu penanggung
    // jawab ATAU pembuat, karena memang assignee sendiri yang menandai tugas
    // selesai (predikat sama seperti RLS tugas_update di index.html).
    const isAssignee = (pjRows || []).some(p => p.anggota_id === auth.anggota.id);
    const isCreator = auth.anggota.nama === task.dibuat_oleh;
    if (!isAssignee && !isCreator) {
      res.status(403).json({ error: 'Cuma penanggung jawab atau pembuat tugas yang boleh menandai tugas ini selesai' });
      return;
    }

    if (!task.dibuat_oleh) {
      res.status(200).json({ ok: true, emailSent: false, reason: 'no_creator' });
      return;
    }

    const anggota = await sbSelect('anggota', { nama: `eq.${task.dibuat_oleh}`, select: '*' });
    const creator = anggota && anggota[0];
    if (!creator || !creator.email) {
      res.status(200).json({ ok: true, emailSent: false, reason: 'creator_no_email' });
      return;
    }

    const pjNames = (pjRows || []).map(p => p.nama).join(', ') || 'Penanggung jawab';

    // Link bukti sekarang tampil sebagai tombol tersendiri (bukti_button_html),
    // bukan lagi URL polos di reminder_message -- URL polos di area hero
    // banner berwarna gampang jadi biru mentah (auto-linkify klien email) dan
    // susah dibaca.
    const message = `${pjNames} menandai tugas "${task.nama}" sudah selesai.`;
    const buktiButtonHtml = task.bukti
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;"><tr><td align="center" style="border-radius:999px; background-color:#16a34a;"><a href="${task.bukti}" target="_blank" style="display:block; padding:14px 22px; font-size:14px; font-weight:800; color:#ffffff; text-decoration:none;">🔗 Lihat Bukti Kerja &rarr;</a></td></tr></table>`
      : '';

    await sendEmail({
      templateId: process.env.EMAILJS_REMINDER_TEMPLATE_ID,
      templateParams: {
        to_email: creator.email,
        to_name: creator.nama,
        to_initial: (creator.nama || '?').trim().charAt(0).toUpperCase(),
        task_name: task.nama,
        task_description: task.deskripsi || '-',
        task_start: formatTanggal(task.tanggal_mulai),
        task_end: formatTanggal(task.tanggal_selesai),
        task_status: 'Selesai',
        reminder_headline: 'Tugas Selesai',
        reminder_message: message,
        accent_color: '#16a34a',
        completion_info_html: buildCompletionInfoHtml(task.tanggal_selesai),
        bukti_button_html: buktiButtonHtml,
      },
    });

    res.status(200).json({ ok: true, emailSent: true });
  } catch (err) {
    console.error('task/complete error:', err);
    res.status(500).json({ error: 'Gagal mengirim notifikasi selesai' });
  }
};
