// api/soal.js — Guru manages questions for their mapel+kelas
const { readFile, writeFile, parseBody, writeBinaryFile, readFileRaw } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

// Folder khusus penyimpanan gambar soal di repo GitHub
const GAMBAR_FOLDER = "data/gambar-soal";
// Batas ukuran file mentah (bukan base64) — Contents API GitHub membatasi ±1MB per file
const MAX_GAMBAR_BYTES = 900 * 1024;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key,x-guru-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // ── GET gambar: serve file gambar soal yang tersimpan di GitHub ────────
    if (req.method === "GET" && req.query.gambar) {
      const path = String(req.query.gambar);
      // Proteksi: hanya boleh serve file di dalam folder gambar soal
      if (!path.startsWith(`${GAMBAR_FOLDER}/`)) {
        return res.status(400).json({ error: "Path gambar tidak valid" });
      }
      const file = await readFileRaw(path);
      if (!file) return res.status(404).json({ error: "Gambar tidak ditemukan" });

      const ext = (path.split(".").pop() || "").toLowerCase();
      const contentTypeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
      res.setHeader("Content-Type", contentTypeMap[ext] || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(Buffer.from(file.base64, "base64"));
    }

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

    if (action === "whoami") {
      return res.status(200).json({ guru: guruMatch });
    }

    // ── UPLOAD GAMBAR SOAL ──────────────────────────────────────────────────
    // Body: { action:"upload_gambar", gambar_base64: "data:image/...;base64,....", filename, mapel_id }
    if (action === "upload_gambar") {
      const { gambar_base64, filename } = body;
      if (!gambar_base64 || !filename)
        return res.status(400).json({ error: "gambar_base64 dan filename wajib diisi" });

      const match = /^data:(image\/(?:png|jpe?g|gif|webp));base64,([a-zA-Z0-9+/=]+)$/i.exec(gambar_base64);
      if (!match)
        return res.status(400).json({ error: "Format gambar tidak didukung. Gunakan PNG, JPG, GIF, atau WEBP." });

      const mime = match[1].toLowerCase();
      const rawBase64 = match[2];
      const approxBytes = Math.floor((rawBase64.length * 3) / 4);
      if (approxBytes > MAX_GAMBAR_BYTES)
        return res.status(400).json({ error: `Ukuran gambar maksimal ${(MAX_GAMBAR_BYTES / 1024).toFixed(0)}KB. Kompres/kecilkan gambar terlebih dahulu.` });

      const extMap = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/gif": "gif", "image/webp": "webp" };
      const ext = extMap[mime] || "jpg";

      const folderMapel = String(mapel_id || (guruMatch ? guruMatch.mapel_id : "umum")).replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeName = String(filename).replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "gambar";
      const uploadPath = `${GAMBAR_FOLDER}/${folderMapel}/${Date.now()}_${safeName}.${ext}`;

      await writeBinaryFile(uploadPath, rawBase64);

      return res.status(200).json({
        ok: true,
        path: uploadPath,
        url: `/api/soal?gambar=${encodeURIComponent(uploadPath)}`,
      });
    }

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
