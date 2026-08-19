const { sbSelect } = require('../../lib/supabaseAdmin');
const { syncTaskCalendarEvent, syncCreatorCalendarEvent } = require('../../lib/google');
const { requireAuth } = require('../../lib/auth');

// Dipanggil (fire-and-forget) dari index.html tepat setelah 1 tugas berhasil
// dibuat. Selalu ambil ulang data tugas dari Supabase pakai taskId (tidak
// percaya field dari client), dan aman dipanggil berkali-kali (idempotent).
module.exports = async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    const { taskId } = req.body || {};
    if (!taskId) {
      res.status(400).json({ error: 'taskId wajib diisi' });
      return;
    }

    const rows = await sbSelect('tugas', { id: `eq.${taskId}`, select: '*' });
    const task = rows && rows[0];
    if (!task) {
      res.status(404).json({ error: 'Tugas tidak ditemukan' });
      return;
    }

    const pjRows = await sbSelect('tugas_pj', { tugas_id: `eq.${taskId}`, select: '*' });
    const statuses = [];
    for (const pj of pjRows || []) {
      if (pj.calendar_event_id) {
        statuses.push(pj.calendar_status);
        continue;
      }
      statuses.push(await syncTaskCalendarEvent(task, pj));
    }

    // Pembuat tugas ikut dapat event kalender sendiri (selain penanggung jawab),
    // kecuali dia juga salah satu penanggung jawab (sudah dapat event lewat loop
    // di atas -- jangan dobel).
    let creatorStatus = null;
    if (task.dibuat_oleh) {
      const creatorRows = await sbSelect('anggota', { nama: `eq.${task.dibuat_oleh}`, select: 'id' });
      const creator = creatorRows && creatorRows[0];
      const isAlsoPj = creator && (pjRows || []).some(pj => pj.anggota_id === creator.id);
      if (creator && !isAlsoPj) {
        creatorStatus = task.creator_calendar_event_id
          ? task.creator_calendar_status
          : await syncCreatorCalendarEvent(task, creator.id);
      }
    }

    res.status(200).json({ statuses, creatorStatus });
  } catch (err) {
    console.error('google/create-event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
