// api/soal.js — Guru manages questions for their mapel+kelas
const { readFile, writeFile } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,x-guru-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── GET soal: siswa ambil soal saat ujian ─────────────────────────────────
  if (req.method === "GET") {
    const { mapel_id, kelas } = req.query;
    if (!mapel_id || !kelas)
      return res.status(400).json({ error: "mapel_id dan kelas wajib diisi" });

    const path = `data/soal/${mapel_id}_${kelas}.json`;
    const { data } = await readFile(path, []);
    // strip correct answer before sending to siswa
    const safe = data.map(({ jawaban, ...rest }) => rest);
    return res.status(200).json(safe);
  }

  // ── POST: guru/admin manages questions ────────────────────────────────────
  const adminKey  = req.headers["x-admin-key"];
  const guruKey   = req.headers["x-guru-key"];
  const isAdmin   = adminKey === ADMIN_KEY;

  // Guru must verify their key
  let guruMatch = null;
  if (!isAdmin) {
    if (!guruKey) return res.status(401).json({ error: "Unauthorized" });
    const { data: guruList } = await readFile("data/guru.json", []);
    guruMatch = guruList.find((g) => g.guru_key === guruKey);
    if (!guruMatch) return res.status(401).json({ error: "Key guru tidak valid" });
  }

  const { action, mapel_id, kelas, soal } = req.body;

  // If guru, restrict to their own mapel & kelas
  if (!isAdmin && guruMatch) {
    if (guruMatch.mapel_id !== mapel_id || !guruMatch.kelas.includes(Number(kelas)))
      return res.status(403).json({ error: "Akses ditolak untuk mapel/kelas ini" });
  }

  const path = `data/soal/${mapel_id}_${kelas}.json`;
  const { data, sha } = await readFile(path, []);

  if (action === "whoami") {
    return res.status(200).json({ guru: guruMatch });
  }

  if (action === "get_full") {
    // Guru fetches their own soal including correct answers
    const p = `data/soal/${mapel_id}_${kelas}.json`;
    const { data: fullSoal } = await readFile(p, []);
    return res.status(200).json({ soal: fullSoal });
  }

  if (action === "save_all") {
    // soal: array of { id, pertanyaan, opsi:{A,B,C,D}, jawaban }
    await writeFile(path, soal, sha);
    return res.status(200).json({ ok: true });
  }

  if (action === "delete") {
    // soal: { id }
    const filtered = data.filter((s) => s.id !== soal.id);
    await writeFile(path, filtered, sha);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "Action tidak valid" });
};
