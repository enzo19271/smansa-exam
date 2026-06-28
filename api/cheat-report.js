// api/cheat-report.js — Menerima laporan pelanggaran curang dari siswa
// REVISI: Simpan history array dengan timestamp DETEKSI, bukan hanya upsert terakhir
const { readFile, writeFile } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET: Retrieve cheat_log data (untuk guru dashboard) ─────────────────
  if (req.method === "GET") {
    try {
      const { data: cheatLog } = await readFile("data/cheat_log.json", []);
      return res.status(200).json(Array.isArray(cheatLog) ? cheatLog : []);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Log cheat report dari ujian ────────────────────────────────────
  if (req.method !== "POST") return res.status(405).end();

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { nama, kelas, mapel_id, ujian_id, cheat_count, waktu } = body;

    if (!nama || !kelas || !mapel_id) return res.status(400).json({ error: "Data tidak lengkap" });

    // Baca cheat_log.json
    const { data: cheatLog, sha } = await readFile("data/cheat_log.json", []);
    const log = Array.isArray(cheatLog) ? cheatLog : [];

    // Cari entry untuk siswa ini
    const existIdx = log.findIndex(
      l => l.nama === nama && l.kelas === String(kelas) && l.mapel_id === mapel_id
    );

    // ── REVISI: Dari upsert sederhana, jadi simpan history array ────────────────
    let entry;
    if (existIdx >= 0) {
      // Update: tambah ke history, update count terbaru
      entry = log[existIdx];
      entry.history = entry.history || [];
      
      // Tambah timestamp deteksi baru (bukan yang terakhir overwrite)
      entry.history.push({
        waktu_deteksi: waktu,
        cheat_number: cheat_count,  // 2 atau 3, tergantung percobaan keberapa
      });
      
      // Update metadata
      entry.cheat_count = cheat_count;  // Total count terbaru
      entry.waktu_terakhir = waktu;     // Untuk backward compat
      entry.ujian_id = ujian_id || null;
    } else {
      // Entry baru: buat dengan history array
      entry = {
        nama,
        kelas: String(kelas),
        mapel_id,
        ujian_id: ujian_id || null,
        cheat_count,
        waktu_terakhir: waktu,
        history: [
          {
            waktu_deteksi: waktu,
            cheat_number: cheat_count,
          }
        ]
      };
      log.push(entry);
    }

    // Jika sudah upsert, update array
    if (existIdx >= 0) {
      log[existIdx] = entry;
    }

    await writeFile("data/cheat_log.json", log, sha);
    return res.status(200).json({ ok: true, history_count: entry.history.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
