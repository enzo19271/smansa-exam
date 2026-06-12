// api/soal.js — Guru manages questions for their mapel+kelas
const { readFile, writeFile, parseBody } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,x-guru-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ── GET soal: siswa ambil soal saat ujian ───────────────────────────────
    if (req.method === "GET") {
      const { mapel_id, kelas } = req.query;
      if (!mapel_id || !kelas)
        return res.status(400).json({ error: "mapel_id dan kelas wajib diisi" });

      const path = `data/soal/${mapel_id}_${kelas}.json`;
      const { data } = await readFile(path, []);
      const safe = (Array.isArray(data) ? data : []).map(({ jawaban, ...rest }) => rest);
      return res.status(200).json(safe);
    }

    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    // ── POST: guru/admin manages questions ─────────────────────────────────
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

    const body = await parseBody(req);
    const { action, mapel_id, kelas, soal } = body;

    if (!action)
      return res.status(400).json({ error: "Field 'action' wajib diisi" });

    // Guru hanya bisa akses mapel & kelas miliknya
    if (!isAdmin && guruMatch) {
      if (
        action !== "whoami" &&
        (guruMatch.mapel_id !== mapel_id ||
          !guruMatch.kelas.includes(Number(kelas)))
      ) {
        return res.status(403).json({ error: "Akses ditolak untuk mapel/kelas ini" });
      }
    }

    if (action === "whoami") {
      return res.status(200).json({ guru: guruMatch });
    }

    const path = `data/soal/${mapel_id}_${kelas}.json`;
    const { data, sha } = await readFile(path, []);

    if (action === "get_full") {
      return res.status(200).json({ soal: Array.isArray(data) ? data : [] });
    }

    if (action === "save_all") {
      if (!Array.isArray(soal))
        return res.status(400).json({ error: "soal harus berupa array" });
      await writeFile(path, soal, sha);
      return res.status(200).json({ ok: true });
    }

    if (action === "delete") {
      if (!soal || !soal.id)
        return res.status(400).json({ error: "soal.id wajib untuk delete" });
      const filtered = (Array.isArray(data) ? data : []).filter((s) => s.id !== soal.id);
      await writeFile(path, filtered, sha);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Action '${action}' tidak dikenal` });

  } catch (err) {
    console.error("soal.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
