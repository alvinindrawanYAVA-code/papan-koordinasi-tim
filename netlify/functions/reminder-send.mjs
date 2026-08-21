import supabaseAdmin from '../../lib/supabaseAdmin.js';
const { sbSelect } = supabaseAdmin;
import emailjsLib from '../../lib/emailjs.js';
const { sendEmail } = emailjsLib;
import timeLib from '../../lib/time.js';
const { todayWita, diffDays, formatTanggal } = timeLib;
import { requireAuth } from '../../lib/auth.mjs';
import { json } from '../../lib/httpResponse.mjs';

const EMAILJS_RATE_LIMIT_MS = 1100; // EmailJS batasi 1 request/detik
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Dipicu manual dari tombol "Kirim Pengingat" di kartu tugas (hanya pembuat
// tugas yang melihat tombolnya di UI) -- pengganti cron H-2/overdue otomatis
// yang dinonaktifkan supaya kuota kirim EmailJS free tier (200/bulan) tidak
// terkuras sendiri tanpa dikontrol.
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
    // Sama seperti task/cancel.js -- cuma pembuat tugas yang boleh kirim pengingat.
    if (auth.anggota.nama !== task.dibuat_oleh) {
      return json(403, { error: 'Cuma pembuat tugas yang boleh mengirim pengingat untuk tugas ini' });
    }
    const pjRows = await sbSelect('tugas_pj', { tugas_id: `eq.${taskId}`, select: '*' });
    const recipients = (pjRows || []).filter(pj => pj.email);
    if (recipients.length === 0) return json(400, { error: 'Penanggung jawab tugas ini belum punya email' });

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
          completion_info_html: '',
          bukti_button_html: '',
        },
      });
      if (i < recipients.length - 1) await sleep(EMAILJS_RATE_LIMIT_MS);
    }

    return json(200, { ok: true, sent: recipients.length });
  } catch (err) {
    console.error('reminder/send error:', err);
    return json(500, { error: 'Gagal mengirim pengingat' });
  }
};

export const config = { path: '/api/reminder/send' };
