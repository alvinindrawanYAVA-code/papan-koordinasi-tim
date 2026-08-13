const { sbSelect, sbUpdate } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { todayWita, diffDays, formatTanggal } = require('../../lib/time');

const EMAILJS_RATE_LIMIT_MS = 1100; // EmailJS batasi 1 request/detik
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildReminderParams(task, { headline, message }) {
  return {
    to_email: task.penanggung_jawab_email,
    to_name: task.penanggung_jawab,
    task_name: task.nama,
    task_description: task.deskripsi || '-',
    task_start: formatTanggal(task.tanggal_mulai),
    task_end: formatTanggal(task.tanggal_selesai),
    task_status: task.status,
    reminder_headline: headline,
    reminder_message: message,
  };
}

// Dipanggil otomatis 1x/hari oleh Vercel Cron (lihat vercel.json). Vercel
// mengirim header Authorization: Bearer <CRON_SECRET> sendiri saat trigger --
// endpoint ini WAJIB verifikasi sendiri, Vercel tidak otomatis blokir akses lain.
module.exports = async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).send('Unauthorized');
    return;
  }

  const today = todayWita();
  let h2Sent = 0;
  let overdueSent = 0;
  let failed = 0;

  try {
    const tasks = await sbSelect('tugas', { status: 'neq.Selesai', select: '*' });

    for (const task of tasks || []) {
      // H-2: dikirim sekali saja, tepat 2 hari sebelum tanggal_selesai.
      if (diffDays(task.tanggal_selesai, today) === 2 && !task.reminder_h2_sent_at) {
        try {
          const message = `Tugas "${task.nama}" akan jatuh tempo 2 hari lagi (${formatTanggal(task.tanggal_selesai)}). Yuk selesaikan tepat waktu.`;
          await sendEmail({
            templateId: process.env.EMAILJS_REMINDER_TEMPLATE_ID,
            templateParams: buildReminderParams(task, {
              headline: 'Tugas jatuh tempo 2 hari lagi',
              message,
            }),
          });
          await sbUpdate('tugas', { id: `eq.${task.id}` }, { reminder_h2_sent_at: new Date().toISOString() });
          h2Sent++;
          await sleep(EMAILJS_RATE_LIMIT_MS);
        } catch (err) {
          console.error(`cron: gagal kirim reminder H-2 untuk tugas ${task.id}:`, err);
          failed++;
        }
      }

      // Overdue: dikirim berulang, maksimal 1x per hari, selama status belum Selesai.
      if (
        task.tanggal_selesai < today &&
        (!task.reminder_overdue_last_sent_on || task.reminder_overdue_last_sent_on < today)
      ) {
        try {
          const hariTerlambat = Math.abs(diffDays(task.tanggal_selesai, today));
          const message = `Tugas "${task.nama}" sudah terlambat ${hariTerlambat} hari dari tenggat (${formatTanggal(task.tanggal_selesai)}). Mohon segera diselesaikan atau update statusnya.`;
          await sendEmail({
            templateId: process.env.EMAILJS_REMINDER_TEMPLATE_ID,
            templateParams: buildReminderParams(task, {
              headline: 'Tugas sudah terlambat',
              message,
            }),
          });
          await sbUpdate('tugas', { id: `eq.${task.id}` }, { reminder_overdue_last_sent_on: today });
          overdueSent++;
          await sleep(EMAILJS_RATE_LIMIT_MS);
        } catch (err) {
          console.error(`cron: gagal kirim reminder overdue untuk tugas ${task.id}:`, err);
          failed++;
        }
      }
    }

    res.status(200).json({ ok: true, today, h2Sent, overdueSent, failed, totalChecked: (tasks || []).length });
  } catch (err) {
    console.error('cron/check-deadlines error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
