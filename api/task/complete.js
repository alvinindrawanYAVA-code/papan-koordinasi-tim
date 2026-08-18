const { sbSelect } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { formatTanggal } = require('../../lib/time');

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

  try {
    const tasks = await sbSelect('tugas', { id: `eq.${taskId}`, select: '*' });
    const task = tasks && tasks[0];
    if (!task) {
      res.status(404).json({ error: 'Tugas tidak ditemukan' });
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

    // reminder_message dirender sebagai teks polos di template email (bukan lewat
    // tag <a>), jadi URL bukti disertakan apa adanya di sini -- kebanyakan klien
    // email (Gmail, Outlook, dll) otomatis mengubah URL polos jadi link yang bisa
    // diklik, tanpa perlu ubah template EmailJS di dashboard.
    const message = task.bukti
      ? `${task.penanggung_jawab || 'Penanggung jawab'} menandai tugas "${task.nama}" sudah selesai. Link bukti kerja: ${task.bukti}`
      : `${task.penanggung_jawab || 'Penanggung jawab'} menandai tugas "${task.nama}" sudah selesai.`;

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
      },
    });

    res.status(200).json({ ok: true, emailSent: true });
  } catch (err) {
    console.error('task/complete error:', err);
    res.status(500).json({ error: 'Gagal mengirim notifikasi selesai' });
  }
};
