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

    const kelasStr = String(kelas);
    const keyNorm  = String(key).toUpperCase();

    const { data: ujianList } = await readFile("data/ujian.json", []);
    const ujianArr = Array.isArray(ujianList) ? ujianList : [];

    const matchUjian = ujianArr.find(u =>
      u.mapel_id === mapel_id &&
      u.aktif !== false &&
      String(u.kunci).toUpperCase() === keyNorm &&
      (u.kelas || []).some(k => String(k) === kelasStr || kelasStr.startsWith(String(k) + "."))
    );

    if (matchUjian) {
      // ── Cek window waktu ──────────────────────────────────────────────────
      const now = new Date();
      if (matchUjian.waktu_mulai && now < new Date(matchUjian.waktu_mulai)) {
        const fmt = new Date(matchUjian.waktu_mulai).toLocaleString("id-ID", {
          dateStyle: "short", timeStyle: "short"
        });
        return res.status(403).json({
          valid: false,
          code: "BELUM_MULAI",
          error: `Ujian belum dimulai. Dibuka pada ${fmt}`,
          waktu_mulai: matchUjian.waktu_mulai
        });
      }
      if (matchUjian.waktu_selesai && now > new Date(matchUjian.waktu_selesai)) {
        const fmt = new Date(matchUjian.waktu_selesai).toLocaleString("id-ID", {
          dateStyle: "short", timeStyle: "short"
        });
        return res.status(403).json({
          valid: false,
          code: "SUDAH_SELESAI",
          error: `Waktu ujian sudah berakhir sejak ${fmt}`,
          waktu_selesai: matchUjian.waktu_selesai
        });
      }

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
      (g) => g.mapel_id === mapel_id && String(g.guru_key).toUpperCase() === keyNorm
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
