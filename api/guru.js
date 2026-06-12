// api/guru.js — CRUD guru (admin only); GET list (admin)
const { readFile, writeFile, parseBody } = require("./lib/github");

const ADMIN_KEY = process.env.ADMIN_KEY;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-admin-key");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    // Semua endpoint guru memerlukan autentikasi admin
    const key = req.headers["x-admin-key"];
    if (!key || key !== ADMIN_KEY)
      return res.status(401).json({ error: "Unauthorized: x-admin-key salah atau tidak ada" });

    // ── GET: list all guru ──────────────────────────────────────────────────
    if (req.method === "GET") {
      const { data } = await readFile("data/guru.json", []);
      return res.status(200).json(Array.isArray(data) ? data : []);
    }

    // ── POST: add / delete / update guru ────────────────────────────────────
    if (req.method !== "POST")
      return res.status(405).json({ error: "Method not allowed" });

    // Parse body secara eksplisit (fix bug utama Vercel)
    const body = await parseBody(req);
    const { action, guru } = body;

    if (!action || !guru)
      return res.status(400).json({ error: "Field 'action' dan 'guru' wajib diisi" });

    const { data, sha } = await readFile("data/guru.json", []);
    const list = Array.isArray(data) ? data : [];

    if (action === "add") {
      if (!guru.id || !guru.nama || !guru.mapel_id || !guru.guru_key)
        return res.status(400).json({ error: "Guru harus memiliki id, nama, mapel_id, dan guru_key" });
      if (list.find((g) => g.id === guru.id))
        return res.status(400).json({ error: `ID guru '${guru.id}' sudah ada` });
      // Pastikan kelas adalah array angka
      guru.kelas = (guru.kelas || []).map(Number).filter(Boolean);
      list.push(guru);
      await writeFile("data/guru.json", list, sha);
      return res.status(200).json({ ok: true, data: guru });
    }

    if (action === "delete") {
      if (!guru.id)
        return res.status(400).json({ error: "ID guru wajib untuk delete" });
      const filtered = list.filter((g) => g.id !== guru.id);
      if (filtered.length === list.length)
        return res.status(404).json({ error: `Guru '${guru.id}' tidak ditemukan` });
      await writeFile("data/guru.json", filtered, sha);
      return res.status(200).json({ ok: true });
    }

    if (action === "update") {
      if (!guru.id)
        return res.status(400).json({ error: "ID guru wajib untuk update" });
      const idx = list.findIndex((g) => g.id === guru.id);
      if (idx === -1)
        return res.status(404).json({ error: `Guru '${guru.id}' tidak ditemukan` });
      if (guru.kelas) guru.kelas = guru.kelas.map(Number).filter(Boolean);
      list[idx] = { ...list[idx], ...guru };
      await writeFile("data/guru.json", list, sha);
      return res.status(200).json({ ok: true, data: list[idx] });
    }

    return res.status(400).json({ error: `Action '${action}' tidak dikenal` });

  } catch (err) {
    console.error("guru.js error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
