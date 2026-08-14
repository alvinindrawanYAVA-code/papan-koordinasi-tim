const { sbSelect } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { todayWita, diffDays, formatTanggal } = require('../../lib/time');

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
    if (!task.penanggung_jawab_email) {
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

    await sendEmail({
      templateId: process.env.EMAILJS_REMINDER_TEMPLATE_ID,
      templateParams: {
        to_email: task.penanggung_jawab_email,
        to_name: task.penanggung_jawab,
        to_initial: (task.penanggung_jawab || '?').trim().charAt(0).toUpperCase(),
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

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('reminder/send error:', err);
    res.status(500).json({ error: 'Gagal mengirim pengingat' });
  }
};
