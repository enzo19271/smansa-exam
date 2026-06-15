// api/verify-key.js — Verify kunci ujian untuk mapel+kelas dari ujian.json
const { readFile, parseBody } = require("./lib/github");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = await parseBody(req);
    const { mapel_id, kelas, key } = body;

    if (!mapel_id || !kelas || !key)
      return res.status(400).json({ error: "Data tidak lengkap" });

    // kelas dari form-ujian berupa string misal "10.2"
    const kelasStr = String(kelas);

    const { data: ujianList } = await readFile("data/ujian.json", []);
    const ujianArr = Array.isArray(ujianList) ? ujianList : [];

    const matchUjian = ujianArr.find(u =>
      u.mapel_id === mapel_id &&
      u.aktif !== false &&
      u.kunci === key &&
      (u.kelas || []).some(k => String(k) === kelasStr || kelasStr.startsWith(String(k) + "."))
    );

    if (matchUjian) {
      const { data: guruList } = await readFile("data/guru.json", []);
      const guru = (Array.isArray(guruList) ? guruList : []).find(g => g.id === matchUjian.guru_id);
      return res.status(200).json({
        valid: true,
        guru_id: matchUjian.guru_id,
        guru_nama: guru ? guru.nama : "Guru",
        ujian_id: matchUjian.id
      });
    }

    // Fallback: cek dari guru.json (backward compat)
    const { data: guruList } = await readFile("data/guru.json", []);
    const guruMatch = (Array.isArray(guruList) ? guruList : []).find(
      (g) => g.mapel_id === mapel_id && g.guru_key === key
    );
    if (guruMatch) {
      return res.status(200).json({ valid: true, guru_id: guruMatch.id, guru_nama: guruMatch.nama });
    }

    return res.status(401).json({ valid: false, error: "Key tidak valid" });

  } catch (err) {
    console.error("verify-key error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
