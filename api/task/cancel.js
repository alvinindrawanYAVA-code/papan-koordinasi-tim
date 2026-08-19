const { sbSelect, sbUpdate } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { cancelTaskCalendarEvent, cancelCreatorCalendarEvent } = require('../../lib/google');
const { formatTanggal } = require('../../lib/time');
const { requireAuth } = require('../../lib/auth');

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

  const auth = await requireAuth(req, res);
  if (!auth) return;

  try {
    const tasks = await sbSelect('tugas', { id: `eq.${taskId}`, select: '*' });
    const task = tasks && tasks[0];
    if (!task) {
      res.status(404).json({ error: 'Tugas tidak ditemukan' });
      return;
    }
    // Cuma pembuat tugas yang boleh membatalkan -- dulu cuma gate UI (tombol
    // disembunyikan kalau bukan pembuat), sekarang ditegakkan di server juga
    // karena endpoint ini pakai service_role (bypass RLS).
    if (auth.anggota.nama !== task.dibuat_oleh) {
      res.status(403).json({ error: 'Cuma pembuat tugas yang boleh membatalkan tugas ini' });
      return;
    }
    if (task.status === 'Dibatalkan') {
      res.status(200).json({ ok: true, alreadyCanceled: true });
      return;
    }

    await sbUpdate('tugas', { id: `eq.${taskId}` }, { status: 'Dibatalkan' });

    const pjRows = await sbSelect('tugas_pj', { tugas_id: `eq.${taskId}`, select: '*' });

    const calendarCleanup = [];
    for (const pj of pjRows || []) {
      try {
        calendarCleanup.push(await cancelTaskCalendarEvent(pj));
      } catch (err) {
        console.error(`task/cancel: gagal hapus event kalender utk pj ${pj.id}:`, err);
        calendarCleanup.push('failed');
      }
    }

    if (task.creator_calendar_event_id && task.dibuat_oleh) {
      try {
        const creatorRows = await sbSelect('anggota', { nama: `eq.${task.dibuat_oleh}`, select: 'id' });
        const creator = creatorRows && creatorRows[0];
        if (creator) calendarCleanup.push(await cancelCreatorCalendarEvent(task, creator.id));
      } catch (err) {
        console.error(`task/cancel: gagal hapus event kalender pembuat utk tugas ${task.id}:`, err);
        calendarCleanup.push('failed');
      }
    }

    let emailsSent = 0;
    for (const pj of (pjRows || []).filter(p => p.email)) {
      try {
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
            task_status: 'Dibatalkan',
            reminder_headline: 'Tugas Dibatalkan',
            reminder_message: `${task.dibuat_oleh || 'Pembuat tugas'} membatalkan tugas "${task.nama}" ini, jadi tidak perlu dikerjakan lagi.`,
            accent_color: '#6b7280',
            completion_info_html: '',
            bukti_button_html: '',
          },
        });
        emailsSent++;
      } catch (err) {
        console.error(`task/cancel: gagal kirim email notifikasi ke ${pj.nama}:`, err);
      }
    }

    res.status(200).json({ ok: true, calendarCleanup, emailsSent });
  } catch (err) {
    console.error('task/cancel error:', err);
    res.status(500).json({ error: 'Gagal membatalkan tugas' });
  }
};
