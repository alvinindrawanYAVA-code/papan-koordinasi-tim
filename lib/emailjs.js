// Kirim email lewat REST API EmailJS dari server (bukan browser SDK).
// Butuh EMAILJS_PRIVATE_KEY (beda dari public key yang ada di index.html) --
// EmailJS menolak permintaan non-browser tanpa accessToken ini.

async function sendEmail({ templateId, templateParams }) {
  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: process.env.EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: process.env.EMAILJS_PUBLIC_KEY,
      accessToken: process.env.EMAILJS_PRIVATE_KEY,
      template_params: templateParams,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`EmailJS kirim gagal: ${res.status} ${text}`);
  }
}

module.exports = { sendEmail };
