const { sbSelect, sbUpdate } = require('../../lib/supabaseAdmin');
const { getValidAccessToken, createCalendarEvent } = require('../../lib/google');
const { addDays } = require('../../lib/time');

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

    if (!task.penanggung_jawab_id) {
      await sbUpdate('tugas', { id: `eq.${taskId}` }, { calendar_status: 'skipped_not_connected' });
      res.status(200).json({ status: 'skipped_not_connected' });
      return;
    }

    const accessToken = await getValidAccessToken(task.penanggung_jawab_id);
    if (!accessToken) {
      await sbUpdate('tugas', { id: `eq.${taskId}` }, { calendar_status: 'skipped_not_connected' });
      res.status(200).json({ status: 'skipped_not_connected' });
      return;
    }

    try {
      const event = await createCalendarEvent(accessToken, {
        summary: task.nama,
        description: task.deskripsi || '',
        startDate: task.tanggal_mulai,
        endDateExclusive: addDays(task.tanggal_selesai, 1),
      });
      await sbUpdate('tugas', { id: `eq.${taskId}` }, {
        calendar_status: 'created',
        calendar_event_id: event.id,
        calendar_error: null,
      });
      res.status(200).json({ status: 'created', eventId: event.id });
    } catch (err) {
      console.error('create-event: gagal buat event:', err);
      await sbUpdate('tugas', { id: `eq.${taskId}` }, {
        calendar_status: 'failed',
        calendar_error: String((err && err.message) || err),
      });
      res.status(200).json({ status: 'failed' });
    }
  } catch (err) {
    console.error('google/create-event error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
