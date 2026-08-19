const { sbSelect, sbUpdate } = require('../../lib/supabaseAdmin');
const { sendEmail } = require('../../lib/emailjs');
const { todayWita, diffDays, formatTanggal } = require('../../lib/time');

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

// Dipanggil otomatis 1x/hari oleh Vercel Cron (lihat vercel.json). Vercel
// mengirim header Authorization: Bearer <CRON_SECRET> sendiri saat trigger --
// endpoint ini WAJIB verifikasi sendiri, Vercel tidak otomatis blokir akses lain.
//
// Sengaja CUMA reminder overdue (tidak ada lagi H-2 sebelum deadline), dan
// dikirim tiap 3 hari sekali per tugas (hari-0 = tepat di tanggal deadline,
// lalu hari-3, hari-6, dst) -- bukan tiap hari seperti versi awal, supaya
// kuota EmailJS gratis (±200/bulan) tidak cepat terkuras kalau tugas overdue
// menumpuk. Ini kebijakan notifikasi yang disepakati: cuma 4 pemicu boleh
// kirim email (tugas baru, kirim pengingat manual, tugas selesai, dan
// reminder overdue otomatis ini) -- tidak ada notifikasi lain di luar itu.
module.exports = async (req, res) => {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).send('Unauthorized');
    return;
  }

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

    res.status(200).json({ ok: true, today, overdueSent, failed, totalChecked });
  } catch (err) {
    console.error('cron/check-deadlines error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
};
