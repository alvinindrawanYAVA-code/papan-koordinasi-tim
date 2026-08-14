const { sbSelect } = require('../../lib/supabaseAdmin');
const { syncTaskCalendarEvent } = require('../../lib/google');

// Dipanggil (fire-and-forget) dari index.html tepat setelah 1 tugas berhasil
// dibuat. Selalu ambil ulang data tugas dari Supabase pakai taskId (tidak
// percaya field dari client), dan aman dipanggil berkali-kali (idempotent).
module.exports = async (req, res) => {
  try {
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

    if (task.calendar_event_id) {
      res.status(200).json({ status: task.calendar_status, alreadyDone: true });
      return;
    }

    const status = await syncTaskCalendarEvent(task);
    res.status(200).json({ status });
  } catch (err) {
    console.error('google/create-event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
