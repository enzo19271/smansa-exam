// api/cheat-report.js — Menerima laporan pelanggaran curang dari siswa
const { readFile, writeFile } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    const { nama, kelas, mapel_id, ujian_id, cheat_count, waktu } = body;

    if (!nama || !kelas || !mapel_id) return res.status(400).json({ error: "Data tidak lengkap" });

    // Update field cheat di hasil.json jika siswa sudah terdaftar
    // atau simpan di cheat_log.json sebagai buffer sementara
    const { data: cheatLog, sha } = await readFile("data/cheat_log.json", []);
    const log = Array.isArray(cheatLog) ? cheatLog : [];

    // Upsert — update jika sudah ada, tambah jika belum
    const existIdx = log.findIndex(
      l => l.nama === nama && l.kelas === String(kelas) && l.mapel_id === mapel_id
    );
    const entry = { nama, kelas: String(kelas), mapel_id, ujian_id: ujian_id || null, cheat_count, waktu_terakhir: waktu };
    if (existIdx >= 0) log[existIdx] = entry;
    else log.push(entry);

    await writeFile("data/cheat_log.json", log, sha);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
