import supabaseAdmin from '../../lib/supabaseAdmin.js';
const { sbSelect, sbUpdate } = supabaseAdmin;
import emailjsLib from '../../lib/emailjs.js';
const { sendEmail } = emailjsLib;
import timeLib from '../../lib/time.js';
const { todayWita, diffDays, formatTanggal } = timeLib;

const EMAILJS_RATE_LIMIT_MS = 1100; // EmailJS batasi 1 request/detik
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildReminderParams(task, pj, { headline, message, accentColor }) {
  return {
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
  };
}

// Dipanggil otomatis 1x/hari lewat Netlify Scheduled Functions (config.schedule
// di bawah, dulu vercel.json cron). BEDA dari versi Vercel: scheduled function
// Netlify TIDAK mengirim header Authorization bearer seperti Vercel Cron, jadi
// TIDAK ADA cek CRON_SECRET di sini lagi -- Netlify sendiri yang membatasi
// endpoint ini cuma bisa dipicu scheduler internal, bukan HTTP publik biasa
// (VERIFY SAAT IMPLEMENTASI: sudah dicoba curl langsung dari luar, lihat
// CHANGELOG.md). Dampak terburuk kalau asumsi ini salah cuma email reminder
// ekstra terkirim (bukan kebocoran data), risikonya rendah.
//
// Sengaja CUMA reminder overdue (tidak ada lagi H-2 sebelum deadline), dan
// dikirim tiap 3 hari sekali per tugas (hari-0 = tepat di tanggal deadline,
// lalu hari-3, hari-6, dst) -- bukan tiap hari seperti versi awal, supaya
// kuota EmailJS gratis (±200/bulan) tidak cepat terkuras kalau tugas overdue
// menumpuk. Ini kebijakan notifikasi yang disepakati: cuma 4 pemicu boleh
// kirim email (tugas baru, kirim pengingat manual, tugas selesai, dan
// reminder overdue otomatis ini) -- tidak ada notifikasi lain di luar itu.
//
// CATATAN RISIKO 30 detik: scheduled function Netlify punya limit eksekusi 30
// detik, sedang loop di bawah jeda 1100ms per email -- kalau overdue reminder
// dalam 1 run > ~25 email, berisiko terpotong sebelum selesai (lihat
// CHANGELOG.md untuk detail & mitigasi kalau volumenya sudah dekat batas itu).
export default async () => {
  const today = todayWita();
  let overdueSent = 0;
  let failed = 0;
  let totalChecked = 0;

  try {
    const tasks = await sbSelect('tugas', { status: 'neq.Selesai', select: '*, tugas_pj(*)' });

    for (const task of tasks || []) {
      // Tugas Dibatalkan tidak pernah "overdue" secara relevan -- jangan diingatkan.
      if (task.status === 'Dibatalkan') continue;
      if (!task.tanggal_selesai || task.tanggal_selesai > today) continue;

      const hariTerlambat = diffDays(today, task.tanggal_selesai);
      const isHariReminder = hariTerlambat % 3 === 0;
      if (!isHariReminder) continue;

      for (const pj of task.tugas_pj || []) {
        totalChecked++;

        const sudahDikirimHariIni = pj.reminder_overdue_last_sent_on && pj.reminder_overdue_last_sent_on >= today;
        if (sudahDikirimHariIni || !pj.email) continue;

        try {
          // hari-0 = tepat di tanggal deadline -- belum benar-benar "terlambat",
          // jadi pesannya dibedakan dari hari-3/6/dst supaya tidak janggal ("terlambat 0 hari").
          const message = hariTerlambat === 0
            ? `Tugas "${task.nama}" jatuh tempo hari ini (${formatTanggal(task.tanggal_selesai)}). Mohon segera diselesaikan atau update statusnya.`
            : `Tugas "${task.nama}" sudah terlambat ${hariTerlambat} hari dari tenggat (${formatTanggal(task.tanggal_selesai)}). Mohon segera diselesaikan atau update statusnya.`;
          await sendEmail({
            templateId: process.env.EMAILJS_REMINDER_TEMPLATE_ID,
            templateParams: buildReminderParams(task, pj, {
              headline: hariTerlambat === 0 ? 'Tugas jatuh tempo hari ini' : 'Tugas sudah terlambat',
              message,
              accentColor: '#dc2626',
            }),
          });
          await sbUpdate('tugas_pj', { id: `eq.${pj.id}` }, { reminder_overdue_last_sent_on: today });
          overdueSent++;
          await sleep(EMAILJS_RATE_LIMIT_MS);
        } catch (err) {
          console.error(`cron: gagal kirim reminder overdue untuk tugas ${task.id} (pj ${pj.id}):`, err);
          failed++;
        }
      }
    }

    console.log('cron/check-deadlines selesai:', { today, overdueSent, failed, totalChecked });
  } catch (err) {
    console.error('cron/check-deadlines error:', err);
  }
};

// UTC, sama seperti vercel.json versi lama -- jam 02:00.
export const config = { schedule: '0 2 * * *' };
