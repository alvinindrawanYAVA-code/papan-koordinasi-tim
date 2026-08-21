// Helper Response JSON bersama buat semua Netlify Function ESM di
// netlify/functions/ -- disatukan di sini (bukan diulang tiap file) supaya
// tidak menulis `new Response(JSON.stringify(...), {...})` berkali-kali.
// Ditaruh di /lib (bukan di dalam netlify/functions/) supaya Netlify tidak
// menganggap file ini sebagai endpoint tersendiri.
export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
