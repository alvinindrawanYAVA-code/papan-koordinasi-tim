const { sbSelect } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { todayWita, diffDays, formatTanggal } = require('../../lib/time');

const EMAILJS_RATE_LIMIT_MS = 1100; // EmailJS batasi 1 request/detik
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Dipicu manual dari tombol "Kirim Pengingat" di kartu tugas (hanya pembuat
// tugas yang melihat tombolnya di UI) -- pengganti cron H-2/overdue otomatis
// yang dinonaktifkan supaya kuota kirim EmailJS free tier (200/bulan) tidak
// terkuras sendiri tanpa dikontrol.
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
    const pjRows = await sbSelect('tugas_pj', { tugas_id: `eq.${taskId}`, select: '*' });
    const recipients = (pjRows || []).filter(pj => pj.email);
    if (recipients.length === 0) {
      res.status(400).json({ error: 'Penanggung jawab tugas ini belum punya email' });
      return;
    }

    const today = todayWita();
    const overdue = task.tanggal_selesai && task.tanggal_selesai < today;
    const headline = overdue ? 'Tugas sudah terlambat' : 'Pengingat Tugas';
    const accentColor = overdue ? '#dc2626' : '#f59e0b';
    const message = overdue
      ? `Tugas "${task.nama}" sudah terlambat ${Math.abs(diffDays(task.tanggal_selesai, today))} hari dari tenggat (${formatTanggal(task.tanggal_selesai)}). Mohon segera diselesaikan atau update statusnya.`
      : `${task.dibuat_oleh || 'Pembuat tugas'} mengingatkan kamu soal tugas "${task.nama}" (tenggat ${formatTanggal(task.tanggal_selesai)}).`;

    for (let i = 0; i < recipients.length; i++) {
      const pj = recipients[i];
      await sendEmail({
        templateId: process.env.EMAILJS_REMINDER_TEMPLATE_ID,
        templateParams: {
          to_email: pj.email,
          to_name: pj.nama,
          to_initial: (pj.nama || '?').trim().charAt(0).toUpperCase(),
          task_name: task.nama,
          task_description: task.deskripsi || '-',
          task_start: formatTanggal(task.tanggal_mulai),
          task_end: formatTanggal(task.tanggal_selesai),
          task_status: task.status,
          reminder_headline: headline,
          reminder_message: message,
          accent_color: accentColor,
        },
      });
      if (i < recipients.length - 1) await sleep(EMAILJS_RATE_LIMIT_MS);
    }

    res.status(200).json({ ok: true, sent: recipients.length });
  } catch (err) {
    console.error('reminder/send error:', err);
    res.status(500).json({ error: 'Gagal mengirim pengingat' });
  }
};
