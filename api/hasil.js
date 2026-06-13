// api/hasil.js — GET hasil ujian (admin or guru); DELETE hapus satu hasil; POST submit hasil (siswa)
const { readFile, writeFile, parseBody } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,x-guru-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ── GET: ambil daftar hasil ───────────────────────────────────────────────
    if (req.method === "GET") {
      const adminKey = req.headers["x-admin-key"];
      const guruKey  = req.headers["x-guru-key"];
      const isAdmin  = adminKey === ADMIN_KEY;

      let guruMatch = null;
      if (!isAdmin) {
        if (!guruKey) return res.status(401).json({ error: "Unauthorized" });
        const { data: guruList } = await readFile("data/guru.json", []);
        guruMatch = (Array.isArray(guruList) ? guruList : []).find(
          (g) => g.guru_key === guruKey
        );
        if (!guruMatch)
          return res.status(401).json({ error: "Key guru tidak valid" });
      }

      const { data: hasilList } = await readFile("data/hasil.json", []);
      const list = Array.isArray(hasilList) ? hasilList : [];

      const filtered = isAdmin
        ? list
        : list.filter((h) => h.mapel_id === guruMatch.mapel_id);

      return res.status(200).json(filtered);
    }

    // ── DELETE: hapus satu hasil berdasarkan id ───────────────────────────────
    if (req.method === "DELETE") {
      const guruKey  = req.headers["x-guru-key"];
      const adminKey = req.headers["x-admin-key"];
      const isAdmin  = adminKey === ADMIN_KEY;

      let guruMatch = null;
      if (!isAdmin) {
        if (!guruKey) return res.status(401).json({ error: "Unauthorized" });
        const { data: guruList } = await readFile("data/guru.json", []);
        guruMatch = (Array.isArray(guruList) ? guruList : []).find(
          (g) => g.guru_key === guruKey
        );
        if (!guruMatch)
          return res.status(401).json({ error: "Key guru tidak valid" });
      }

      const body = await parseBody(req);
      const { id } = body;
      if (!id) return res.status(400).json({ error: "id diperlukan" });

      const { data: hasilList, sha } = await readFile("data/hasil.json", []);
      const list = Array.isArray(hasilList) ? hasilList : [];

      const target = list.find((h) => h.id === id);
      if (!target) return res.status(404).json({ error: "Data tidak ditemukan" });

      // Guru hanya boleh hapus data mapel miliknya
      if (!isAdmin && target.mapel_id !== guruMatch.mapel_id) {
        return res.status(403).json({ error: "Tidak diizinkan menghapus data ini" });
      }

      const newList = list.filter((h) => h.id !== id);
      await writeFile("data/hasil.json", newList, sha);

      return res.status(200).json({ ok: true, deleted: id });
    }

    return res.status(405).json({ error: "Method not allowed" });

  } catch (err) {
    console.error("hasil.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
