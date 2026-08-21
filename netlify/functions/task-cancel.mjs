import supabaseAdmin from '../../lib/supabaseAdmin.js';
const { sbSelect, sbUpdate } = supabaseAdmin;
import emailjsLib from '../../lib/emailjs.js';
const { sendEmail } = emailjsLib;
import googleLib from '../../lib/google.js';
const { cancelTaskCalendarEvent, cancelCreatorCalendarEvent } = googleLib;
import timeLib from '../../lib/time.js';
const { formatTanggal } = timeLib;
import { requireAuth } from '../../lib/auth.mjs';
import { json } from '../../lib/httpResponse.mjs';

// Dipicu dari tombol "Batalkan Tugas" di kartu tugas (hanya pembuat tugas
// yang melihat tombolnya di UI). Soft-cancel: status diubah jadi 'Dibatalkan',
// tugas TIDAK dihapus dari tabel supaya histori tetap ada dan bisa di-undo
// lewat tombol "Pulihkan". Event Google Calendar (kalau ada) ikut dihapus,
// dan penanggung jawab diberi tahu lewat email -- masing-masing langkah gagal
// secara terisolasi, tidak saling menggagalkan pembatalan.
export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const body = await req.json().catch(() => ({}));
  const { taskId } = body;
  if (!taskId) return json(400, { error: 'taskId wajib diisi' });

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  try {
    const tasks = await sbSelect('tugas', { id: `eq.${taskId}`, select: '*' });
    const task = tasks && tasks[0];
    if (!task) return json(404, { error: 'Tugas tidak ditemukan' });
    // Cuma pembuat tugas yang boleh membatalkan -- dulu cuma gate UI (tombol
    // disembunyikan kalau bukan pembuat), sekarang ditegakkan di server juga
    // karena endpoint ini pakai service_role (bypass RLS).
    if (auth.anggota.nama !== task.dibuat_oleh) {
      return json(403, { error: 'Cuma pembuat tugas yang boleh membatalkan tugas ini' });
    }
    if (task.status === 'Dibatalkan') return json(200, { ok: true, alreadyCanceled: true });

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

    return json(200, { ok: true, calendarCleanup, emailsSent });
  } catch (err) {
    console.error('task/cancel error:', err);
    return json(500, { error: 'Gagal membatalkan tugas' });
  }
};

export const config = { path: '/api/task/cancel' };
