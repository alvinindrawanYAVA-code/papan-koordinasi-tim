import supabaseAdmin from '../../lib/supabaseAdmin.js';
const { sbSelect } = supabaseAdmin;
import googleLib from '../../lib/google.js';
const { syncTaskCalendarEvent, syncCreatorCalendarEvent } = googleLib;
import { requireAuth } from '../../lib/auth.mjs';
import { json } from '../../lib/httpResponse.mjs';

// Dipanggil (fire-and-forget) dari index.html tepat setelah 1 tugas berhasil
// dibuat. Selalu ambil ulang data tugas dari Supabase pakai taskId (tidak
// percaya field dari client), dan aman dipanggil berkali-kali (idempotent).
export default async (req) => {
  try {
    const auth = await requireAuth(req);
    if (auth instanceof Response) return auth;

    const body = await req.json().catch(() => ({}));
    const { taskId } = body;
    if (!taskId) return json(400, { error: 'taskId wajib diisi' });

    const rows = await sbSelect('tugas', { id: `eq.${taskId}`, select: '*' });
    const task = rows && rows[0];
    if (!task) return json(404, { error: 'Tugas tidak ditemukan' });

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

    return json(200, { statuses, creatorStatus });
  } catch (err) {
    console.error('google/create-event error:', err);
    return json(500, { error: 'Terjadi kesalahan server' });
  }
};

export const config = { path: '/api/google/create-event' };
