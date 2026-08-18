const { sbSelect, sbUpdate } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { cancelTaskCalendarEvent } = require('../../lib/google');
const { formatTanggal } = require('../../lib/time');

// Dipicu dari tombol "Batalkan Tugas" di kartu tugas (hanya pembuat tugas
// yang melihat tombolnya di UI). Soft-cancel: status diubah jadi 'Dibatalkan',
// tugas TIDAK dihapus dari tabel supaya histori tetap ada dan bisa di-undo
// lewat tombol "Pulihkan". Event Google Calendar (kalau ada) ikut dihapus,
// dan penanggung jawab diberi tahu lewat email -- masing-masing langkah gagal
// secara terisolasi, tidak saling menggagalkan pembatalan.
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
    if (task.status === 'Dibatalkan') {
      res.status(200).json({ ok: true, alreadyCanceled: true });
      return;
    }

    await sbUpdate('tugas', { id: `eq.${taskId}` }, { status: 'Dibatalkan' });

    let calendarCleanup = 'skipped';
    try {
      calendarCleanup = await cancelTaskCalendarEvent(task);
    } catch (err) {
      console.error('task/cancel: gagal hapus event kalender:', err);
      calendarCleanup = 'failed';
    }

    let emailSent = false;
    if (task.penanggung_jawab_email) {
      try {
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
            task_status: 'Dibatalkan',
            reminder_headline: 'Tugas Dibatalkan',
            reminder_message: `${task.dibuat_oleh || 'Pembuat tugas'} membatalkan tugas "${task.nama}" ini, jadi tidak perlu dikerjakan lagi.`,
            accent_color: '#6b7280',
          },
        });
        emailSent = true;
      } catch (err) {
        console.error('task/cancel: gagal kirim email notifikasi:', err);
      }
    }

    res.status(200).json({ ok: true, calendarCleanup, emailSent });
  } catch (err) {
    console.error('task/cancel error:', err);
    res.status(500).json({ error: 'Gagal membatalkan tugas' });
  }
};
